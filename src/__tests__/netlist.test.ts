// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, expect, it } from 'vitest';
import { ESP32_S3_DEVKIT_BOARD, KCOMP_V2_BOARD, setActiveBoard } from '../boards';
import { CATALOG } from '../catalog';
import { state, getActiveOnboardDefs } from '../core/state';
import { projectStore } from '../store';
import { initI18n } from '../i18n';
import {
  addComponent,
  computeCriticalWarnings,
  computeUartAssignments,
  reassignComponentPin
} from '../core/hardware';
import { deriveElectricalNetlist } from '../core/netlist';

function setupBoard(boardId: string) {
  initI18n();
  const board = setActiveBoard(boardId);
  state.boardId = board.id;
  state.codeProfile = board.defaultCodeProfile;
  state.carrierEnabled = !!board.carrier?.defaultEnabled;
  state.catalog = CATALOG;
  state.active = [];
  state.breadboardRails = [];
  state.carrierFeeders = [];
  state.carrierWireMap = {};
  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) state.onboard[ob.id] = false;
  if (board.capabilities.hasWirelessSlot) state.onboard.onboard_wireless = false;

  state.svgCache.clear();
  for (const comp of CATALOG.components) {
    state.svgCache.set(comp.svgFile, document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  }

  projectStore.reset();
}

describe('Pure Headless Electrical Netlist Engine (v0.2.9)', () => {
  beforeEach(() => setupBoard('esp32-s3-devkit'));

  it('derives normalized power, I2C, and HW-UART nets on ESP32-S3 without any DOM dependency', async () => {
    await addComponent('bmi160', { skipUndo: true });
    await addComponent('aht10', { skipUndo: true });
    await addComponent('gy-neo6m', { skipUndo: true });

    const netlist = deriveElectricalNetlist({
      board: ESP32_S3_DEVKIT_BOARD,
      catalog: CATALOG,
      active: state.active,
      onboard: state.onboard,
      carrierEnabled: true,
      uartAssignments: computeUartAssignments()
    });

    expect(netlist.boardId).toBe('esp32-s3-devkit');
    expect(netlist.logicVoltage).toBe(3.3);
    expect(netlist.unconnectedPins).toHaveLength(0);
    expect(netlist.stats.i2cDevices).toBe(2);
    expect(netlist.stats.uartChannels).toBe(1);

    const net3v3 = netlist.nets.find((n) => n.id === 'NET_3V3');
    const netSda = netlist.nets.find((n) => n.id === 'NET_I2C_SDA');
    const uartNets = netlist.nets.filter((n) => n.kind === 'uart');

    expect(net3v3?.endpoints.length).toBe(3);
    expect(netSda?.endpoints.length).toBe(2);
    expect(uartNets.length).toBe(2);
    expect(uartNets.every((u) => u.uartKind === 'hw' && u.uartChannel === 1)).toBe(true);
  });

  it('tracks K-Comp V2 I2C devices including onboard OLED cleanly', async () => {
    setupBoard('kcomp-v2');
    state.onboard.onboard_oled = true;
    await addComponent('bmi160', { skipUndo: true });

    const netlist = deriveElectricalNetlist({
      board: KCOMP_V2_BOARD,
      catalog: CATALOG,
      active: state.active,
      onboard: state.onboard
    });

    expect(netlist.boardId).toBe('kcomp-v2');
    expect(netlist.logicVoltage).toBe(5);
    expect(netlist.stats.i2cDevices).toBe(2);
  });
});

describe('ESP32-S3 1-Click Warning Quick-Fix Actions', () => {
  beforeEach(() => setupBoard('esp32-s3-devkit'));

  it('provides a 1-click quick-fix to move an ADC2 analog sensor onto a Wi-Fi-safe ADC1 pin', async () => {
    state.onboard.onboard_wifi = true;
    await addComponent('ad8232', { skipUndo: true });
    const ecg = state.active[0];
    ecg.pinMap.OUTPUT = 'GPIO15';

    const warns = computeCriticalWarnings();
    const adc2Warn = warns.find((w) => w.critical && /ADC2/i.test(w.text));
    expect(adc2Warn).toBeDefined();
    expect(adc2Warn!.quickActions).toHaveLength(1);

    const qa = adc2Warn!.quickActions![0].pinReassign!;
    expect(ESP32_S3_DEVKIT_BOARD.capabilities.adc1Pins).toContain(qa.newPinId);

    expect(reassignComponentPin(qa.instanceId, qa.compPinId, qa.newPinId)).toBe(true);
    expect(ecg.pinMap.OUTPUT).toBe(qa.newPinId);
    expect(computeCriticalWarnings().some((w) => /ADC2/i.test(w.text))).toBe(false);
  });

  it('provides a 1-click quick-fix to move a module off a strapping pin (GPIO0)', async () => {
    await addComponent('gy-neo6m', { skipUndo: true });
    const gps = state.active[0];
    gps.pinMap.TX = 'GPIO0';

    const warns = computeCriticalWarnings();
    const strapWarn = warns.find((w) => w.advisory && w.text.includes('GPIO0'));
    expect(strapWarn).toBeDefined();
    expect(strapWarn!.quickActions).toHaveLength(1);

    const qa = strapWarn!.quickActions![0].pinReassign!;
    expect(ESP32_S3_DEVKIT_BOARD.capabilities.strappingPins).not.toContain(qa.newPinId);

    reassignComponentPin(qa.instanceId, qa.compPinId, qa.newPinId);
    expect(computeCriticalWarnings().some((w) => w.text.includes('GPIO0'))).toBe(false);
  });
});
