// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, expect, it } from 'vitest';
import { setActiveBoard } from '../boards';
import { CATALOG } from '../catalog';
import { loadComponentGuides, loadLibraryApiData } from '../catalog/lazy-data';
import { state, getActiveOnboardDefs } from '../core/state';
import { addComponent } from '../core/hardware';
import { getLocale, initI18n, loadLocale, setLocaleAsync, t } from '../i18n';
import {
  createEmptyProgramIR,
  getCompilerProvider,
  parseSerialPlotLine,
  registerCompilerProvider
} from '../services';
import { projectStore } from '../store';
import {
  WORKSPACES,
  getActiveWorkspace,
  initWorkspaceShell,
  setActiveWorkspace
} from '../workspaces';

function setupWorkspaceDom(boardId = 'esp32-s3-devkit') {
  initI18n();
  projectStore.reset();
  const board = setActiveBoard(boardId);
  state.boardId = board.id;
  state.codeProfile = board.defaultCodeProfile;
  state.carrierEnabled = Boolean(board.carrier?.defaultEnabled);
  state.catalog = CATALOG;
  state.active = [];
  state.codeBlocks = [];
  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) state.onboard[ob.id] = false;

  state.svgCache.clear();
  for (const comp of CATALOG.components) {
    state.svgCache.set(comp.svgFile, document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  }

  document.body.innerHTML = `
    <nav id="workspaceSwitchSlot"></nav>
    <section id="workspaceStage" class="workspace-stage hidden"></section>
    <main id="workspace" class="workspace"></main>`;
}

describe('Lazy Loading (i18n Locales & Catalog Reference Chunks)', () => {
  it('loads German and Albanian locale packs asynchronously on demand', async () => {
    initI18n();
    const deMod = await loadLocale('de');
    expect(deMod.code).toBe('de');
    await setLocaleAsync('de', false);
    expect(getLocale()).toBe('de');
    expect(t('ws.shield')).toBe('Shield-PCB');

    await setLocaleAsync('sq', false);
    expect(getLocale()).toBe('sq');
    expect(t('ws.hardware')).toBe('Hardueri');

    await setLocaleAsync('en', false);
    expect(getLocale()).toBe('en');
  });

  it('lazy-loads 52-library API data and component guides cleanly and caches both', async () => {
    const [api, guides] = await Promise.all([loadLibraryApiData(), loadComponentGuides()]);
    expect(Object.keys(api).length).toBeGreaterThanOrEqual(52);
    expect(api.bmi160).toBeDefined();
    expect(guides.bmi160).toBeDefined();
  });
});

describe('Service Contracts (Serial Plotter Parser, ProgramIR, CompilerProvider)', () => {
  it('parses named key:value and plain CSV serial plotter frames and ignores plain log lines', () => {
    const named = parseSerialPlotLine('temp:23.5, hum:58.2', 1000);
    expect(named).toEqual({ timestampMs: 1000, channels: { temp: 23.5, hum: 58.2 } });

    const eqStyle = parseSerialPlotLine('ax=-12 ay=45 az=980', 2000);
    expect(eqStyle).toEqual({ timestampMs: 2000, channels: { ax: -12, ay: 45, az: 980 } });

    const csv = parseSerialPlotLine('512, 1023, 3.14', 3000);
    expect(csv).toEqual({ timestampMs: 3000, channels: { ch1: 512, ch2: 1023, ch3: 3.14 } });

    expect(parseSerialPlotLine('All ESP32-S3 modules initialized.')).toBeNull();
    expect(parseSerialPlotLine('   ')).toBeNull();
  });

  it('creates an empty typed ProgramIR and manages CompilerProvider registration', () => {
    const ir = createEmptyProgramIR('esp32-s3-devkit');
    expect(ir.schema).toBe('kcomp-ir/1');
    expect(ir.boardId).toBe('esp32-s3-devkit');
    expect(ir.setup).toEqual([]);

    expect(getCompilerProvider()).toBeNull();
    registerCompilerProvider({
      id: 'mock-cli',
      name: 'Mock Compiler',
      checkHealth: async () => ({ online: true, providerName: 'Mock Compiler' }),
      listSupportedBoards: () => ['kcomp-v2', 'esp32-s3-devkit'],
      compile: async () => ({ ok: true, durationMs: 12, diagnostics: [], artifacts: [] })
    });
    expect(getCompilerProvider()?.id).toBe('mock-cli');
    registerCompilerProvider(null);
    expect(getCompilerProvider()).toBeNull();
  });
});

describe('Top-Level Workspace Shell (Hardware / Program / Device / Shield PCB)', () => {
  beforeEach(() => setupWorkspaceDom('esp32-s3-devkit'));

  it('renders 4 workspace tabs, defaults to hardware, and hydrates live mechanical & netlist data on Shield PCB view', async () => {
    expect(WORKSPACES.map((w) => w.id)).toEqual(['hardware', 'program', 'device', 'shield']);
    initWorkspaceShell();
    expect(getActiveWorkspace()).toBe('hardware');
    expect(document.getElementById('workspace')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('workspaceStage')?.classList.contains('hidden')).toBe(true);

    await addComponent('bmi160', { skipUndo: true });
    projectStore.recompute();

    // Switch to Shield PCB workspace -> displays live ESP32-S3 mechanical dimensions & netlist stats
    setActiveWorkspace('shield');
    expect(getActiveWorkspace()).toBe('shield');
    expect(document.getElementById('workspace')?.classList.contains('hidden')).toBe(true);
    const stageHtml = document.getElementById('workspaceStage')!.innerHTML;
    expect(stageHtml).toContain('27.9 × 69.0 mm');
    expect(stageHtml).toContain('2.54mm');
    expect(stageHtml).toContain('Nets');

    // Switch to Device workspace -> shows ESPTOOL protocol
    setActiveWorkspace('device');
    expect(document.getElementById('workspaceStage')!.innerHTML).toContain('ESPTOOL');

    // Switch back to Hardware cleanly
    setActiveWorkspace('hardware');
    expect(document.getElementById('workspace')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('workspaceStage')?.classList.contains('hidden')).toBe(true);

    document.body.innerHTML = '';
  });
});
