// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Architecture Hardening Suite (v0.3.3): UI Session Store, Workspace Lifecycle, Pluggable Rules & Layer Boundaries
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ESP32_S3_DEVKIT_BOARD, KCOMP_V2_BOARD, setActiveBoard } from '../boards';
import { CATALOG } from '../catalog';
import { state, getActiveOnboardDefs } from '../core/state';
import {
  DEFAULT_CONSTRAINT_RULES,
  addComponent,
  computeCriticalWarnings,
  evaluateConstraintRules,
  type HardwareConstraintRule
} from '../core/hardware';
import { initI18n } from '../i18n';
import { DEFAULT_NODE_ID, appBus, projectStore, settingsStore, uiSessionStore, type DerivedWorkspace } from '../store';
import { applyProjectDocument, serializeProjectDocument } from '../core/persistence';
import {
  SerialLogRingBuffer,
  SerialPlotRingBuffer,
  SerialPortStateMachine,
  buildCompileCacheKey,
  getArtifactFlashAddress,
  parseCompilerDiagnostics,
  parseSerialPlotLine
} from '../services';
import {
  activateWorkspace,
  getActiveWorkspace,
  initWorkspaceShell,
  registerWorkspaceLoader,
  resetWorkspaceShell,
  setActiveWorkspace,
  type WorkspaceContext,
  type WorkspaceModule
} from '../workspaces';

