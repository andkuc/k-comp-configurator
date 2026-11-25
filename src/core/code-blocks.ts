// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Headless Program Structure Blocks Catalog, Validators, State Mutations & SRAM Helpers (Zero DOM)
import type { CodeBlockDef, CodeBlockInstance } from '../types';
import { state } from './state';
import { t } from '../i18n/index';
import { appBus } from '../store/bus';
import { computeCodeBlocksSramFromList } from './code-blocks-sram';

export const BLOCK_GROUPS: ReadonlyArray<CodeBlockDef['group']> = ['flow', 'time', 'hw'];

export const BLOCK_CATALOG: CodeBlockDef[] = [
  // --- FLOW ---
  {
    type: 'eva',
    group: 'flow',
    icon: '📐',
    max: 1,
    color: '#a855f7',
    defaultConfig: () => ({}),
    sram: () => 0,
    isVisible: () => true,
    isRecommended: () => state.active.length >= 1,
    hasWarning: () => null,
    summary: () => ''
  },
  {
    type: 'fsm',
    group: 'flow',
    icon: '🔀',
    max: 1,
    color: '#38bdf8',
    defaultConfig: () => ({ states: 'MENU, PLAYING, GAMEOVER' }),
    sram: () => 1,
    isVisible: () => true,
    isRecommended: () => true,
    hasWarning: () => null,
    summary: (cfg) => {
      const n = parseStateList(cfg.states).length;
      return `(${n})`;
    }
  },
  {
    type: 'toggle',
    group: 'flow',
    icon: '🎛',
    max: 1,
    color: '#22c55e',
    defaultConfig: () => ({ varName: 'isRunning' }),
    sram: () => 1,
    isVisible: () => true,
    isRecommended: () => false,
    hasWarning: () => null,
    summary: (cfg) => cleanIdent(cfg.varName, 'isRunning')
  },

  // --- TIMING ---
  {
    type: 'timer',
    group: 'time',
    icon: '⏱',
    max: 3,
    color: '#f59e0b',
    defaultConfig: (existingCount) => {
      const presets = [
        { name: 'tick', intervalMs: 250 },
        { name: 'sensor', intervalMs: 500 },
        { name: 'display', intervalMs: 100 }
      ];
      return { ...(presets[existingCount] || { name: `timer${existingCount + 1}`, intervalMs: 250 }) };
    },
    sram: () => 4,
    isVisible: () => true,
    isRecommended: () => true,
    hasWarning: () => null,
    summary: (cfg) => `${clampInt(cfg.intervalMs, 10, 60000, 250)}ms`
  },
  {
    type: 'oneshot',
    group: 'time',
    icon: '⏳',
    max: 2,
    color: '#fb923c',
    defaultConfig: (existingCount) => (
      existingCount === 0
        ? { name: 'splash', durationMs: 2500 }
        : { name: 'alarm', durationMs: 1000 }
    ),
    sram: () => 5,
    isVisible: () => true,
    isRecommended: () => false,
    hasWarning: () => null,
    summary: (cfg) => `${clampInt(cfg.durationMs, 50, 60000, 2500)}ms`
  },
  {
    type: 'debug_tick',
    group: 'time',
    icon: '🖥',
    max: 1,
    color: '#64748b',
    defaultConfig: () => ({ intervalMs: 500 }),
    sram: () => 4,
    isVisible: () => true,
    isRecommended: () => false,
    hasWarning: () => null,
    summary: (cfg) => `${clampInt(cfg.intervalMs, 100, 10000, 500)}ms`
  },

  // --- HARDWARE STRUCTURE ---
  {
    type: 'btn_callbacks',
    group: 'hw',
    icon: '🔘',
    max: 1,
    color: '#10b981',
    defaultConfig: () => ({ buttons: 'both' }),
    sram: () => 0,
    isVisible: () => true,
    isRecommended: () => !!(state.onboard.onboard_start || state.onboard.onboard_select),
    hasWarning: () => (!state.onboard.onboard_start && !state.onboard.onboard_select) ? t('cb.warnNoButtons') : null,
    summary: (cfg) => cfg.buttons === 'start' ? 'START' : (cfg.buttons === 'select' ? 'SELECT' : 'START+SEL')
  },
  {
    type: 'oled_grid',
    group: 'hw',
    icon: '🧩',
    max: 1,
    color: '#0ea5e9',
    defaultConfig: () => ({ cols: 3, rows: 3, cellSize: 20, cursor: true }),
    sram: (cfg) => {
      const c = clampInt(cfg.cols, 2, 16, 3);
      const r = clampInt(cfg.rows, 2, 8, 3);
      return Math.ceil((c * r) / 2) + 20;
    },
    isVisible: () => true,
    isRecommended: () => !!state.onboard.onboard_oled,
    hasWarning: () => !state.onboard.onboard_oled ? t('cb.warnNoOled') : null,
    summary: (cfg) => `${clampInt(cfg.cols, 2, 16, 3)}×${clampInt(cfg.rows, 2, 8, 3)}`
  },
  {
    type: 'char_parser',
    group: 'hw',
    icon: '💬',
    max: 1,
    color: '#ec4899',
    defaultConfig: () => ({ source: 'auto', chars: 'S, X, 1, 2' }),
    sram: () => 0,
    isVisible: () => true,
    isRecommended: () => hasAnyComp(['hc12', 'hc05', 'cardkb']),
    hasWarning: (cfg) => {
      if (cfg.source === 'hc12' && !hasAnyComp(['hc12'])) return t('cb.warnMissingHw', { hw: 'HC-12' });
      if (cfg.source === 'bt' && !hasAnyComp(['hc05'])) return t('cb.warnMissingHw', { hw: 'HC-05' });
      if (cfg.source === 'cardkb' && !hasAnyComp(['cardkb'])) return t('cb.warnMissingHw', { hw: 'CardKB' });
      return null;
    },
    summary: (cfg) => resolveParserSourceLabel(cfg.source)
  },

  // --- DYNAMIC CONTEXT BLOCKS (appear automatically when matching hardware is active) ---
  {
    type: 'joy_4way',
    group: 'hw',
    icon: '🕹',
    max: 1,
    color: '#34d399',
    contextOnly: true,
    defaultConfig: () => ({ threshold: 250 }),
    sram: () => 1,
    isVisible: () => !!state.onboard.onboard_joystick || hasBlockType('joy_4way'),
    isRecommended: () => !!state.onboard.onboard_joystick,
    hasWarning: () => !state.onboard.onboard_joystick ? t('cb.warnNoJoystick') : null,
    summary: () => '4-Way'
  },
  {
    type: 'ir_switch',
    group: 'hw',
    icon: '📡',
    max: 1,
    color: '#818cf8',
    contextOnly: true,
    defaultConfig: () => ({}),
    sram: () => 0,
    isVisible: () => hasAnyComp(['ir-rx']) || hasBlockType('ir_switch'),
    isRecommended: () => hasAnyComp(['ir-rx']),
    hasWarning: () => !hasAnyComp(['ir-rx']) ? t('cb.warnMissingHw', { hw: 'IR Receiver' }) : null,
    summary: () => 'NEC'
  },
  {
    type: 'motor_seq',
    group: 'hw',
    icon: '🚗',
    max: 1,
    color: '#f43f5e',
    contextOnly: true,
    defaultConfig: () => ({ steps: 4 }),
    sram: () => 1,
    isVisible: () => hasAnyComp(['tb6612fng']) || hasBlockType('motor_seq'),
    isRecommended: () => hasAnyComp(['tb6612fng']),
    hasWarning: () => !hasAnyComp(['tb6612fng']) ? t('cb.warnMissingHw', { hw: 'TB6612FNG' }) : null,
    summary: (cfg) => `${clampInt(cfg.steps, 2, 8, 4)}×`
  },
  {
    type: 'hid_guard',
    group: 'hw',
    icon: '🛡',
    max: 1,
    color: '#ef4444',
    contextOnly: true,
    defaultConfig: () => ({}),
    sram: () => 1,
    isVisible: () => hasAnyComp(['ch9329']) || hasBlockType('hid_guard'),
    isRecommended: () => hasAnyComp(['ch9329']),
    hasWarning: () => !hasAnyComp(['ch9329']) ? t('cb.warnMissingHw', { hw: 'CH9329' }) : null,
    summary: () => 'START'
  }
];

