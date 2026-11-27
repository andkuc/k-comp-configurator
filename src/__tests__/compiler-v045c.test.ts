// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Phase v0.4.5-c1 Suite: Multi-Server HttpCompilerProvider, Diagnostics Hygiene, Settings Store & Device Workspace UI
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveBoard } from '../boards';
import { CATALOG } from '../catalog';
import { getActiveOnboardDefs, state } from '../core/state';
import { serializeProjectDocument } from '../core/persistence';
import { initI18n } from '../i18n';
import {
  HttpCompilerProvider,
  decodeApiArtifactToFirmwareArtifact,
  decodeBase64ToBytes,
  deviceSession,
  getCompilerProvider,
  normalizeCompilerServerUrl,
  normalizeDiagnosticPath,
  parseCompilerDiagnostics,
  probeCompilerServer,
  registerCompilerProvider,
  sanitizeCompilerText,
  type CompileRequest
} from '../services';
import { appBus, projectStore, settingsStore } from '../store';
import { renderSettingsModalBody } from '../ui/modals/settings';
import { initWorkspaceShell, resetWorkspaceShell, setActiveWorkspace } from '../workspaces';

const SAMPLE_IHEX = [
  ':100000000C9434000C9446000C9446000C9446006A',
  ':00000001FF'
].join('\n');

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function makeMockJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body
  } as unknown as Response;
}

function setupDeviceDom(boardId = 'kcomp-v2'): void {
  initI18n();
  resetWorkspaceShell();
  projectStore.reset();
  settingsStore.reset();
  registerCompilerProvider(null);
  if (typeof localStorage !== 'undefined') localStorage.clear();

  const board = setActiveBoard(boardId);
  state.boardId = board.id;
  state.codeProfile = board.defaultCodeProfile;
  state.carrierEnabled = Boolean(board.carrier?.defaultEnabled);
  state.catalog = CATALOG;
  state.active = [];
  state.codeBlocks = [];
  state.onboard = {};
  state.latestSketch = '#include <Wire.h>\nvoid setup() {}\nvoid loop() {}\n';
  for (const ob of getActiveOnboardDefs()) state.onboard[ob.id] = false;

  document.body.innerHTML = `
    <nav id="workspaceSwitchSlot"></nav>
    <section id="workspaceStage" class="workspace-stage hidden"></section>
    <main id="workspace" class="workspace"></main>
    <div id="settingsModal" class="modal hidden"><div id="settingsModalBody"></div></div>`;
}

describe('Compiler URL Normalization & Diagnostics Hygiene (v0.4.5-c1)', () => {
  it('normalizes valid HTTP(S) server URLs and rejects unsafe schemes or embedded credentials', () => {
    expect(normalizeCompilerServerUrl('http://localhost:8787/')).toBe('http://localhost:8787');
    expect(normalizeCompilerServerUrl('https://compile.example.org/kcomp///')).toBe('https://compile.example.org/kcomp');
    expect(normalizeCompilerServerUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeCompilerServerUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeCompilerServerUrl('https://user:pass@compile.example.org')).toBeNull();
    expect(normalizeCompilerServerUrl('')).toBeNull();
  });

  it('strips temporary server paths and internal toolchain vendor names before UI rendering', () => {
    const rawVendor = 'Ardu' + 'ino';
    const dirtyLog = [
      `/tmp/kcomp-build-9921/main.ino:14:9: error: '${rawVendor}.h': expected ';' before '}'`,
      `C:\\Users\\ci\\AppData\\Local\\Temp\\build\\sensor.h:7:2: warning: ${rawVendor.toLowerCase()}-cli deprecated flag`
    ].join('\n');

    const diags = parseCompilerDiagnostics(dirtyLog);
    expect(diags).toHaveLength(2);
    expect(diags[0]).toEqual({
      severity: 'error',
      file: 'main.ino',
      line: 14,
      column: 9,
      message: "'mcu_core.h': expected ';' before '}'"
    });
    expect(diags[1].file).toBe('sensor.h');
    expect(diags[1].message).toContain('build-toolchain');
    expect(diags[1].message.toLowerCase()).not.toContain(rawVendor.toLowerCase());
    expect(normalizeDiagnosticPath('sketch.ino')).toBe('sketch.ino');
    expect(sanitizeCompilerText(`/var/tmp/build-1/foo.cpp: ${rawVendor} core`)).toBe('foo.cpp: MCU core');
  });
});