function resetArchEnv(boardId = 'esp32-s3-devkit') {
  initI18n();
  resetWorkspaceShell();
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
  if (board.capabilities.hasWirelessSlot) state.onboard.onboard_wireless = false;

  state.svgCache.clear();
  for (const comp of CATALOG.components) {
    state.svgCache.set(comp.svgFile, document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  }

  document.body.innerHTML = `
    <nav id="workspaceSwitchSlot"></nav>
    <section id="workspaceStage" class="workspace-stage hidden"></section>
    <main id="workspace" class="workspace"></main>`;
}

describe('Store Separation & Multi-Node Session Foundation (v0.3.3)', () => {
  beforeEach(() => resetArchEnv('esp32-s3-devkit'));

  it('tracks ephemeral UI session state independently and emits workspace:changed & node:changed events', () => {
    const events: string[] = [];
    const sessionChanges: string[] = [];

    appBus.on('workspace:changed', ({ previousId, workspaceId }) => {
      events.push(`ws:${previousId}->${workspaceId}`);
    });
    appBus.on('node:changed', ({ previousNodeId, nodeId }) => {
      events.push(`node:${previousNodeId}->${nodeId}`);
    });
    const unsub = uiSessionStore.subscribe((_snap, keys) => {
      sessionChanges.push(keys.join(','));
    });

    expect(projectStore.getActiveNodeId()).toBe(DEFAULT_NODE_ID);
    projectStore.setActiveNodeId('node_ai_host');
    expect(projectStore.getActiveNodeId()).toBe('node_ai_host');

    uiSessionStore.patch({ theme: 'light', sidebarCollapsed: true });
    expect(uiSessionStore.get().theme).toBe('light');
    expect(uiSessionStore.get().sidebarCollapsed).toBe(true);

    setActiveWorkspace('device');
    expect(events).toEqual([
      'node:node_0->node_ai_host',
      'ws:hardware->device'
    ]);
    expect(sessionChanges.length).toBe(3);

    unsub();
  });

  it('routes hardware mutation notifications over appBus ui:toast without DOM coupling', async () => {
    const toasts: string[] = [];
    appBus.on('ui:toast', ({ msg }) => toasts.push(msg));

    // Attempting to add K-Comp-V2-only wireless slot module on ESP32-S3 emits a ui:toast event
    await addComponent('hc05', { skipUndo: true });
    expect(toasts.length).toBe(1);
    expect(toasts[0]).toContain('ESP32-S3');
  });
});

describe('Strict Workspace Module Lifecycle & Lazy Loading (v0.3.3)', () => {
  beforeEach(() => resetArchEnv('esp32-s3-devkit'));
  afterEach(() => { resetWorkspaceShell(); document.body.innerHTML = ''; });

  it('executes mount(), onProjectChange(), onActiveNodeChange(), and unmount() on lazy-loaded workspaces', async () => {
    const lifecycleLog: string[] = [];
    let loaderCalls = 0;

    const customDeviceMod: WorkspaceModule = {
      id: 'device',
      mount(container: HTMLElement, ctx: WorkspaceContext) {
        lifecycleLog.push(`mount:${ctx.getActiveNodeId()}`);
        container.innerHTML = `<div class="custom-device">${ctx.getDerived().board.id}</div>`;
      },
      onProjectChange(derived: DerivedWorkspace) {
        lifecycleLog.push(`project:${derived.netlist.stats.i2cDevices}`);
      },
      onActiveNodeChange(nodeId: string) {
        lifecycleLog.push(`node:${nodeId}`);
      },
      unmount() {
        lifecycleLog.push('unmount');
      }
    };

    registerWorkspaceLoader('device', async () => {
      loaderCalls++;
      return customDeviceMod;
    });

    initWorkspaceShell();
    expect(getActiveWorkspace()).toBe('hardware');
    expect(loaderCalls).toBe(0);

    await activateWorkspace('device');
    expect(loaderCalls).toBe(1);
    expect(document.getElementById('workspaceStage')!.innerHTML).toContain('esp32-s3-devkit');

    // Node change notifies mounted workspace directly
    projectStore.setActiveNodeId('node_1');

    // Re-activating same workspace does not invoke loader twice and calls onProjectChange
    await addComponent('bmi160', { skipUndo: true });
    await activateWorkspace('device');
    expect(loaderCalls).toBe(1);

    // Switching back to hardware cleanly unmounts the mounted module
    setActiveWorkspace('hardware');
    expect(lifecycleLog).toEqual([
      'mount:node_0',
      'node:node_1',
      'project:1',
      'unmount'
    ]);
  });
});

describe('Declarative Pluggable Hardware Constraint Rules (v0.3.3)', () => {
  beforeEach(() => resetArchEnv('esp32-s3-devkit'));

  it('registers all 10 built-in rules with unique IDs and supports custom board-scoped rule plugins', () => {
    const ids = DEFAULT_CONSTRAINT_RULES.map((r) => r.id);
    expect(ids.length).toBe(10);
    expect(new Set(ids).size).toBe(10);

    const customAvrRule: HardwareConstraintRule = {
      id: 'custom-avr-only-rule',
      appliesTo: (b) => b.mcu === 'atmega328p',
      evaluate: () => [{ critical: false, advisory: true, text: 'AVR custom advisory' }]
    };

    // Does NOT trigger on ESP32-S3
    const espRes = evaluateConstraintRules(
      { board: ESP32_S3_DEVKIT_BOARD, active: [], onboard: {}, extClaims: {} },
      [customAvrRule]
    );
    expect(espRes).toHaveLength(0);

    // DOES trigger on K-Comp V2 (ATmega328P)
    const avrRes = evaluateConstraintRules(
      { board: KCOMP_V2_BOARD, active: [], onboard: {}, extClaims: {} },
      [customAvrRule]
    );
    expect(avrRes).toHaveLength(1);
    expect(avrRes[0].text).toBe('AVR custom advisory');
    expect(computeCriticalWarnings([])).toEqual([]);
  });
});

describe('Layered Architecture Boundaries & Acyclic Module Graph (v0.3.3)', () => {
  const ROOT = process.cwd();
  const SRC = resolve(ROOT, 'src');

  function walkTs(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walkTs(full, out);
      else if (entry.endsWith('.ts')) out.push(full);
    }
    return out;
  }

  function resolveRel(fromFile: string, spec: string): string | null {
    const base = resolve(dirname(fromFile), spec);
    for (const cand of [base, `${base}.ts`, join(base, 'index.ts')]) {
      try {
        if (statSync(cand).isFile()) return cand;
      } catch (_) {}
    }
    return null;
  }

  it('enforces zero UI/Workspace imports from core, store, boards, types & services and zero circular imports', () => {
    const files = walkTs(SRC);
    const forbidden: Record<string, Set<string>> = {
      types: new Set(['boards', 'catalog', 'core', 'store', 'services', 'i18n', 'workspaces', 'ui']),
      boards: new Set(['catalog', 'core', 'store', 'services', 'i18n', 'workspaces', 'ui']),
      services: new Set(['core', 'store', 'i18n', 'workspaces', 'ui']),
      core: new Set(['workspaces', 'ui']),
      store: new Set(['workspaces', 'ui'])
    };

    const graph = new Map<string, string[]>();
    const violations: string[] = [];

    for (const file of files) {
      const rel = relative(ROOT, file).replaceAll('\\', '/');
      const parts = rel.split('/');
      const layer = rel.startsWith('src/__tests__/') ? 'test' : (parts[1] || 'root');
      const code = readFileSync(file, 'utf-8');

      if (!rel.endsWith('vite-env.d.ts')) {
        expect(code, `Missing SPDX header in ${rel}`).toContain('SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0');
      }
      expect(code, `Legacy window global found in ${rel}`).not.toMatch(/window\.(?:KCOMP_|__KCOMP_)/);

      const specs: string[] = [];
      const re = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) {
        const s = m[1] || m[2];
        if (s && s.startsWith('.') && !s.endsWith('.css') && !s.endsWith('.json')) specs.push(s);
      }

      const deps: string[] = [];
      for (const spec of specs) {
        const target = resolveRel(file, spec);
        expect(target, `Unresolved import "${spec}" in ${rel}`).not.toBeNull();
        if (!target) continue;
        const targetRel = relative(ROOT, target).replaceAll('\\', '/');
        const targetLayer = targetRel.startsWith('src/__tests__/') ? 'test' : (targetRel.split('/')[1] || 'root');
        deps.push(targetRel);

        if (forbidden[layer]?.has(targetLayer)) {
          violations.push(`${rel} (${layer}) -> ${targetRel} (${targetLayer})`);
        }
      }
      if (layer !== 'test') graph.set(rel, deps);
    }

    expect(violations).toEqual([]);

    // Verify strictly acyclic runtime module DAG
    const color = new Map<string, number>();
    const cycles: string[] = [];
    const stack: string[] = [];
    const dfs = (node: string) => {
      color.set(node, 1);
      stack.push(node);
      for (const next of graph.get(node) || []) {
        if (!graph.has(next)) continue;
        const c = color.get(next) || 0;
        if (c === 1) {
          cycles.push([...stack.slice(stack.indexOf(next)), next].join(' -> '));
        } else if (c === 0) {
          dfs(next);
        }
      }
      stack.pop();
      color.set(node, 2);
    };
    for (const n of graph.keys()) {
      if (!color.get(n)) dfs(n);
    }
    expect(cycles).toEqual([]);
  });
});


