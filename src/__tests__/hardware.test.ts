// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, expect, it } from 'vitest';
import { getActiveBoard, KCOMP_V2_BOARD } from '../boards';
import { CATALOG } from '../catalog';
import { setActiveBoard } from '../boards';
import { state, hooks } from '../core/state';
import { initI18n } from '../i18n';
import { allocateBreadboardRails, getBreadboardDropTarget } from '../core/breadboard';
import {
  addComponent,
  autoConnectPendingPins,
  canAddComponent,
  computeCriticalWarnings,
  computeDipStates,
  computeSramBreakdown,
  computeUsbCurrent,
  getCompDef,
  getPendingPins,
  pickDefaultI2CHeader,
  rebalanceOverflowPowerPins,
  removeComponent,
  setPowerRailMode,
  toggleDipSwitch,
  toggleOnboardComponent
} from '../core/hardware';

function resetWorkbenchState() {
  initI18n();
  setActiveBoard('kcomp-v2');
  state.boardId = 'kcomp-v2';
  state.codeProfile = 'kcomp-avr';
  state.catalog = CATALOG;
  state.active = [];
  state.placedEntries = [];
  state.breadboardRails = [];
  state.codeBlocks = [];
  state.powerRailMode = 'smart';
  state.focusedId = null;
  state.nextInst = 1;
  state.oledPaged = false;
  state.onboard = {};
  for (const ob of CATALOG.onboard) {
    state.onboard[ob.id] = false;
  }
  state.onboard.onboard_wireless = false;

  // Stub SVG cache so addComponent() runs fully offline in jsdom
  state.svgCache.clear();
  for (const comp of CATALOG.components) {
    const dummy = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    state.svgCache.set(comp.svgFile, dummy);
  }

  // Silence UI hooks during pure hardware unit tests
  hooks.recomputeAndRender = () => {};
  hooks.pushUndoState = () => {};
  hooks.flashTarget = () => {};
}

describe('K-Comp V2 Board Profile & Blank Board Defaults', () => {
  beforeEach(resetWorkbenchState);

  it('exposes the K-Comp V2 board profile with 2 KB SRAM and 8 DIP switches', () => {
    const board = getActiveBoard();
    expect(board.id).toBe('kcomp-v2');
    expect(board.sramTotal).toBe(2048);
    expect(board.sramBaseOverhead).toBe(210);
    expect(board.dipSwitches).toHaveLength(8);
    expect(Object.keys(board.i2cHeaders)).toEqual(['H1', 'H2', 'H3']);
    expect(board.electrical.logicVoltage).toBe(5);
  });

  it('starts on a blank board with all onboard peripherals disabled and DIP S1-1 locked ON', () => {
    for (const ob of CATALOG.onboard) {
      expect(state.onboard[ob.id]).toBe(false);
    }
    expect(state.onboard.onboard_wireless).toBe(false);

    const dips = computeDipStates();
    expect(dips.find((d) => d.id === 1)?.on).toBe(true);
    for (let id = 2; id <= 8; id++) {
      expect(dips.find((d) => d.id === id)?.on).toBe(false);
    }

    // Attempt to turn off locked Auto-Reset switch S1-1 must have no effect
    toggleDipSwitch(1);
    expect(computeDipStates().find((d) => d.id === 1)?.on).toBe(true);
  });
});

