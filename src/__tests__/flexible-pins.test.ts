// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Flexible Module Pins (Optional Signal Pins, I2C Address Selector & Dual 3.3V/5V Power Rail Control)
import { beforeEach, describe, expect, it } from 'vitest';
import { ESP32_S3_DEVKIT_BOARD, KCOMP_V2_BOARD, setActiveBoard } from '../boards';
import { CATALOG } from '../catalog';
import { state, getActiveOnboardDefs } from '../core/state';
import {
  activateOptionalPin,
  addComponent,
  computeCriticalWarnings,
  computeDipStates,
  deactivateOptionalPin,
  getCompDef,
  getInstanceAddress,
  getInstancePowerRail,
  getPendingPins,
  getSuitableBoardPins,
  moduleSupportsDualPower,
  setInstanceI2CAddress,
  setInstancePowerRail
} from '../core/hardware';
import { deriveElectricalNetlist } from '../core/netlist';
import { buildSketchString } from '../core/codegen';
import { applyProjectDocument, serializeProjectDocument } from '../core/persistence';
import { initI18n } from '../i18n';
import { appBus, projectStore } from '../store';

function resetEnv(boardId = 'esp32-s3-devkit') {
  initI18n();
  projectStore.reset();
  const board = setActiveBoard(boardId);
  state.boardId = board.id;
  state.codeProfile = board.defaultCodeProfile;
  state.carrierEnabled = Boolean(board.carrier?.defaultEnabled);
  state.catalog = CATALOG;
  state.active = [];
  state.codeBlocks = [];
  state.nextInst = 1;
  state.powerRailMode = 'smart';
  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) state.onboard[ob.id] = false;
  if (board.capabilities.hasWirelessSlot) state.onboard.onboard_wireless = false;

  state.svgCache.clear();
  for (const comp of CATALOG.components) {
    state.svgCache.set(comp.svgFile, document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  }

  appBus.handle('board:switch', ({ boardId: nextId }) => {
    const b = setActiveBoard(nextId);
    state.boardId = b.id;
    state.codeProfile = b.defaultCodeProfile;
    state.carrierEnabled = Boolean(b.carrier?.defaultEnabled);
  });
}

describe('Optional Signal Pins (Pull-to-Activate & Deactivate, v0.3.6)', () => {
  beforeEach(() => resetEnv('esp32-s3-devkit'));

  it('keeps optional pins un-wired by default with zero pending or netlist errors, then activates/deactivates cleanly', async () => {
    await addComponent('mq2', { skipUndo: true });
    const mq2 = state.active[0];

    expect(mq2.pinMap.AO).toBeTruthy();
    expect(mq2.pinMap.DO).toBeUndefined();
    expect(getPendingPins()).toHaveLength(0);

    const netBefore = deriveElectricalNetlist({
      board: ESP32_S3_DEVKIT_BOARD,
      catalog: CATALOG,
      active: state.active
    });
    expect(netBefore.unconnectedPins).toHaveLength(0);

    // Activate optional DO pin -> automatically assigns a free digital GPIO & appears in generated code
    expect(activateOptionalPin(mq2.instanceId, 'DO')).toBe(true);
    expect(mq2.pinMap.DO).toBeTruthy();
    const sketchOn = buildSketchString(computeDipStates());
    expect(sketchOn).toContain('MQ2_DO_PIN');

    // Deactivate optional DO pin -> frees the pin & removes it from generated code
    expect(deactivateOptionalPin(mq2.instanceId, 'DO')).toBe(true);
    expect(mq2.pinMap.DO).toBeUndefined();
    const sketchOff = buildSketchString(computeDipStates());
    expect(sketchOff).not.toContain('MQ2_DO_PIN');
  });
});