describe('HttpCompilerProvider Contract, LRU Cache, Base64->FirmwareArtifact & AbortSignal', () => {
  const kcompReq: CompileRequest = {
    boardId: 'kcomp-v2',
    mcu: 'atmega328p',
    codeProfile: 'kcomp-avr',
    files: [{ path: 'main.ino', content: 'void setup() {} void loop() {}' }],
    libraries: ['Wire.h'],
    optimizeForSize: false
  };

  it('checks /api/v1/health, sends Authorization Bearer token, caches builds, and invalidates cache when librariesHash changes', async () => {
    let libHash = 'sha256-lib-v1';
    let compileCalls = 0;
    const seenAuth: Array<string | undefined> = [];
    const seenBodies: Array<Record<string, unknown>> = [];

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const hdrs = (init?.headers || {}) as Record<string, string>;
      seenAuth.push(hdrs.Authorization);

      if (url.endsWith('/api/v1/health')) {
        return makeMockJsonResponse({
          ok: true,
          apiVersion: '1',
          serverVersion: '0.4.5',
          boards: ['kcomp-v2', 'esp32-s3-devkit'],
          librariesHash: libHash,
          queue: { active: 0, queued: 0, maxConcurrent: 4 },
          authRequired: true
        });
      }
      if (url.endsWith('/api/v1/compile')) {
        compileCalls++;
        seenBodies.push(JSON.parse(String(init?.body || '{}')) as Record<string, unknown>);
        return makeMockJsonResponse({
          ok: true,
          cached: false,
          durationMs: 245,
          boardId: 'kcomp-v2',
          diagnostics: [],
          memory: { flashUsed: 2048, flashMax: 32256, ramUsed: 210, ramMax: 2048 },
          artifact: {
            format: 'ihex',
            filename: 'main.hex',
            rawHex: SAMPLE_IHEX,
            segments: [],
            elfBase64: bytesToBase64(new Uint8Array([0x7f, 0x45, 0x4c, 0x46])),
            symbols: { setup: 0x100, loop: 0x140 }
          }
        });
      }
      return makeMockJsonResponse({ error: 'Not found' }, 404);
    });

    const provider = new HttpCompilerProvider({
      profile: {
        id: 'lab',
        label: 'Lab Server',
        url: 'https://compile.example.org/',
        authToken: 'secret-token-42'
      },
      fetchImpl: mockFetch as unknown as typeof fetch
    });

    // 1. Health check
    const health = await provider.checkHealth();
    expect(health.online).toBe(true);
    expect(health.boards).toEqual(['kcomp-v2', 'esp32-s3-devkit']);
    expect(health.librariesHash).toBe('sha256-lib-v1');
    expect(provider.listSupportedBoards()).toEqual(['kcomp-v2', 'esp32-s3-devkit']);
    expect(seenAuth[0]).toBe('Bearer secret-token-42');

    // 2. First compile hits server and decodes IHEX + reserved ELF/symbols
    const res1 = await provider.compile(kcompReq);
    expect(res1.ok).toBe(true);
    expect(res1.cacheHit).toBe(false);
    expect(res1.memory).toEqual({ flashUsed: 2048, flashMax: 32256, ramUsed: 210, ramMax: 2048 });
    expect(res1.firmwareArtifact?.format).toBe('ihex');
    expect(res1.firmwareArtifact?.byteLength).toBe(16);
    expect(Array.from(res1.firmwareArtifact?.elf || [])).toEqual([0x7f, 0x45, 0x4c, 0x46]);
    expect(res1.firmwareArtifact?.symbols).toEqual({ setup: 0x100, loop: 0x140 });
    expect(compileCalls).toBe(1);
    // Client sends canonical boardId only — never raw FQBN
    expect(seenBodies[0].boardId).toBe('kcomp-v2');
    expect(seenBodies[0].fqbn).toBeUndefined();

    // 3. Second identical compile is served from browser LRU cache (0 network calls)
    const res2 = await provider.compile(kcompReq);
    expect(res2.ok).toBe(true);
    expect(res2.cacheHit).toBe(true);
    expect(compileCalls).toBe(1);
    expect(provider.getCacheSize()).toBe(1);

    // 4. Server library update changes librariesHash -> invalidates browser cache!
    libHash = 'sha256-lib-v2';
    await provider.checkHealth();
    expect(provider.getCacheSize()).toBe(0);
    const res3 = await provider.compile(kcompReq);
    expect(res3.cacheHit).toBe(false);
    expect(compileCalls).toBe(2);
  });

  it('decodes multi-segment ESP32-S3 Base64 artifacts and handles HTTP 429 / AbortSignal cleanly', async () => {
    const bootBytes = new Uint8Array([0xe9, 0x01, 0x02, 0x03]);
    const partBytes = new Uint8Array([0xaa, 0x50, 0x01, 0x02]);
    const appBytes = new Uint8Array([0xe9, 0x10, 0x20, 0x30, 0x40]);

    const decoded = decodeApiArtifactToFirmwareArtifact(
      {
        format: 'esp-segments',
        filename: 'esp-app.bin',
        segments: [
          { offset: 0x10000, label: 'app', dataBase64: bytesToBase64(appBytes) },
          { offset: 0x0, label: 'bootloader', dataBase64: bytesToBase64(bootBytes) },
          { offset: 0x8000, label: 'partitions', dataBase64: bytesToBase64(partBytes) }
        ]
      },
      'esp32-s3-devkit'
    );
    expect(decoded.firmwareArtifact.format).toBe('esp-segments');
    expect(decoded.firmwareArtifact.segments.map((s) => s.offset)).toEqual([0x0, 0x8000, 0x10000]);
    expect(decoded.firmwareArtifact.byteLength).toBe(13);
    expect(Array.from(decodeBase64ToBytes(bytesToBase64(appBytes)))).toEqual(Array.from(appBytes));

    // HTTP 429 queue full
    const busyProvider = new HttpCompilerProvider({
      profile: { id: 'busy', label: 'Busy', url: 'http://localhost:8787' },
      fetchImpl: (async () => makeMockJsonResponse({ error: 'Queue full' }, 429)) as unknown as typeof fetch
    });
    const busyRes = await busyProvider.compile(kcompReq);
    expect(busyRes.ok).toBe(false);
    expect(busyRes.error).toContain('429');

    // Pre-aborted AbortSignal throws AbortError without touching fetch
    const ac = new AbortController();
    ac.abort();
    await expect(busyProvider.compile(kcompReq, { signal: ac.signal })).rejects.toMatchObject({ name: 'AbortError' });

    // probeCompilerServer reports offline cleanly on network error
    const probe = await probeCompilerServer(
      { id: 'down', label: 'OfflineBox', url: 'http://localhost:9999' },
      { fetchImpl: (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch }
    );
    expect(probe.online).toBe(false);
    expect(probe.message).toContain('ECONNREFUSED');
  });
});