describe('Device & Compiler Service Foundations (v0.3.4)', () => {
  it('enforces exclusive Web Serial port handoff transitions and rejects illegal jumps', () => {
    const sm = new SerialPortStateMachine();
    const seen: string[] = [];
    const unsub = sm.onStateChange((ev) => seen.push(`${ev.previous}->${ev.current}`));

    expect(sm.getState()).toBe('disconnected');
    sm.transition('connecting');
    sm.transition('monitoring');
    // Cannot jump straight from monitoring -> flashing without releasing lock first!
    expect(sm.canTransition('flashing')).toBe(false);
    expect(() => sm.transition('flashing')).toThrow(/Invalid serial port state transition/);

    sm.transition('releasing');
    sm.transition('flashing');
    sm.transition('reconnecting');
    sm.transition('monitoring');
    sm.transition('disconnected');

    expect(seen).toEqual([
      'disconnected->connecting',
      'connecting->monitoring',
      'monitoring->releasing',
      'releasing->flashing',
      'flashing->reconnecting',
      'reconnecting->monitoring',
      'monitoring->disconnected'
    ]);
    unsub();
  });

  it('caps high-baud serial logs & telemetry samples in fixed-capacity ringbuffers', () => {
    const logBuf = new SerialLogRingBuffer(12);
    const completed = logBuf.pushChunk('line1\r\nline2\npart');
    expect(completed).toEqual(['line1', 'line2']);
    expect(logBuf.pushChunk('ial3\n')).toEqual(['partial3']);
    for (let i = 4; i <= 20; i++) logBuf.pushLine(`line${i}`);
    expect(logBuf.length).toBe(12);
    expect(logBuf.dropped).toBe(8);
    expect(logBuf.getLines()[0]).toBe('line9');
    expect(logBuf.getLines()[11]).toBe('line20');

    const plotBuf = new SerialPlotRingBuffer(10);
    for (let i = 0; i < 15; i++) {
      const sample = parseSerialPlotLine(`temp:${20 + i}, hum:${50 + i}`, 1000 + i * 100);
      if (sample) plotBuf.push(sample);
    }
    expect(plotBuf.length).toBe(10);
    expect(plotBuf.getChannels()).toEqual(['temp', 'hum']);
    expect(plotBuf.getSamples()[0].channels.temp).toBe(25);
  });

  it('parses GCC diagnostics, resolves multi-segment flash offsets, and produces deterministic build cache keys', () => {
    const rawLog = [
      'sketch.ino:14:9: error: expected ";" before "}" token',
      'sketch.ino:22:5: warning: unused variable "x"',
      'unrelated build output line'
    ].join('\n');
    const diags = parseCompilerDiagnostics(rawLog);
    expect(diags).toHaveLength(2);
    expect(diags[0]).toEqual({
      severity: 'error',
      file: 'sketch.ino',
      line: 14,
      column: 9,
      message: 'expected ";" before "}" token'
    });
    expect(diags[1].severity).toBe('warning');

    expect(getArtifactFlashAddress({ format: 'bin', filename: 'app.bin', data: new Uint8Array([1]), address: 0x10000 })).toBe(0x10000);
    expect(getArtifactFlashAddress({ format: 'hex', filename: 'fw.hex', data: new Uint8Array([1]) })).toBe(0);

    const k1 = buildCompileCacheKey({
      boardId: 'esp32-s3-devkit',
      mcu: 'esp32s3',
      codeProfile: 'generic-scaffold',
      libraries: ['Wire', 'BMI160'],
      files: [{ path: 'b.h', content: '// b' }, { path: 'a.ino', content: 'void setup(){}' }]
    });
    const k2 = buildCompileCacheKey({
      boardId: 'esp32-s3-devkit',
      mcu: 'esp32s3',
      codeProfile: 'generic-scaffold',
      libraries: ['BMI160', 'Wire'],
      files: [{ path: 'a.ino', content: 'void setup(){}' }, { path: 'b.h', content: '// b' }]
    });
    expect(k1).toBe(k2);
  });
});

