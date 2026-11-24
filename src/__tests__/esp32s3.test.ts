// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BOARDS,
  ESP32_S3_DEVKIT_BOARD,
  KCOMP_V2_BOARD,
  getActiveBoard,
  setActiveBoard
} from '../boards';
import { CATALOG } from '../catalog';
import { state, hooks, getActiveOnboardDefs, getNetMeta } from '../core/state';
import { initI18n } from '../i18n';
import {
  addComponent,
  computeCriticalWarnings,
  computeDipStates,
  computeSramBreakdown,
  computeUartAssignments
} from '../core/hardware';
import { buildSketchString } from '../core/codegen';
import { CODE_PROFILES, getDriverCompat, getSupportedProfiles } from '../core/code-profiles';
import { applyProjectPayload, serializeProjectPayload } from '../core/persistence';
import { allocateCarrierBreadboardConnections, getCarrierPowerRailTargets, getCarrierRowHoleTargets, renderCarrierActiveOverlay } from '../core/carrier-breadboard';
import { getBoardGeometry, isBoardCarrierActive } from '../boards';

function resetForBoard(boardId: string) {
  initI18n();
  const board = setActiveBoard(boardId);
  state.boardId = board.id;
  state.codeProfile = board.defaultCodeProfile;
  state.carrierEnabled = !!board.carrier?.defaultEnabled;
  state.carrierFeeders = [];
  state.catalog = CATALOG;
  state.active = [];
  state.placedEntries = [];
  state.breadboardRails = [];
  state.codeBlocks = [];
  state.focusedId = null;
  state.nextInst = 1;
  state.oledPaged = false;
  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) {
    state.onboard[ob.id] = false;
  }
  if (board.capabilities.hasWirelessSlot) {
    state.onboard.onboard_wireless = false;
  }

  state.svgCache.clear();
  for (const comp of CATALOG.components) {
    const dummy = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    state.svgCache.set(comp.svgFile, dummy);
  }

  hooks.recomputeAndRender = () => {};
  hooks.pushUndoState = () => {};
  hooks.flashTarget = () => {};
  hooks.resetViewFit = () => {};
  hooks.switchBoard = async (nextId: string) => {
    const b = setActiveBoard(nextId);
    state.boardId = b.id;
    state.codeProfile = b.defaultCodeProfile;
  };
}

describe('Declarative Multi-Board Schema & Mechanical Spec (v0.2.0)', () => {
  beforeEach(() => resetForBoard('esp32-s3-devkit'));

  it('registers both K-Comp V2 and ESP32-S3 DevKitC-1 with complete mechanical geometry in mm', () => {
    expect(Object.keys(BOARDS)).toEqual(['kcomp-v2', 'esp32-s3-devkit']);
    expect(KCOMP_V2_BOARD.mechanical?.widthMm).toBeGreaterThan(100);
    expect(KCOMP_V2_BOARD.mechanical?.headers.every((h) => h.pitchMm === 2.54)).toBe(true);

    const esp = getActiveBoard();
    expect(esp.id).toBe('esp32-s3-devkit');
    expect(esp.electrical.logicVoltage).toBe(3.3);
    expect(esp.capabilities.hasPinMux).toBe(true);
    expect(esp.capabilities.hardwareUartCount).toBe(3);
    expect(esp.capabilities.hasDipSwitches).toBe(false);
    expect(esp.capabilities.hasBreadboard).toBe(false);
    expect(esp.mechanical?.headers).toHaveLength(2);
    expect(esp.mechanical?.keepOutZones?.some((z) => z.id === 'ANTENNA_KEEPOUT')).toBe(true);
    expect(computeDipStates()).toEqual([]);
  });

  it('starts ESP32-S3 with all onboard features disabled and 512 KB SRAM model', () => {
    expect(state.onboard.onboard_wifi).toBe(false);
    expect(state.onboard.onboard_rgb_led).toBe(false);
    const sram = computeSramBreakdown();
    expect(sram.total).toBe(524288);
    expect(sram.used).toBe(32768);
  });
});

