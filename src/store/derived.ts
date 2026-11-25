// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Single-Pass Workspace Hardware Derivation (DIP, UART, Warnings, SRAM, USB Current & Electrical Netlist)
import { getActiveBoard, isBoardCarrierActive } from '../boards';
import { CATALOG } from '../catalog';
import { state } from '../core/state';
import {
  computeCriticalWarnings,
  computeDipStates,
  computeSramBreakdown,
  computeUartAssignments,
  computeUsbCurrent
} from '../core/hardware';
import { deriveElectricalNetlist } from '../core/netlist';
import type { DerivedWorkspace } from './bus';

export function deriveWorkspace(): DerivedWorkspace {
  const board = getActiveBoard();
  const catalog = state.catalog || CATALOG;
  const dipStates = computeDipStates();
  const uartAssignments = computeUartAssignments();
  const warnings = computeCriticalWarnings();
  const sram = computeSramBreakdown();
  const usbCurrent = computeUsbCurrent();
  const netlist = deriveElectricalNetlist({
    board,
    catalog,
    active: state.active,
    onboard: state.onboard,
    carrierEnabled: isBoardCarrierActive(board, state.carrierEnabled),
    uartAssignments,
    carrierWireMap: state.carrierWireMap,
    breadboardRails: state.breadboardRails
  });

  return {
    board,
    dipStates,
    uartAssignments,
    warnings,
    sram,
    usbCurrent,
    netlist
  };
}