describe('Multi-Node Graph Store & Headless Core Isolation (v0.3.4)', () => {
  beforeEach(() => resetArchEnv('esp32-s3-devkit'));

  it('round-trips secondary nodes and inter-node links through canonical ProjectDocument v1 persistence', async () => {
    await addComponent('bmi160', { skipUndo: true });
    const hostNode = projectStore.addNode('kcomp-v2', 'node_aux');
    expect(hostNode.id).toBe('node_aux');
    projectStore.addLink({
      id: 'link_uart_1',
      fromNodeId: 'node_0',
      toNodeId: 'node_aux',
      bus: 'uart',
      label: 'Telemetry UART'
    });

    const exported = serializeProjectDocument();
    expect(exported.nodes.map((n) => n.id)).toEqual(['node_0', 'node_aux']);
    expect(exported.links).toHaveLength(1);
    expect(exported.links[0].bus).toBe('uart');

    // Reset and restore -> multi-node topology stays intact!
    projectStore.reset();
    appBus.handle('board:switch', ({ boardId }) => {
      const b = setActiveBoard(boardId);
      state.boardId = b.id;
      state.codeProfile = b.defaultCodeProfile;
    });
    await applyProjectDocument(exported, false);
    expect(projectStore.listNodes().map((n) => n.id)).toEqual(['node_0', 'node_aux']);
    expect(projectStore.getLinks()).toHaveLength(1);
    expect(projectStore.getLinks()[0].id).toBe('link_uart_1');
  });

  it('keeps pure headless domain modules completely free of document.* DOM access', () => {
    const ROOT = process.cwd();
    const headlessFiles = [
      'src/core/code-blocks.ts',
      'src/core/code-blocks-sram.ts',
      'src/core/code-profiles.ts',
      'src/core/docs-discovery.ts',
      'src/core/document.ts',
      'src/core/netlist.ts',
      'src/core/proposal.ts',
      'src/core/hardware/catalog-queries.ts',
      'src/core/hardware/pin-allocator.ts',
      'src/core/hardware/resources.ts',
      'src/core/hardware/mutations.ts',
      'src/services/compiler-provider.ts',
      'src/services/device-transport.ts',
      'src/services/signal-dsp.ts',
      'src/services/web-serial-types.ts',
      'src/services/web-serial-transport.ts',
      'src/services/simulator-transport.ts',
      'src/services/device-session.ts',
      'src/services/program-ir.ts',
      'src/store/bus.ts',
      'src/store/derived.ts',
      'src/store/index.ts',
      'src/store/nodes.ts',
      'src/store/ui-session.ts',
      'src/store/settings.ts'
    ];
    for (const rel of headlessFiles) {
      const code = readFileSync(resolve(ROOT, rel), 'utf-8');
      expect(code, `Unexpected document.* access in headless module ${rel}`).not.toMatch(/\bdocument\./);
    }
  });
});