describe('ESP32-S3 Hardware Constraint Rules', () => {
  beforeEach(() => resetForBoard('esp32-s3-devkit'));

  it('supplies dual-voltage (3.3V/5V) modules from 3.3V without level warnings, but flags 5V-only modules', async () => {
    await addComponent('bmi160', { skipUndo: true });
    const bmi = state.active.find((a) => a.compId === 'bmi160');
    expect(bmi?.pinMap.VIN).toMatch(/^3V3_/);
    expect(bmi?.pinMap.SDA).toBe('GPIO8');
    expect(bmi?.pinMap.SCL).toBe('GPIO9');
    expect(computeCriticalWarnings()).toHaveLength(0);

    // 5V-only analog sensor (MQ-2) triggers a critical 3.3V logic-level warning
    await addComponent('mq2', { skipUndo: true });
    const warns = computeCriticalWarnings();
    expect(warns.some((w) => w.critical && /3\.3V|3,3V/i.test(w.text))).toBe(true);
  });

  it('prioritizes ADC1 for analog sensors and warns on ADC2 + Wi-Fi conflict', async () => {
    state.onboard.onboard_wifi = true;
    await addComponent('ad8232', { skipUndo: true });
    const ecg = state.active.find((a) => a.compId === 'ad8232');
    expect(ESP32_S3_DEVKIT_BOARD.capabilities.adc1Pins).toContain(ecg?.pinMap.OUTPUT);
    expect(computeCriticalWarnings().some((w) => /ADC2/i.test(w.text))).toBe(false);

    // Manually moving analog signal onto an ADC2 pin (GPIO15) while Wi-Fi is active must raise critical ADC2 conflict
    ecg!.pinMap.OUTPUT = 'GPIO15';
    expect(computeCriticalWarnings().some((w) => w.critical && /ADC2/i.test(w.text))).toBe(true);
  });

  it('avoids strapping pins automatically and raises an advisory if manually assigned', async () => {
    await addComponent('gy-neo6m', { skipUndo: true });
    const gps = state.active[0];
    const strapSet = new Set(ESP32_S3_DEVKIT_BOARD.capabilities.strappingPins);
    expect(strapSet.has(gps.pinMap.TX!)).toBe(false);
    expect(strapSet.has(gps.pinMap.RX!)).toBe(false);

    gps.pinMap.TX = 'GPIO0';
    const warns = computeCriticalWarnings();
    expect(warns.some((w) => w.advisory && w.text.includes('GPIO0'))).toBe(true);
  });

  it('assigns HW-UART1/2 with high-baud priority and falls back to SW-UART cleanly on a 3rd UART', async () => {
    await addComponent('gy-neo6m', { skipUndo: true });
    await addComponent('as608', { skipUndo: true });
    expect(computeCriticalWarnings().some((w) => /SoftwareSerial|UART/i.test(w.text))).toBe(false);

    const assigns2 = computeUartAssignments();
    const as608Inst = state.active.find((a) => a.compId === 'as608')!;
    const gpsInst = state.active.find((a) => a.compId === 'gy-neo6m')!;
    expect(assigns2[as608Inst.instanceId].kind).toBe('hw');
    expect(assigns2[as608Inst.instanceId].badgeLabel).toBe('HW-UART1');
    expect(assigns2[gpsInst.instanceId].kind).toBe('hw');
    expect(assigns2[gpsInst.instanceId].badgeLabel).toBe('HW-UART2');

    // 3rd low-baud UART (HC-12, 9600 baud) falls back to SW-UART with an advisory (not hard critical)
    await addComponent('hc12', { skipUndo: true });
    const assigns3 = computeUartAssignments();
    const hc12Inst = state.active.find((a) => a.compId === 'hc12')!;
    expect(assigns3[hc12Inst.instanceId].kind).toBe('sw');
    expect(assigns3[hc12Inst.instanceId].badgeLabel).toBe('SW-UART');
    expect(computeCriticalWarnings().some((w) => w.advisory && /Software UART|EspSoftwareSerial/i.test(w.text))).toBe(true);

    // Codegen emits Serial1, Serial2 AND EspSoftwareSerial fallback for the 3rd UART
    const code = buildSketchString([]);
    expect(code).toContain('Serial1.begin(57600');
    expect(code).toContain('Serial2.begin(9600');
    expect(code).toContain('EspSoftwareSerial::UART');
  });

  it('flags critical warning if a high-baud radar (256000 baud) is forced onto SW-UART', async () => {
    await addComponent('ld2410c', { skipUndo: true });
    await addComponent('ld2450', { skipUndo: true });
    await addComponent('as608', { skipUndo: true });

    const warns = computeCriticalWarnings();
    expect(warns.some((w) => w.critical && /baud|Software UART/i.test(w.text))).toBe(true);
  });

  it('mounts ESP32-S3 centered on Breadboard by default with Left 3.3V/GND & Right 5V/GND rails', () => {
    expect(isBoardCarrierActive(ESP32_S3_DEVKIT_BOARD, state.carrierEnabled)).toBe(true);
    const geomOn = getBoardGeometry(ESP32_S3_DEVKIT_BOARD, true);
    const geomOff = getBoardGeometry(ESP32_S3_DEVKIT_BOARD, false);
    expect(geomOn.carrierActive).toBe(true);
    expect(geomOff.carrierActive).toBe(false);
    expect(geomOn.width).toBeGreaterThan(geomOff.width);

    // Allocate 3.3V, 5V, GND (left & right), and GPIO4 signal wires on carrier breadboard
    const jobs: any[] = [
      { bpId: '3V3_L1', p: { id: 'VCC', color: '#fb923c' }, net: { id: 'NET_3V3' }, start: { x: 150, y: 200 }, end: { x: 540, y: 140 } },
      { bpId: '5V_L',   p: { id: '5V',  color: '#ef4444' }, net: { id: 'NET_5V' },  start: { x: 1120, y: 300 }, end: { x: 540, y: 500 } },
      { bpId: 'GND_L1', p: { id: 'GND', color: '#64748b' }, net: { id: 'NET_GND' }, start: { x: 150, y: 240 }, end: { x: 540, y: 520 } },
      { bpId: 'GND_R1', p: { id: 'GND', color: '#64748b' }, net: { id: 'NET_GND' }, start: { x: 1120, y: 240 }, end: { x: 760, y: 140 } },
      { bpId: 'GPIO4',  p: { id: 'OUT', color: '#22c55e' }, net: { id: 'GPIO4' },   start: { x: 150, y: 180 }, end: { x: 540, y: 180 } }
    ];
    const res = allocateCarrierBreadboardConnections(jobs);
    expect(jobs[0].carrierHole?.railId).toBe('BB_L_3V3');
    expect(jobs[1].carrierHole?.railId).toBe('BB_R_5V');
    expect(jobs[2].carrierHole?.railId).toBe('BB_L_GND');
    expect(jobs[3].carrierHole?.railId).toBe('BB_R_GND');
    expect(jobs[4].carrierHole?.kind).toBe('row');
    expect(res.feeders).toHaveLength(4);
    expect(res.activeRailIds.size).toBe(4);
    expect(res.activeStrips.length).toBeGreaterThan(0);
    for (const st of res.activeStrips) {
      expect(Number.isFinite(st.x1)).toBe(true);
      expect(Number.isFinite(st.x2)).toBe(true);
      expect(Number.isFinite(st.y)).toBe(true);
    }
    // Render active overlay into real jsdom SVG layer — must not throw!
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const activeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    activeLayer.setAttribute('id', 'kcomp-carrier-active');
    svg.appendChild(activeLayer);
    document.body.appendChild(svg);
    expect(() => renderCarrierActiveOverlay(res.activeStrips, res.activeRailIds)).not.toThrow();
    expect(activeLayer.querySelectorAll('line').length).toBe(res.activeRailIds.size + res.activeStrips.length);
    svg.remove();

    // getNetMeta classifies all ESP32-S3 power/GND/I2C pins cleanly via board caps
    expect(getNetMeta('3V3_L1').id).toBe('NET_3V3');
    expect(getNetMeta('3V3_L2').id).toBe('NET_3V3');
    expect(getNetMeta('5V_L').id).toBe('NET_5V');
    expect(getNetMeta('GND_L1').id).toBe('NET_GND');
    expect(getNetMeta('GND_R2').id).toBe('NET_GND');
    expect(getNetMeta('GPIO8').id).toBe('NET_I2C_SDA');
    expect(getNetMeta('GPIO9').id).toBe('NET_I2C_SCL');

    // Every ESP32 row exposes all 4 individual breadboard tie-point holes (e.g. 1a, 1b, 1c, 1d)
    const row1Targets = getCarrierRowHoleTargets('3V3_L1', ESP32_S3_DEVKIT_BOARD.pins['3V3_L1']);
    expect(row1Targets).toHaveLength(4);
    expect(row1Targets.some((t) => t.snapLabel === '1b · 3V3_L1' && t.carrierRowHoleIdx === 2)).toBe(true);

    // Explicit rail drag targets expose individual holes along both Left and Right GND rails
    const gndTargets = getCarrierPowerRailTargets({ role: 'GND', allowedTypes: ['GND'] });
    expect(new Set(gndTargets.map((t) => t.carrierRailId))).toEqual(new Set(['BB_L_GND', 'BB_R_GND']));

    // Moving a 3.3V wire specifically onto hole 1b ('hole:2' on 3V3_L1) or onto an exact power rail hole ('rail:BB_R_GND:5')
    const manualJobs: any[] = [
      { bpId: '3V3_L1', p: { id: 'VCC', color: '#fb923c' }, net: getNetMeta('3V3_L1'), start: { x: 150, y: 120 }, end: { x: 540, y: 140 }, carrierRailPref: 'hole:2' },
      { bpId: 'GND_L1', p: { id: 'GND', color: '#64748b' }, net: getNetMeta('GND_L1'), start: { x: 150, y: 240 }, end: { x: 540, y: 520 }, carrierRailPref: 'rail:BB_R_GND:5' }
    ];
    allocateCarrierBreadboardConnections(manualJobs);
    expect(manualJobs[0].carrierHole?.kind).toBe('row');
    expect(manualJobs[0].carrierHole?.label).toBe('1b');
    expect(manualJobs[0].carrierHole?.holeIdx).toBe(2);
    expect(manualJobs[1].carrierHole?.kind).toBe('rail');
    expect(manualJobs[1].carrierHole?.railId).toBe('BB_R_GND');
    expect(manualJobs[1].carrierHole?.holeIdx).toBe(5);
  });

  it('blocks K-Comp V2 onboard wireless slot modules (HC-05 / ESP-01) on ESP32-S3', async () => {
    await addComponent('hc05', { skipUndo: true });
    expect(state.active).toHaveLength(0);
  });
});