export function getBlockDef(type: string): CodeBlockDef | null {
  return BLOCK_CATALOG.find((b) => b.type === type) || null;
}

export function hasBlockType(type: string): boolean {
  return (state.codeBlocks || []).some((b) => b.type === type);
}

export function hasAnyComp(ids: ReadonlyArray<string>): boolean {
  return (state.active || []).some((i) => ids.includes(i.compId));
}

export function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = parseInt(String(val ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function cleanIdent(raw: unknown, fallback = 'item'): string {
  const s = String(raw || '').replace(/[^a-zA-Z0-9_]/g, '');
  if (!s || /^\d/.test(s)) return fallback;
  return s.slice(0, 20);
}

export function toUpperMacro(raw: unknown, fallback = 'ITEM'): string {
  const s = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!s || /^\d/.test(s)) return fallback;
  return s.slice(0, 18);
}

export function parseStateList(raw: unknown): string[] {
  const parts = String(raw || '').split(/[,;\n]+/).map((s) => toUpperMacro(s, '')).filter(Boolean);
  const uniq = [...new Set<string>(parts)];
  return uniq.length ? uniq.slice(0, 6) : ['MENU', 'PLAYING', 'GAMEOVER'];
}

export function parseCharList(raw: unknown): string[] {
  const tokens = String(raw || '').split(/[,;\s]+/).map((s) => s.replace(/^['"]|['"]$/g, '')).filter(Boolean);
  const chars: string[] = [];
  for (const tok of tokens) {
    const ch = tok[0];
    if (ch && ch !== "'" && ch !== '\\' && !chars.includes(ch)) chars.push(ch);
  }
  return chars.length ? chars.slice(0, 8) : ['S', 'X', '1', '2'];
}

export function resolveParserSource(srcCfg: unknown): string {
  if (typeof srcCfg === 'string' && srcCfg && srcCfg !== 'auto') return srcCfg;
  if (hasAnyComp(['hc12'])) return 'hc12';
  if (hasAnyComp(['hc05'])) return 'bt';
  if (hasAnyComp(['cardkb'])) return 'cardkb';
  return 'serial';
}

export function resolveParserSourceLabel(srcCfg: unknown): string {
  const r = resolveParserSource(srcCfg);
  if (r === 'hc12') return 'hc12';
  if (r === 'bt') return 'btSerial';
  if (r === 'cardkb') return 'CardKB';
  return 'Serial';
}

export function computeCodeBlocksSram(): number {
  return computeCodeBlocksSramFromList(state.codeBlocks);
}

export function addCodeBlock(type: string): void {
  const def = getBlockDef(type);
  if (!def) return;
  const existing = (state.codeBlocks || []).filter((b) => b.type === type);
  if (existing.length >= def.max) {
    appBus.emit('ui:toast', { msg: t('cb.toastMax', { name: t(`cb.${type}.name`), max: def.max }) });
    return;
  }

  appBus.emit('history:push');
  const blk: CodeBlockInstance = {
    blockId: 'blk_' + state.nextBlockInst++,
    type,
    config: def.defaultConfig(existing.length)
  };
  state.codeBlocks.push(blk);
  appBus.emit('ui:toast', { msg: t('cb.toastAdded', { name: t(`cb.${type}.name`) }) });
  appBus.emit('workspace:recompute');
}

export function removeCodeBlock(blockId: string): void {
  const blk = (state.codeBlocks || []).find((b) => b.blockId === blockId);
  if (!blk) return;
  appBus.emit('history:push');
  state.codeBlocks = state.codeBlocks.filter((b) => b.blockId !== blockId);
  if (state.editingBlockId === blockId) state.editingBlockId = null;
  appBus.emit('codeblock:spotlight', { blockId: null });
  appBus.emit('workspace:recompute');
}
