// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import { setActiveBoard } from '../boards';
import { state, getActiveOnboardDefs } from '../core/state';
import { projectStore } from '../store';
import { initI18n } from '../i18n';
import { addComponent, computeDipStates } from '../core/hardware';
import { allocateBreadboardRails } from '../core/breadboard';
import { buildSketchString } from '../core/codegen';
import { addCodeBlock } from '../core/code-blocks';

function resetAll() {
  initI18n();
  setActiveBoard('kcomp-v2');
  state.boardId = 'kcomp-v2';
  state.codeProfile = 'kcomp-avr';
  state.catalog = CATALOG;
  state.active = [];
  state.codeBlocks = [];
  state.nextInst = 1;
  state.nextBlockInst = 1;
  state.oledPaged = false;
  state.projectName = 'UnitTestBot';
  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) {
    state.onboard[ob.id] = false;
  }
  state.onboard.onboard_wireless = false;

  state.svgCache.clear();
  for (const comp of CATALOG.components) {
    const dummy = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    state.svgCache.set(comp.svgFile, dummy);
  }

  projectStore.reset();
}

describe('Breadboard Rail Allocator', () => {
  beforeEach(resetAll);

  it('separates top (+5V) and bottom (GND) breadboard halves when shared rails overflow', () => {
    const wireJobs = [
      { bpId: 'PWR_5V', p: { id: 'VCC', color: '#ef4444' }, start: { x: 100, y: 100 }, end: { x: 400, y: 400 } },
      { bpId: 'PWR_5V', p: { id: 'VCC', color: '#ef4444' }, start: { x: 120, y: 100 }, end: { x: 400, y: 400 } },
      { bpId: 'PWR_GND1', p: { id: 'GND', color: '#64748b' }, start: { x: 100, y: 200 }, end: { x: 410, y: 400 } },
      { bpId: 'PWR_GND1', p: { id: 'GND', color: '#64748b' }, start: { x: 120, y: 200 }, end: { x: 410, y: 400 } }
    ];

    const rails = allocateBreadboardRails(wireJobs);
    const vccRail = rails.find((r) => r.bpId === 'PWR_5V');
    const gndRail = rails.find((r) => r.bpId === 'PWR_GND1');

    expect(vccRail).toBeDefined();
    expect(gndRail).toBeDefined();
    expect(vccRail.half).toBe('T');
    expect(gndRail.half).toBe('B');
    expect(vccRail.isI2cExpansion).toBe(false);
    expect(gndRail.isI2cExpansion).toBe(false);
  });

  it('allocates a dedicated bottom-half I2C hub when 2+ I2C modules share H3', () => {
    const makeI2cJobs = (yOffset: number) => ([
      { bpId: 'H3_VCC', p: { id: 'VCC', role: 'I2C_VCC', color: '#ef4444' }, start: { x: 900, y: 300 + yOffset }, end: { x: 800, y: 350 } },
      { bpId: 'H3_GND', p: { id: 'GND', role: 'I2C_GND', color: '#64748b' }, start: { x: 900, y: 310 + yOffset }, end: { x: 800, y: 360 } },
      { bpId: 'H3_SCL', p: { id: 'SCL', role: 'I2C_SCL', color: '#f59e0b' }, start: { x: 900, y: 320 + yOffset }, end: { x: 800, y: 370 } },
      { bpId: 'H3_SDA', p: { id: 'SDA', role: 'I2C_SDA', color: '#38bdf8' }, start: { x: 900, y: 330 + yOffset }, end: { x: 800, y: 380 } }
    ]);

    const rails = allocateBreadboardRails([...makeI2cJobs(0), ...makeI2cJobs(40)]);
    expect(rails).toHaveLength(4);
    for (const r of rails) {
      expect(r.isI2cExpansion).toBe(true);
      expect(r.half).toBe('B');
      expect(r.i2cHeader).toBe('H3');
    }
  });
});

describe('Flat-C Sketch Code Generator', () => {
  beforeEach(resetAll);

  it('generates clean .ino sketch with OLED paged toggle, fail-fast checks, and structure blocks', async () => {
    state.onboard.onboard_oled = true;
    state.oledPaged = true;
    await addComponent('bmi160', { skipUndo: true });
    await addComponent('sg90-180', { pinOverrides: { PWM: 'D9' }, skipUndo: true });
    addCodeBlock('fsm');

    const sketch = buildSketchString(computeDipStates());
    expect(sketch).toContain('#include <kcomp_oled_paged.h>');
    expect(sketch).toContain('#include <kcomp_GYBMI160.h>');
    expect(sketch).toContain('#include <kcomp_servosg90.h>');
    expect(sketch).toContain('UnitTestBot');
    expect(sketch).toContain('void setup()');
    expect(sketch).toContain('void loop()');
    expect(sketch).toContain('uint8_t gameState = STATE_MENU;');
    expect(sketch).not.toMatch(/Arduino/i);
  });

  it('keeps the header comment intact when the project name contains */ or line breaks', () => {
    state.projectName = 'Test */ int x = 1; /*\nsecond line';
    const sketch = buildSketchString(computeDipStates());
    const header = sketch.slice(0, sketch.indexOf('*/') + 2);
    expect(header).toContain(' * Project: Test * / int x = 1; /* second line');
    expect(header).toContain('Generated with');
  });
});
