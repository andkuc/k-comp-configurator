// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Phase v0.4.5-d Suite: L0 Hardware Self-Test (@KTEST), Standalone Sketch Generator, Evaluator & Device Workspace UI
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ESP32_S3_DEVKIT_BOARD, KCOMP_V2_BOARD, setActiveBoard } from '../boards';
import { CATALOG } from '../catalog';
import { APP_VERSION, ASSET_VERSION } from '../core/constants';
import { addComponent } from '../core/hardware';
import { buildSelfTestSpec, generateSelfTestSketch } from '../core/selftest';
import { getActiveOnboardDefs, state } from '../core/state';
import { initI18n } from '../i18n';
import {
  deviceSession,
  evaluateSelfTestReport,
  formatHexAddr,
  parseHexAddr,
  parseKTestLine,
  registerCompilerProvider
} from '../services';
import { projectStore, settingsStore } from '../store';
import { initWorkspaceShell, resetWorkspaceShell, setActiveWorkspace } from '../workspaces';

function setupEnv(boardId = 'kcomp-v2'): void {
  initI18n();
  resetWorkspaceShell();
  projectStore.reset();
  settingsStore.reset();
  registerCompilerProvider(null);

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

describe('L0 Hardware Self-Test Spec & Standalone @KTEST Sketch Generator (v0.4.5-d)', () => {
  beforeEach(() => setupEnv('kcomp-v2'));
  afterEach(() => {
    resetWorkspaceShell();
    document.body.innerHTML = '';
  });

  it('derives expected I2C addresses (with overrides), wired pins & actuators on K-Comp V2 and generates zero-kcomp_*.h sketch', async () => {
    state.onboard.onboard_oled = true;
    state.onboard.onboard_pot = true;
    state.onboard.onboard_led = true;
    await addComponent('bmp280', { skipUndo: true });
    const bmp = state.active.find((a) => a.compId === 'bmp280')!;
    bmp.i2cAddrOverride = '0x77';
    projectStore.recompute();

    const derived = projectStore.getDerived();
    const spec = buildSelfTestSpec({
      board: KCOMP_V2_BOARD,
      catalog: CATALOG,
      active: state.active,
      onboard: state.onboard,
      dipStates: derived.dipStates,
      netlist: derived.netlist
    });

    expect(spec.boardId).toBe('kcomp-v2');
    expect(spec.i2cPins.sda).toBe('A4');
    expect(spec.i2cPins.scl).toBe('A5');
    expect(spec.deadmanPin?.boardPinId).toBe('D3');
    expect(spec.expectedI2c.map((d) => d.addressHex)).toEqual(['0x3C', '0x77']);
    expect(spec.expectedI2c[1].alternateAddresses).toEqual([0x76]);
    expect(spec.inputPins.some((p) => p.boardPinId === 'A0' && p.mode === 'analog')).toBe(true);
    expect(spec.actuators.some((a) => a.boardPinId === 'D5' && a.kind === 'led')).toBe(true);

    const sketch = generateSelfTestSketch(spec);
    expect(sketch).toContain('#include <Wire.h>');
    expect(sketch).toContain('Wire.begin();');
    expect(sketch).toContain('@KTEST');
    expect(sketch).toContain('analogRead(A0)');
    expect(sketch).toContain('KTEST_DEADMAN_PIN');
    expect(sketch).toContain('KTEST_ACT_COOLDOWN_MS');
    expect(sketch).toContain('\\"v\\":1');
    expect(sketch).toContain("Serial.print(',');");
    expect(sketch).toContain("c == '\\n' || c == '\\r'");
    // Must never depend on kcomp_*.h libraries!
    expect(sketch).not.toMatch(/#include\s*<kcomp_/i);
  });

  it('generates ESP32-S3 Wire.begin(8, 9) standalone diagnostic sketch cleanly', async () => {
    setupEnv('esp32-s3-devkit');
    await addComponent('bmi160', { skipUndo: true });
    projectStore.recompute();

    const derived = projectStore.getDerived();
    const spec = buildSelfTestSpec({
      board: ESP32_S3_DEVKIT_BOARD,
      catalog: CATALOG,
      active: state.active,
      onboard: state.onboard,
      dipStates: derived.dipStates,
      netlist: derived.netlist
    });

    expect(spec.i2cPins.sda).toBe('GPIO8');
    expect(spec.i2cPins.scl).toBe('GPIO9');
    expect(spec.expectedI2c.map((d) => d.addressHex)).toEqual(['0x69']);
    expect(spec.expectedI2c[0].alternateAddresses).toEqual([0x68]);

    const sketch = generateSelfTestSketch(spec);
    expect(sketch).toContain('Wire.begin(8, 9);');
    expect(sketch).toContain('esp32-s3-devkit');
    expect(sketch).not.toMatch(/#include\s*<kcomp_/i);
  });
});

describe('@KTEST Parser & Soll/Ist Self-Test Evaluator', () => {
  beforeEach(() => setupEnv('kcomp-v2'));

  it('parses valid @KTEST JSON frames and ignores normal logs or malformed lines', () => {
    expect(formatHexAddr(0x3c)).toBe('0x3C');
    expect(parseHexAddr('0x76')).toBe(0x76);
    expect(parseHexAddr('0x01')).toBeNull();
    expect(parseKTestLine('temp:23.4, hum:58.2')).toBeNull();
    expect(parseKTestLine('@KTEST {bad json')).toBeNull();

    const frame = parseKTestLine('@KTEST {"v":1,"board":"kcomp-v2","i2c":[60,118],"pins":{"A0":512,"D3":1},"act":0}', 5000);
    expect(frame).not.toBeNull();
    expect(frame!.board).toBe('kcomp-v2');
    expect(frame!.i2c).toEqual([0x3c, 0x76]);
    expect(frame!.pins).toEqual({ A0: 512, D3: 1 });
    expect(frame!.act).toBe(false);
  });

  it('detects PASS, alternate-address WARN (0x77 vs 0x76), missing device FAIL, and unexpected bus responders', async () => {
    state.onboard.onboard_oled = true;
    await addComponent('bmp280', { skipUndo: true }); // default 0x76, alt 0x77
    projectStore.recompute();
    const derived = projectStore.getDerived();
    const spec = buildSelfTestSpec({
      board: KCOMP_V2_BOARD,
      catalog: CATALOG,
      active: state.active,
      onboard: state.onboard,
      dipStates: derived.dipStates,
      netlist: derived.netlist
    });

    // 1. All expected devices respond -> PASS
    const passEval = evaluateSelfTestReport(
      spec,
      parseKTestLine('@KTEST {"v":1,"board":"kcomp-v2","i2c":[60,118],"pins":{},"act":0}')
    );
    expect(passEval.overall).toBe('pass');
    expect(passEval.passCount).toBe(2);
    expect(passEval.failCount).toBe(0);

    // 2. BMP280 answers on alternate address 0x77 (119) instead of 0x76 (118) -> WARN with jumper hint!
    const altEval = evaluateSelfTestReport(
      spec,
      parseKTestLine('@KTEST {"v":1,"board":"kcomp-v2","i2c":[60,119],"pins":{},"act":0}')
    );
    expect(altEval.overall).toBe('warn');
    const bmpWarn = altEval.items.find((i) => i.addressHex === '0x76');
    expect(bmpWarn?.status).toBe('warn');
    expect(bmpWarn?.hint).toContain('0x77');

    // 3. BMP280 missing completely + unknown device at 0x40 -> FAIL + unexpected I2C WARN
    const failEval = evaluateSelfTestReport(
      spec,
      parseKTestLine('@KTEST {"v":1,"board":"kcomp-v2","i2c":[60,64],"pins":{},"act":0}')
    );
    expect(failEval.overall).toBe('fail');
    expect(failEval.failCount).toBe(1);
    expect(failEval.unexpectedI2c).toEqual([0x40]);
  });
});

describe('Device Workspace Self-Test UI, Demo Simulator SCAN/ACT & Release 0.4.5 Checks', () => {
  beforeEach(() => setupEnv('kcomp-v2'));
  afterEach(async () => {
    await deviceSession.resetForTests();
    resetWorkspaceShell();
    document.body.innerHTML = '';
  });

  it('opens collapsible Self-Test panel, runs SCAN & ACT in Demo Simulator, and updates live Soll/Ist checklist', async () => {
    state.onboard.onboard_oled = true;
    state.onboard.onboard_pot = true;
    state.onboard.onboard_led = true;
    await addComponent('aht10', { skipUndo: true });
    projectStore.recompute();

    initWorkspaceShell();
    setActiveWorkspace('device');
    const stage = document.getElementById('workspaceStage')!;

    // Start Demo Simulator
    stage.querySelector<HTMLButtonElement>('#btnDevSim')!.click();
    await new Promise((r) => setTimeout(r, 60));
    expect(deviceSession.isConnected()).toBe(true);

    // Open Self-Test panel
    const toggleBtn = stage.querySelector<HTMLButtonElement>('#btnDevSelfTest')!;
    const panel = stage.querySelector<HTMLElement>('#devSelfTestPanel')!;
    expect(panel.classList.contains('hidden')).toBe(true);
    toggleBtn.click();
    expect(panel.classList.contains('hidden')).toBe(false);

    // Click Scan -> Simulator emits @KTEST matching OLED 0x3C + AHT10 0x38 + A0!
    stage.querySelector<HTMLButtonElement>('#btnDevSelfTestScan')!.click();
    await new Promise((r) => setTimeout(r, 60));

    expect(deviceSession.getSnapshot().latestSelfTestFrame?.i2c).toEqual([0x38, 0x3c]);
    expect(panel.querySelector('#devSelfTestBadge')?.classList.contains('is-pass')).toBe(true);
    expect(panel.textContent).toContain('0x3C');
    expect(panel.textContent).toContain('0x38');
    expect(panel.textContent).toContain('ADC = 512');

    // Click Pulse Actuators -> Simulator replies with act:1
    stage.querySelector<HTMLButtonElement>('#btnDevSelfTestAct')!.click();
    await new Promise((r) => setTimeout(r, 60));
    expect(deviceSession.getSnapshot().latestSelfTestFrame?.act).toBe(true);
  });

  it('keeps selftest modules 100% DOM-free and bumps release constants cleanly to 0.4.5', () => {
    const coreCode = readFileSync(resolve(process.cwd(), 'src/core/selftest.ts'), 'utf-8');
    const runnerCode = readFileSync(resolve(process.cwd(), 'src/services/selftest-runner.ts'), 'utf-8');
    expect(coreCode).not.toMatch(/\bdocument\./);
    expect(runnerCode).not.toMatch(/\bdocument\./);
    expect(APP_VERSION).toBe('0.4.5');
    expect(ASSET_VERSION).toBe('0.4.5');
  });
});
