// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, expect, it } from 'vitest';
import { setActiveBoard } from '../boards';
import { CATALOG } from '../catalog';
import { state, getActiveOnboardDefs } from '../core/state';
import { initI18n } from '../i18n';
import { addComponent } from '../core/hardware';
import { appBus, projectStore, type DerivedWorkspace } from '../store';

function resetStoreTest(boardId = 'esp32-s3-devkit') {
  initI18n();
  projectStore.reset();
  const board = setActiveBoard(boardId);
  state.boardId = board.id;
  state.codeProfile = board.defaultCodeProfile;
  state.carrierEnabled = Boolean(board.carrier?.defaultEnabled);
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
}

describe('Typed AppBus & Central ProjectStore (v0.3.1)', () => {
  beforeEach(() => resetStoreTest('esp32-s3-devkit'));

  it('derives complete workspace snapshot (board, DIP, UART, warnings, SRAM, current, netlist) in a single pass', async () => {
    const snapshots: DerivedWorkspace[] = [];
    const unsubscribe = projectStore.subscribe((derived) => {
      snapshots.push(derived);
    });

    // Adding a component emits workspace:recompute -> triggers projectStore.recompute() -> notifies subscribers!
    await addComponent('bmi160', { skipUndo: true });
    await addComponent('gy-neo6m', { skipUndo: true });

    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    const latest = projectStore.getDerived();
    expect(latest.board.id).toBe('esp32-s3-devkit');
    expect(latest.netlist.stats.i2cDevices).toBe(1);
    expect(latest.netlist.stats.uartChannels).toBe(1);
    expect(Object.values(latest.uartAssignments)[0]?.badgeLabel).toBe('HW-UART1');
    expect(latest.sram.total).toBe(524288);
    expect(latest.usbCurrent.total).toBeGreaterThan(80);
    expect(latest.warnings).toHaveLength(0);

    // Unsubscribing cleanly stops further notifications
    const beforeCount = snapshots.length;
    unsubscribe();
    appBus.emit('workspace:recompute');
    expect(snapshots.length).toBe(beforeCount);
  });

  it('supports typed command handlers (handle/invoke) and clean reset()', () => {
    expect(appBus.invoke('history:captureSnapshot')).toBeUndefined();

    const unhandle = appBus.handle('history:captureSnapshot', () => '{"ok":true}');
    expect(appBus.invoke('history:captureSnapshot')).toBe('{"ok":true}');

    unhandle();
    expect(appBus.invoke('history:captureSnapshot')).toBeUndefined();
  });

  it('routes hover, tooltip, and modal events cleanly across decoupled modules without hooks', () => {
    const seen: string[] = [];
    appBus.on('hover:net', ({ netId }) => seen.push(`net:${netId}`));
    appBus.on('tooltip:hide', () => seen.push('tip:hide'));
    appBus.on('modal:openComponentInfo', ({ compId }) => seen.push(`info:${compId}`));

    appBus.emit('hover:net', { netId: 'NET_3V3' });
    appBus.emit('tooltip:hide');
    appBus.emit('modal:openComponentInfo', { compId: 'bmi160' });

    expect(seen).toEqual(['net:NET_3V3', 'tip:hide', 'info:bmi160']);
  });
});