describe('Settings Store Server Profiles, Local-Only Token Isolation & ?compiler= Confirmation', () => {
  beforeEach(() => setupDeviceDom('kcomp-v2'));
  afterEach(() => {
    resetWorkspaceShell();
    registerCompilerProvider(null);
    document.body.innerHTML = '';
  });

  it('persists server profiles & Bearer tokens only in localStorage, never in ProjectDocument (.kcomp.json)', () => {
    const added = settingsStore.addCompilerServer(
      { label: 'School Lab', url: 'https://compile.lab.local/', authToken: 'super-secret-jwt' },
      true,
      true
    );
    expect(added.url).toBe('https://compile.lab.local');
    expect(settingsStore.getActiveCompilerServer()?.id).toBe(added.id);

    // Exported ProjectDocument must NEVER contain server URLs or tokens
    const docJson = JSON.stringify(serializeProjectDocument());
    expect(docJson).not.toContain('compile.lab.local');
    expect(docJson).not.toContain('super-secret-jwt');

    // Removing custom profile falls back cleanly to serverless mode (null); builtin local-docker cannot be deleted
    settingsStore.removeCompilerServer(added.id, true);
    expect(settingsStore.getActiveCompilerServerId()).toBeNull();
    settingsStore.removeCompilerServer('local-docker', true);
    expect(settingsStore.getCompilerServers().some((s) => s.id === 'local-docker')).toBe(true);
  });

  it('requires explicit confirmation for ?compiler=<url> and renders Settings modal server management', () => {
    settingsStore.setPendingCompilerUrl('https://codespace.example.dev:8787/');
    expect(settingsStore.getPendingCompilerUrl()).toBe('https://codespace.example.dev:8787');
    expect(settingsStore.getActiveCompilerServer()).toBeNull();

    renderSettingsModalBody();
    const modalBody = document.getElementById('settingsModalBody')!;
    expect(modalBody.textContent).toContain('https://codespace.example.dev:8787');

    // Confirming activates the server profile and clears pending URL
    modalBody.querySelector<HTMLButtonElement>('#btnSettingsConfirmUrlSrv')!.click();
    expect(settingsStore.getPendingCompilerUrl()).toBeNull();
    expect(settingsStore.getActiveCompilerServer()?.url).toBe('https://codespace.example.dev:8787');
  });
});

