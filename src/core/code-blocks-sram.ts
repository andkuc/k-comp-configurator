// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pure, DOM-Free SRAM Estimator for Flat-C Program Structure Blocks
import type { CodeBlockInstance } from '../types';

const STATIC_BLOCK_SRAM: Record<string, number> = {
  eva: 0,
  fsm: 1,
  toggle: 1,
  timer: 4,
  oneshot: 5,
  debug_tick: 4,
  btn_callbacks: 0,
  char_parser: 0,
  joy_4way: 1,
  ir_switch: 0,
  motor_seq: 1,
  hid_guard: 1
};

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = parseInt(String(val ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function estimateSingleCodeBlockSram(type: string, cfg: Record<string, unknown> = {}): number {
  if (type === 'oled_grid') {
    const cols = clampInt(cfg.cols, 2, 16, 3);
    const rows = clampInt(cfg.rows, 2, 8, 3);
    return Math.ceil((cols * rows) / 2) + 20;
  }
  return STATIC_BLOCK_SRAM[type] ?? 0;
}

export function computeCodeBlocksSramFromList(blocks: ReadonlyArray<CodeBlockInstance> | null | undefined): number {
  let bytes = 0;
  for (const blk of (blocks || [])) {
    bytes += estimateSingleCodeBlockSram(blk.type, blk.config || {});
  }
  return bytes;
}
