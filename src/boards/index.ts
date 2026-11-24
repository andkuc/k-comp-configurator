// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { BoardProfile } from '../types';
import { KCOMP_V2_BOARD } from './kcomp-v2/pinmap';
import { ESP32_S3_DEVKIT_BOARD } from './esp32-s3-devkit/pinmap';

export { KCOMP_V2_BOARD, ESP32_S3_DEVKIT_BOARD };
export const DEFAULT_BOARD_ID = 'kcomp-v2';

export const BOARDS: Record<string, BoardProfile> = {
  [KCOMP_V2_BOARD.id]: KCOMP_V2_BOARD,
  [ESP32_S3_DEVKIT_BOARD.id]: ESP32_S3_DEVKIT_BOARD
};

let activeBoardId = DEFAULT_BOARD_ID;

export function getBoardById(boardId: string | null | undefined): BoardProfile | null {
  if (!boardId) return null;
  return BOARDS[boardId] || null;
}

export function getActiveBoard(): BoardProfile {
  return BOARDS[activeBoardId] || KCOMP_V2_BOARD;
}

export function setActiveBoard(boardId: string): BoardProfile {
  activeBoardId = BOARDS[boardId] ? boardId : DEFAULT_BOARD_ID;
  const board = getActiveBoard();
  if (typeof window !== 'undefined') window.KCOMP_BOARD = board;
  return board;
}

export function listBoards(): BoardProfile[] {
  return Object.values(BOARDS);
}

export function isBoardCarrierActive(board: BoardProfile = getActiveBoard(), carrierEnabled?: boolean): boolean {
  if (!board.carrier) return false;
  if (typeof carrierEnabled === 'boolean') return carrierEnabled;
  if (typeof window !== 'undefined' && window.__KCOMP_STATE && typeof window.__KCOMP_STATE.carrierEnabled === 'boolean') {
    return window.__KCOMP_STATE.carrierEnabled;
  }
  return !!board.carrier.defaultEnabled;
}

export function getBoardGeometry(board: BoardProfile = getActiveBoard(), carrierEnabled?: boolean) {
  const useCarrier = isBoardCarrierActive(board, carrierEnabled);
  if (useCarrier && board.carrier) {
    const { tx, ty, scale } = board.carrier.canvasPlacement;
    const b = board.carrier.localBounds;
    const left = tx + b.minX * scale;
    const right = tx + b.maxX * scale;
    const top = ty + b.minY * scale;
    const bottom = ty + b.maxY * scale;
    return {
      tx,
      ty,
      scale,
      left,
      top,
      width: right - left,
      height: bottom - top,
      right,
      bottom,
      carrierActive: true
    };
  }
  const { tx, ty, scale } = board.canvasPlacement;
  const w = board.viewBox.width * scale;
  const h = board.viewBox.height * scale;
  return {
    tx,
    ty,
    scale,
    left: tx,
    top: ty,
    width: w,
    height: h,
    right: tx + w,
    bottom: ty + h,
    carrierActive: false
  };
}

export function detectInitialCarrier(board: BoardProfile): boolean {
  if (!board.carrier) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const c = (params.get('carrier') || '').toLowerCase().trim();
    if (c === 'standalone' || c === 'none' || c === '0' || c === 'off') return false;
    if (c === 'breadboard' || c === '1' || c === 'on') return true;
  } catch (_) {}
  return !!board.carrier.defaultEnabled;
}

export function detectInitialBoardId(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const p = (params.get('board') || '').toLowerCase().trim();
    if (p && BOARDS[p]) return p;
    if (p === 'esp32' || p === 'esp32s3' || p === 's3') return 'esp32-s3-devkit';
  } catch (_) {}
  return DEFAULT_BOARD_ID;
}

if (typeof window !== 'undefined' && !window.KCOMP_BOARD) {
  window.KCOMP_BOARD = KCOMP_V2_BOARD;
}