describe('Device Workspace UI: Health Chip, Verify, Build & Flash, Diagnostics & Headless Purity', () => {
  beforeEach(() => setupDeviceDom('kcomp-v2'));
  afterEach(async () => {
    await deviceSession.resetForTests();
    resetWorkspaceShell();
    registerCompilerProvider(null);
    document.body.innerHTML = '';
  });

  it('keeps serverless mode functional without Verify/Build buttons and opens Settings on chip click', () => {
    let openedSettings = 0;
    const unsub = appBus.on('modal:openSettings', () => { openedSettings++; });

    initWorkspaceShell();
    setActiveWorkspace('device');
    const stage = document.getElementById('workspaceStage')!;

    expect(stage.querySelector<HTMLButtonElement>('#btnDevVerify')!.classList.contains('hidden')).toBe(true);
    expect(stage.querySelector<HTMLButtonElement>('#btnDevBuildFlash')!.classList.contains('hidden')).toBe(true);
    expect(stage.querySelector<HTMLButtonElement>('#btnDevFlashFile')!.classList.contains('hidden')).toBe(false);

    const chip = stage.querySelector<HTMLButtonElement>('#btnDevCompilerChip')!;
    expect(chip.classList.contains('is-serverless')).toBe(true);
    chip.click();
    expect(openedSettings).toBe(1);
    unsub();
  });

  it('runs Verify (structured diagnostics + memory bars) and Build & Flash into Demo Simulator', async () => {
    let failNext = true;
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/v1/health')) {
        return makeMockJsonResponse({
          ok: true,
          apiVersion: '1',
          serverVersion: '0.4.5',
          boards: ['kcomp-v2', 'esp32-s3-devkit'],
          librariesHash: 'hash-1',
          queue: { active: 0, queued: 0, maxConcurrent: 2 },
          authRequired: false
        });
      }
      if (failNext) {
        failNext = false;
        return makeMockJsonResponse({
          ok: false,
          durationMs: 112,
          boardId: 'kcomp-v2',
          diagnostics: [
            { severity: 'error', file: '/tmp/build-7/main.ino', line: 9, column: 3, message: 'undeclared identifier foo' }
          ]
        });
      }
      return makeMockJsonResponse({
        ok: true,
        cached: false,
        durationMs: 185,
        boardId: 'kcomp-v2',
        diagnostics: [],
        memory: { flashUsed: 3456, flashMax: 32256, ramUsed: 280, ramMax: 2048 },
        artifact: {
          format: 'ihex',
          filename: 'kcomp-demo.hex',
          rawHex: SAMPLE_IHEX,
          segments: []
        }
      });
    });

    const provider = new HttpCompilerProvider({
      profile: { id: 'local-docker', label: 'Local (Docker)', url: 'http://localhost:8787', builtin: true },
      fetchImpl: mockFetch as unknown as typeof fetch
    });
    registerCompilerProvider(provider);

    initWorkspaceShell();
    setActiveWorkspace('device');
    await new Promise((r) => setTimeout(r, 40));

    const stage = document.getElementById('workspaceStage')!;
    const chip = stage.querySelector<HTMLButtonElement>('#btnDevCompilerChip')!;
    const verifyBtn = stage.querySelector<HTMLButtonElement>('#btnDevVerify')!;
    const buildFlashBtn = stage.querySelector<HTMLButtonElement>('#btnDevBuildFlash')!;

    expect(chip.classList.contains('is-online')).toBe(true);
    expect(verifyBtn.classList.contains('hidden')).toBe(false);
    expect(buildFlashBtn.classList.contains('hidden')).toBe(false);

    // 1. Failing Verify renders sanitized structured diagnostic row
    verifyBtn.click();
    await new Promise((r) => setTimeout(r, 40));
    const panel = stage.querySelector<HTMLElement>('#devCompilePanel')!;
    expect(panel.classList.contains('hidden')).toBe(false);
    expect(panel.classList.contains('is-err')).toBe(true);
    expect(panel.textContent).toContain('main.ino:9:3');
    expect(panel.textContent).toContain('undeclared identifier foo');
    expect(panel.textContent).not.toContain('/tmp/build-7');

    // 2. Start Demo Simulator & click Build & Flash -> compiles + flashes into SimulatorFlasher!
    stage.querySelector<HTMLButtonElement>('#btnDevSim')!.click();
    await new Promise((r) => setTimeout(r, 60));
    expect(deviceSession.isConnected()).toBe(true);

    buildFlashBtn.click();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 30));
      if (!deviceSession.getSnapshot().flashActive && deviceSession.exportLogText().includes('[SIM] Flashed')) break;
    }
    expect(panel.classList.contains('is-ok')).toBe(true);
    expect(panel.textContent).toContain('Flash');
    expect(panel.textContent).toContain('3.4 KB');
    expect(deviceSession.exportLogText()).toContain('[BUILD] Succeeded');
    expect(deviceSession.exportLogText()).toContain('[FLASH] Starting upload');
  });

  it('keeps src/services/compiler-http.ts 100% DOM-free', () => {
    const code = readFileSync(resolve(process.cwd(), 'src/services/compiler-http.ts'), 'utf-8');
    expect(code).not.toMatch(/\bdocument\./);
  });
});