describe('Configurable I2C Address Pins (BMP280 / GY-302 / BMI160, v0.3.6)', () => {
  beforeEach(() => resetEnv('esp32-s3-devkit'));

  it('auto-selects secondary I2C address when adding 2× BMP280 and resolves BMI160/SPS-30 0x69 collision via SAO→GND', async () => {
    await addComponent('bmp280', { skipUndo: true });
    await addComponent('bmp280', { skipUndo: true });
    expect(state.active).toHaveLength(2);
    expect(getInstanceAddress(state.active[0])).toBe('0x76');
    expect(getInstanceAddress(state.active[1])).toBe('0x77');
    expect(state.active[1].pinMap.SDO).toBeTruthy();

    // No I2C address collision between the two BMP280 instances
    const warns = computeCriticalWarnings();
    expect(warns.some((w) => /0x76|0x77/i.test(w.text))).toBe(false);

    // Round-trip i2cAddrOverride through canonical ProjectDocument v1
    const doc = serializeProjectDocument();
    expect(doc.nodes[0].modules[1].i2cAddrOverride).toBe('0x77');
    await applyProjectDocument(doc, false);
    expect(getInstanceAddress(state.active[1])).toBe('0x77');

    // Now test BMI160 (0x69) + SPS-30 (0x69) collision resolved via 1-click address switch to 0x68 (SAO -> GND)
    resetEnv('kcomp-v2');
    await addComponent('bmi160', { skipUndo: true });
    await addComponent('sps30', { skipUndo: true });
    expect(computeCriticalWarnings().some((w) => w.critical && /0x69/i.test(w.text))).toBe(true);

    expect(setInstanceI2CAddress(state.active[0].instanceId, '0x68')).toBe(true);
    expect(getInstanceAddress(state.active[0])).toBe('0x68');
    expect(state.active[0].pinMap.SAO).toBeTruthy();
    expect(computeCriticalWarnings().some((w) => w.critical && /0x69/i.test(w.text))).toBe(false);
  });
});

describe('Board-Aware Dual 3.3V / 5V Power Rail Defaults & Manual Switching (v0.3.6)', () => {
  it('defaults dual-voltage modules to 3.3V on ESP32-S3 and 5V on K-Comp V2, allows manual switching with advisory, and blocks unsafe switches', async () => {
    // 1. ESP32-S3 (3.3V board): BMI160 defaults to 3.3V, can switch to 5V with gentle advisory
    resetEnv('esp32-s3-devkit');
    await addComponent('bmi160', { skipUndo: true });
    const bmiEsp = state.active[0];
    expect(moduleSupportsDualPower(getCompDef('bmi160'))).toBe(true);
    expect(getInstancePowerRail(bmiEsp)).toBe('3V3');
    expect(computeCriticalWarnings()).toHaveLength(0);

    expect(setInstancePowerRail(bmiEsp.instanceId, '5V')).toBe(true);
    expect(getInstancePowerRail(bmiEsp)).toBe('5V');
    const espAdv = computeCriticalWarnings();
    expect(espAdv.some((w) => !w.critical && w.advisory && /5V/i.test(w.text))).toBe(true);

    // Strict 3.3V-only AD8232 refuses switching to 5V!
    await addComponent('ad8232', { skipUndo: true });
    const ecg = state.active.find((i) => i.compId === 'ad8232')!;
    expect(setInstancePowerRail(ecg.instanceId, '5V')).toBe(false);
    expect(getInstancePowerRail(ecg)).toBe('3V3');

    // 2. K-Comp V2 (5V board): BMI160 defaults to 5V, can switch to 3.3V (PWR_3V3) with gentle advisory
    resetEnv('kcomp-v2');
    await addComponent('bmi160', { skipUndo: true });
    const bmiAvr = state.active[0];
    expect(getInstancePowerRail(bmiAvr)).toBe('5V');
    expect(computeCriticalWarnings()).toHaveLength(0);

    const vinSpec = getCompDef('bmi160')!.pins.find((p) => p.id === 'VIN')!;
    const suitable = getSuitableBoardPins(vinSpec, bmiAvr.instanceId, 'VIN', getCompDef('bmi160')!);
    expect(suitable.some((c) => c.id === 'PWR_3V3')).toBe(true);

    expect(setInstancePowerRail(bmiAvr.instanceId, '3V3')).toBe(true);
    expect(bmiAvr.pinMap.VIN).toBe('PWR_3V3');
    expect(getInstancePowerRail(bmiAvr)).toBe('3V3');
    expect(computeCriticalWarnings().some((w) => !w.critical && w.advisory && /3\.3V|3,3V/i.test(w.text))).toBe(true);

    // Switch back to 5V restores the I2C header VCC cleanly
    expect(setInstancePowerRail(bmiAvr.instanceId, '5V')).toBe(true);
    expect(getInstancePowerRail(bmiAvr)).toBe('5V');
    expect(computeCriticalWarnings()).toHaveLength(0);

    // Strict 5V-only MQ-2 refuses switching to 3.3V!
    await addComponent('mq2', { skipUndo: true });
    const mq2 = state.active.find((i) => i.compId === 'mq2')!;
    expect(setInstancePowerRail(mq2.instanceId, '3V3')).toBe(false);
    expect(getInstancePowerRail(mq2)).toBe('5V');
  });
});