describe('Skill-Level Presets & Granular Feature Settings (v0.4.3)', () => {
  beforeEach(() => resetArchEnv('esp32-s3-devkit'));

  it('defaults to Professional preset, switches presets cleanly, and auto-detects Custom vs exact preset matches', () => {
    expect(settingsStore.getPreset()).toBe('professional');
    expect(settingsStore.getFeature('optionalPins')).toBe(true);
    expect(settingsStore.getFeature('powerRailSwitch')).toBe(true);
    expect(settingsStore.getFeature('i2cAddressSwitch')).toBe(true);
    expect(settingsStore.getFeature('plotterFft')).toBe(true);
    expect(settingsStore.getFeature('previewWorkspaces')).toBe(true);
    expect(settingsStore.getFeature('codeProfiles')).toBe(true);
    expect(settingsStore.getFeature('deviceWorkspace')).toBe(true);

    // Beginner hides advanced pin, power, address, FFT & preview controls for a clutter-free start
    settingsStore.applyPreset('beginner', false);
    expect(settingsStore.getPreset()).toBe('beginner');
    expect(settingsStore.getFeature('optionalPins')).toBe(false);
    expect(settingsStore.getFeature('powerRailSwitch')).toBe(false);
    expect(settingsStore.getFeature('i2cAddressSwitch')).toBe(false);
    expect(settingsStore.getFeature('plotterFft')).toBe(false);
    expect(settingsStore.getFeature('previewWorkspaces')).toBe(false);
    expect(settingsStore.getFeature('deviceWorkspace')).toBe(true);

    // Intermediate unlocks optional pins & I2C address switcher without exposing power rail or FFT
    settingsStore.applyPreset('intermediate', false);
    expect(settingsStore.getPreset()).toBe('intermediate');
    expect(settingsStore.getFeature('optionalPins')).toBe(true);
    expect(settingsStore.getFeature('i2cAddressSwitch')).toBe(true);
    expect(settingsStore.getFeature('powerRailSwitch')).toBe(false);
    expect(settingsStore.getFeature('plotterFft')).toBe(false);

    // Flipping an individual toggle transitions preset to 'custom'
    settingsStore.setFeature('plotterFft', true, false);
    expect(settingsStore.getPreset()).toBe('custom');
    expect(settingsStore.getFeature('plotterFft')).toBe(true);
  });

  it('gates Preview Workspace tabs in the topbar switcher based on settingsStore.previewWorkspaces', () => {
    initWorkspaceShell();
    const getTabIds = () =>
      Array.from(document.querySelectorAll<HTMLElement>('#workspaceSwitchSlot [data-ws-id]')).map((el) => el.dataset.wsId);

    // Professional default shows all 4 workspace tabs
    expect(getTabIds()).toEqual(['hardware', 'program', 'device', 'shield']);

    // Beginner hides preview workspaces (Program & Shield PCB) so topbar stays compact on small monitors
    settingsStore.applyPreset('beginner', false);
    expect(getTabIds()).toEqual(['hardware', 'device']);

    // Disabling Device while active returns safely to Hardware
    setActiveWorkspace('device');
    settingsStore.setFeature('deviceWorkspace', false, false);
    expect(getActiveWorkspace()).toBe('hardware');
  });
});