describe('Extensible CodeProfile Engine & Project Format v24 Backward Compatibility', () => {
  beforeEach(() => resetForBoard('esp32-s3-devkit'));

  it('exposes future code profile extension slots (oss-standard, bare-metal, python-node)', () => {
    expect(CODE_PROFILES['oss-standard']).toBeDefined();
    expect(CODE_PROFILES['bare-metal']).toBeDefined();
    expect(CODE_PROFILES['python-node']).toBeDefined();
    expect(getSupportedProfiles(ESP32_S3_DEVKIT_BOARD).map((p) => p.id)).toEqual(['generic-scaffold', 'kcomp-portable']);
    expect(getDriverCompat('bmi160', ESP32_S3_DEVKIT_BOARD)).toBe('portable-untested');
    expect(getDriverCompat('sg90-180', ESP32_S3_DEVKIT_BOARD)).toBe('avr-only');
  });

  it('generates clean Wire.begin(SDA, SCL) + HardwareSerial scaffold on ESP32-S3 without SoftwareSerial', async () => {
    state.codeProfile = 'generic-scaffold';
    await addComponent('bmi160', { skipUndo: true });
    await addComponent('gy-neo6m', { skipUndo: true });

    const code = buildSketchString([]);
    expect(code).toContain('#define I2C_SDA_PIN 8');
    expect(code).toContain('#define I2C_SCL_PIN 9');
    expect(code).toContain('Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);');
    expect(code).toContain('Serial1.begin(9600, SERIAL_8N1');
    expect(code).not.toContain('SoftwareSerial');
    expect(code).not.toMatch(/Arduino/i);
  });

  it('supports opt-in kcomp-portable (Beta) with automatic fallback for AVR-only modules', async () => {
    state.codeProfile = 'kcomp-portable';
    await addComponent('bmi160', { skipUndo: true });
    await addComponent('gy-neo6m', { skipUndo: true });

    const code = buildSketchString([]);
    expect(code).toContain('#include <kcomp_GYBMI160.h>');
    expect(code).toContain('BETA: GY-BMI160');
    expect(code).toContain('ATmega328P-only');
    expect(code).toContain('Serial1.begin');
  });

  it('serializes v24 target.nodes payload and cleanly loads legacy v0.1.x payloads as kcomp-v2', async () => {
    await addComponent('bmi160', { skipUndo: true });
    const v24 = serializeProjectPayload();
    expect(v24.v).toBe(24);
    expect(v24.b).toBe('esp32-s3-devkit');
    expect(v24.target.nodes).toHaveLength(1);
    expect(v24.target.nodes[0].boardId).toBe('esp32-s3-devkit');

    // Legacy v0.1.x payload without 'b' or 'target' must switch cleanly to kcomp-v2
    const legacyV23 = {
      v: 23,
      name: 'LegacyBot',
      ob: { onboard_oled: true },
      pg: false,
      act: [{ id: 'bmi160', h: 'H2', pm: { VIN: 'H2_VCC', GND: 'H2_GND', SCL: 'H2_SCL', SDA: 'H2_SDA' } }]
    };
    await applyProjectPayload(legacyV23, false);
    expect(getActiveBoard().id).toBe('kcomp-v2');
    expect(state.boardId).toBe('kcomp-v2');
    expect(state.onboard.onboard_oled).toBe(true);
    expect(state.active).toHaveLength(1);
  });
});