describe('Hardware Constraint Engine — Pin Governance & Conflicts', () => {
  beforeEach(resetWorkbenchState);

  it('never silently disables active onboard peripherals and auto-connects once freed', async () => {
    // Enable onboard START (D3) and add an external module on D2 so both interrupt pins are occupied
    state.onboard.onboard_start = true;
    await addComponent('ir-rx', { pinOverrides: { OUT: 'D2' }, skipUndo: true });
    // Now add a second interrupt-requiring or analog-exhausted case:
    // Use potentiometer (A0) + joystick (A1/A2) + analog sensor on A3 -> no analog pins left
    state.onboard.onboard_pot = true;
    state.onboard.onboard_joystick = true;
    await addComponent('soil-moisture', { pinOverrides: { AOUT: 'A3' }, skipUndo: true });

    // Adding MQ-2 (needs ANALOG pin) must NOT disable onboard potentiometer (A0)
    await addComponent('mq2', { skipUndo: true });
    expect(state.onboard.onboard_pot).toBe(true);
    expect(state.onboard.onboard_joystick).toBe(true);

    const pending = getPendingPins();
    expect(pending.some((p) => p.def.id === 'mq2')).toBe(true);

    const warns = computeCriticalWarnings();
    expect(warns.some((w) => w.actionNeeded)).toBe(true);

    // Manually freeing onboard potentiometer (S1-3) auto-connects the pending MQ-2 pin to A0
    toggleOnboardComponent('onboard_pot');
    expect(state.onboard.onboard_pot).toBe(false);
    expect(getPendingPins()).toHaveLength(0);
    const mq2 = state.active.find((a) => a.compId === 'mq2');
    expect(mq2?.pinMap.AO).toBe('A0');
  });

  it('detects I2C address collisions between onboard OLED (0x3C) or two modules on the same address', async () => {
    // VL53L1X and TCS34725 both use 0x29
    await addComponent('vl53l1x', { skipUndo: true });
    await addComponent('tcs34725', { skipUndo: true });

    const warns = computeCriticalWarnings();
    expect(warns.some((w) => w.critical && w.text.includes('0x29'))).toBe(true);
  });

  it('flags direct DC motor without TB6612FNG driver and clears warning once driver is added', async () => {
    await addComponent('dc-motor', { skipUndo: true });
    expect(computeCriticalWarnings().some((w) => w.critical && /TB6612FNG/i.test(w.text))).toBe(true);

    await addComponent('tb6612fng', { skipUndo: true });
    expect(computeCriticalWarnings().some((w) => w.critical && /TB6612FNG/i.test(w.text))).toBe(false);
  });

  it('differentiates SoftwareSerial TX-only (CH9329 + 1 RX UART = advisory) vs 2 RX UARTs (critical)', async () => {
    await addComponent('ch9329', { skipUndo: true });
    await addComponent('hc12', { skipUndo: true });

    const warnsTxOnly = computeCriticalWarnings();
    const uartAdvisory = warnsTxOnly.find((w) => w.advisory && !w.critical);
    expect(uartAdvisory).toBeDefined();
    expect(warnsTxOnly.some((w) => w.critical && /SoftwareSerial|UART/i.test(w.text))).toBe(false);

    // Adding a second RX-listening UART (GY-NEO6M GPS) escalates to a critical warning
    await addComponent('gy-neo6m', { skipUndo: true });
    const warnsMultiRx = computeCriticalWarnings();
    expect(warnsMultiRx.some((w) => w.critical && /SoftwareSerial|UART/i.test(w.text))).toBe(true);
  });

  it('detects wireless slot conflict when HC-05 and ESP-01 are both placed', async () => {
    await addComponent('hc05', { skipUndo: true });
    const dipsOne = computeDipStates();
    expect(dipsOne.find((d) => d.id === 7)?.on).toBe(true);
    expect(dipsOne.find((d) => d.id === 8)?.on).toBe(true);

    await addComponent('esp8266', { skipUndo: true });
    const warns = computeCriticalWarnings();
    expect(warns.some((w) => w.critical && /HC-05|ESP|Wireless/i.test(w.text))).toBe(true);
  });

  it('flags ultrasonic conflict if onboard distance sensor is active while D10/D11 are claimed externally', async () => {
    await addComponent('sg90-180', { pinOverrides: { PWM: 'D10' }, skipUndo: true });
    state.onboard.onboard_distance = true;

    const warns = computeCriticalWarnings();
    expect(warns.some((w) => w.critical && /D10|D11|Ultrasonic|Ultraschall/i.test(w.text))).toBe(true);
  });

  it('allocates I2C headers H2 -> H1 -> H3 and routes 4th+ I2C module onto shared H3 hub', async () => {
    await addComponent('bmi160', { skipUndo: true });
    await addComponent('aht10', { skipUndo: true });
    await addComponent('gy302', { skipUndo: true });
    await addComponent('bmp280', { skipUndo: true });

    const headers = state.active.map((a) => a.i2cHeader);
    expect(headers).toEqual(['H2', 'H1', 'H3', 'H3']);
    expect(pickDefaultI2CHeader()).toBe('H3');
  });

  it('allocates free board GND/5V pins before breadboard overflow and relocates borrowed I2C header pins', async () => {
    // Place 4 non-I2C 5V modules -> should spread across PWR_5V and unused H1/H3/H2 VCC pins without duplicates
    await addComponent('sg90-180', { skipUndo: true });
    await addComponent('sg90-360', { skipUndo: true });
    await addComponent('ir-rx', { skipUndo: true });
    await addComponent('ds18b20', { skipUndo: true });

    const vccPins = state.active.map((inst) => {
      const def = getCompDef(inst.compId);
      const p5 = def.pins.find((p) => p.role === 'POWER_5V');
      return p5 ? inst.pinMap[p5.id] : null;
    });
    expect(new Set(vccPins).size).toBe(4);

    // Adding an I2C module claiming H2 must relocate any borrowed H2_VCC/H2_GND pins away from H2
    await addComponent('bmi160', { i2cHeader: 'H2', skipUndo: true });
    const nonI2cUsingH2 = state.active
      .filter((inst) => inst.compId !== 'bmi160')
      .some((inst) => Object.values(inst.pinMap).some((bp) => bp === 'H2_VCC' || bp === 'H2_GND'));
    expect(nonI2cUsingH2).toBe(false);

    // Removing a component triggers power-pin rebalancing cleanly
    const toRemove = state.active.find((inst) => inst.compId === 'ds18b20');
    expect(toRemove).toBeDefined();
    removeComponent(toRemove!.instanceId);
    expect(state.active.some((inst) => inst.compId === 'ds18b20')).toBe(false);
    expect(autoConnectPendingPins()).toEqual([]);
  });

  it('calculates 2 KB SRAM breakdown accurately including OLED Full vs Paged savings', () => {
    const empty = computeSramBreakdown();
    expect(empty.used).toBe(KCOMP_V2_BOARD.sramBaseOverhead);
    expect(empty.total).toBe(2048);

    state.onboard.onboard_oled = true;
    state.oledPaged = false;
    const fullOled = computeSramBreakdown();
    expect(fullOled.used).toBe(210 + 1024);

    state.oledPaged = true;
    const pagedOled = computeSramBreakdown();
    expect(pagedOled.used).toBe(210 + 160);
    expect(fullOled.used - pagedOled.used).toBe(864);
  });

  it('allows manually placing shared GND/5V pins on breadboard rails even when isolated pins are free', async () => {
    await addComponent('sg90-180', { skipUndo: true });
    await addComponent('ir-rx', { skipUndo: true });

    // Default smart mode uses two isolated GND pins (PWR_GND1 and PWR_GND2)
    const servo = state.active.find((a) => a.compId === 'sg90-180')!;
    const ir = state.active.find((a) => a.compId === 'ir-rx')!;
    expect(servo.pinMap.GND).toBe('PWR_GND1');
    expect(ir.pinMap.GND).toBe('PWR_GND2');

    // Simulate user manually dragging IR-RX GND onto the red Breadboard GND drop target!
    const gndSpec = getCompDef('ir-rx').pins.find((p) => p.id === 'GND')!;
    const bbTarget = getBreadboardDropTarget(gndSpec, []);
    expect(bbTarget).not.toBeNull();
    expect(bbTarget!.boardPinId).toBe('PWR_GND1');
    expect(bbTarget!.forceBreadboard).toBe(true);

    ir.pinMap.GND = bbTarget!.boardPinId;
    ir.bbPins = { GND: true };

    // Rebalance must NOT undo the user's manual Breadboard GND placement!
    rebalanceOverflowPowerPins();
    expect(ir.pinMap.GND).toBe('PWR_GND1');
    expect(ir.bbPins.GND).toBe(true);

    // Even a single forced wire allocates its own breadboard GND rail
    const singleJob = [
      { bpId: 'PWR_GND1', p: { id: 'GND', color: '#64748b' }, start: { x: 100, y: 200 }, end: { x: 410, y: 400 }, forceBreadboard: true }
    ];
    const singleRails = allocateBreadboardRails(singleJob);
    expect(singleRails).toHaveLength(1);
    expect(singleRails[0].bpId).toBe('PWR_GND1');
    expect(singleRails[0].half).toBe('B');

    // Switching global Power / GND mode to 'rail' consolidates all shared GND & 5V onto common breadboard rails
    setPowerRailMode('rail', { skipUndo: true, silent: true });
    expect(servo.pinMap.GND).toBe('PWR_GND1');
    expect(ir.pinMap.GND).toBe('PWR_GND1');
    expect(servo.pinMap['5V']).toBe('PWR_5V');
    expect(ir.pinMap.VCC).toBe('PWR_5V');

    // Newly added module in 'rail' mode also joins the shared breadboard rails directly
    await addComponent('ds18b20', { skipUndo: true });
    const temp = state.active.find((a) => a.compId === 'ds18b20')!;
    expect(temp.pinMap.GND).toBe('PWR_GND1');
    expect(temp.pinMap['5V']).toBe('PWR_5V');

    // Switching back to 'smart' spreads wires cleanly across isolated board pins again
    setPowerRailMode('smart', { skipUndo: true, silent: true });
    expect(new Set([servo.pinMap.GND, ir.pinMap.GND, temp.pinMap.GND]).size).toBe(3);
  });

  it('estimates 5V USB current and warns at >= 450 mA', async () => {
    const idle = computeUsbCurrent();
    expect(idle.total).toBe(CATALOG.baseCurrentMa);

    // MQ gas sensors draw ~150 mA each; 3 MQ sensors + 45 mA base >= 495 mA -> triggers USB warning
    await addComponent('mq2', { skipUndo: true });
    await addComponent('mq3', { skipUndo: true });
    await addComponent('mq7', { skipUndo: true });

    const loaded = computeUsbCurrent();
    expect(loaded.total).toBeGreaterThanOrEqual(450);
    expect(computeCriticalWarnings().some((w) => w.critical && /mA|USB/i.test(w.text))).toBe(true);
    expect(canAddComponent('mq2')).toBe(false);
  });
});
