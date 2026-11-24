// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Program Structure Blocks Catalog, Drag-and-Drop Palette, Live Parameter Popover & SRAM Calculator
import { state, hooks, $, escapeHtml, showToast } from './state.js?v=0.1.0';
import { t } from '../i18n/index.js?v=0.1.0';

export const BLOCK_GROUPS = ['flow', 'time', 'hw'];

export const BLOCK_CATALOG = [
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

export function getBlockDef(type) {
  return BLOCK_CATALOG.find((b) => b.type === type) || null;
}

export function hasBlockType(type) {
  return (state.codeBlocks || []).some((b) => b.type === type);
}

export function hasAnyComp(ids) {
  return (state.active || []).some((i) => ids.includes(i.compId));
}

export function clampInt(val, min, max, fallback) {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function cleanIdent(raw, fallback = 'item') {
  const s = String(raw || '').replace(/[^a-zA-Z0-9_]/g, '');
  if (!s || /^\d/.test(s)) return fallback;
  return s.slice(0, 20);
}

export function toUpperMacro(raw, fallback = 'ITEM') {
  const s = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!s || /^\d/.test(s)) return fallback;
  return s.slice(0, 18);
}

export function parseStateList(raw) {
  const parts = String(raw || '').split(/[,;\n]+/).map((s) => toUpperMacro(s, '')).filter(Boolean);
  const uniq = [...new Set(parts)];
  return uniq.length ? uniq.slice(0, 6) : ['MENU', 'PLAYING', 'GAMEOVER'];
}

export function parseCharList(raw) {
  const tokens = String(raw || '').split(/[,;\s]+/).map((s) => s.replace(/^['"]|['"]$/g, '')).filter(Boolean);
  const chars = [];
  for (const tok of tokens) {
    const ch = tok[0];
    if (ch && ch !== "'" && ch !== '\\' && !chars.includes(ch)) chars.push(ch);
  }
  return chars.length ? chars.slice(0, 8) : ['S', 'X', '1', '2'];
}

export function resolveParserSource(srcCfg) {
  if (srcCfg && srcCfg !== 'auto') return srcCfg;
  if (hasAnyComp(['hc12'])) return 'hc12';
  if (hasAnyComp(['hc05'])) return 'bt';
  if (hasAnyComp(['cardkb'])) return 'cardkb';
  return 'serial';
}

export function resolveParserSourceLabel(srcCfg) {
  const r = resolveParserSource(srcCfg);
  if (r === 'hc12') return 'hc12';
  if (r === 'bt') return 'btSerial';
  if (r === 'cardkb') return 'CardKB';
  return 'Serial';
}

export function computeCodeBlocksSram() {
  let bytes = 0;
  for (const blk of (state.codeBlocks || [])) {
    const def = getBlockDef(blk.type);
    if (def && def.sram) bytes += def.sram(blk.config || {});
  }
  return bytes;
}

export function addCodeBlock(type) {
  const def = getBlockDef(type);
  if (!def) return;
  const existing = (state.codeBlocks || []).filter((b) => b.type === type);
  if (existing.length >= def.max) {
    showToast(t('cb.toastMax', { name: t(`cb.${type}.name`), max: def.max }));
    return;
  }

  hooks.pushUndoState();
  const blk = {
    blockId: 'blk_' + state.nextBlockInst++,
    type,
    config: def.defaultConfig(existing.length)
  };
  state.codeBlocks.push(blk);
  showToast(t('cb.toastAdded', { name: t(`cb.${type}.name`) }));
  hooks.recomputeAndRender();
}

export function removeCodeBlock(blockId) {
  const blk = (state.codeBlocks || []).find((b) => b.blockId === blockId);
  if (!blk) return;
  hooks.pushUndoState();
  state.codeBlocks = state.codeBlocks.filter((b) => b.blockId !== blockId);
  if (state.editingBlockId === blockId) state.editingBlockId = null;
  setSpotlightBlock(null);
  hooks.recomputeAndRender();
}

export function setSpotlightBlock(blockId) {
  const codePre = $('#codeOutput');
  if (!codePre) return;
  codePre.querySelectorAll('.code-line.is-spotlit').forEach((el) => el.classList.remove('is-spotlit'));
  if (!blockId) {
    codePre.classList.remove('code-block-hovering');
    return;
  }
  codePre.classList.add('code-block-hovering');
  codePre.querySelectorAll(`.code-line[data-block-id="${blockId}"]`).forEach((el) => {
    el.classList.add('is-spotlit');
  });
}

function buildConfigEditorHtml(blk) {
  const cfg = blk.config || {};
  const def = getBlockDef(blk.type);
  if (!def) return '';
  let fieldsHtml = '';

  if (blk.type === 'fsm') {
    fieldsHtml = `
      <label class="cb-field">
        <span>${escapeHtml(t('cb.cfgStates'))}</span>
        <input type="text" data-cb-key="states" value="${escapeHtml(cfg.states || 'MENU, PLAYING, GAMEOVER')}" placeholder="MENU, PLAYING, GAMEOVER" />
      </label>`;
  } else if (blk.type === 'toggle') {
    fieldsHtml = `
      <label class="cb-field">
        <span>${escapeHtml(t('cb.cfgVarName'))}</span>
        <input type="text" data-cb-key="varName" value="${escapeHtml(cfg.varName || 'isRunning')}" placeholder="isRunning" />
      </label>`;
  } else if (blk.type === 'timer') {
    fieldsHtml = `
      <div class="cb-field-row">
        <label class="cb-field">
          <span>${escapeHtml(t('cb.cfgTimerName'))}</span>
          <input type="text" data-cb-key="name" value="${escapeHtml(cfg.name || 'tick')}" />
        </label>
        <label class="cb-field cb-field-num">
          <span>${escapeHtml(t('cb.cfgIntervalMs'))}</span>
          <input type="number" min="10" max="60000" step="50" data-cb-key="intervalMs" value="${clampInt(cfg.intervalMs, 10, 60000, 250)}" />
        </label>
      </div>`;
  } else if (blk.type === 'oneshot') {
    fieldsHtml = `
      <div class="cb-field-row">
        <label class="cb-field">
          <span>${escapeHtml(t('cb.cfgTimerName'))}</span>
          <input type="text" data-cb-key="name" value="${escapeHtml(cfg.name || 'splash')}" />
        </label>
        <label class="cb-field cb-field-num">
          <span>${escapeHtml(t('cb.cfgDurationMs'))}</span>
          <input type="number" min="50" max="60000" step="100" data-cb-key="durationMs" value="${clampInt(cfg.durationMs, 50, 60000, 2500)}" />
        </label>
      </div>`;
  } else if (blk.type === 'debug_tick') {
    fieldsHtml = `
      <label class="cb-field cb-field-num">
        <span>${escapeHtml(t('cb.cfgIntervalMs'))}</span>
        <input type="number" min="100" max="10000" step="100" data-cb-key="intervalMs" value="${clampInt(cfg.intervalMs, 100, 10000, 500)}" />
      </label>`;
  } else if (blk.type === 'btn_callbacks') {
    const val = cfg.buttons || 'both';
    fieldsHtml = `
      <label class="cb-field">
        <span>${escapeHtml(t('cb.cfgButtons'))}</span>
        <select data-cb-key="buttons">
          <option value="both" ${val === 'both' ? 'selected' : ''}>START + SELECT</option>
          <option value="start" ${val === 'start' ? 'selected' : ''}>START</option>
          <option value="select" ${val === 'select' ? 'selected' : ''}>SELECT</option>
        </select>
      </label>`;
  } else if (blk.type === 'oled_grid') {
    fieldsHtml = `
      <div class="cb-field-row">
        <label class="cb-field cb-field-num">
          <span>${escapeHtml(t('cb.cfgCols'))}</span>
          <input type="number" min="2" max="16" data-cb-key="cols" value="${clampInt(cfg.cols, 2, 16, 3)}" />
        </label>
        <label class="cb-field cb-field-num">
          <span>${escapeHtml(t('cb.cfgRows'))}</span>
          <input type="number" min="2" max="8" data-cb-key="rows" value="${clampInt(cfg.rows, 2, 8, 3)}" />
        </label>
        <label class="cb-field cb-field-num">
          <span>${escapeHtml(t('cb.cfgCellPx'))}</span>
          <input type="number" min="6" max="30" data-cb-key="cellSize" value="${clampInt(cfg.cellSize, 6, 30, 20)}" />
        </label>
      </div>
      <label class="cb-check">
        <input type="checkbox" data-cb-key="cursor" ${cfg.cursor !== false ? 'checked' : ''} />
        <span>${escapeHtml(t('cb.cfgShowCursor'))}</span>
      </label>`;
  } else if (blk.type === 'char_parser') {
    const src = cfg.source || 'auto';
    fieldsHtml = `
      <div class="cb-field-row">
        <label class="cb-field">
          <span>${escapeHtml(t('cb.cfgSource'))}</span>
          <select data-cb-key="source">
            <option value="auto" ${src === 'auto' ? 'selected' : ''}>Auto (${escapeHtml(resolveParserSourceLabel('auto'))})</option>
            <option value="serial" ${src === 'serial' ? 'selected' : ''}>Serial (USB)</option>
            <option value="hc12" ${src === 'hc12' ? 'selected' : ''}>HC-12 (hc12)</option>
            <option value="bt" ${src === 'bt' ? 'selected' : ''}>HC-05 (btSerial)</option>
            <option value="cardkb" ${src === 'cardkb' ? 'selected' : ''}>CardKB (I²C)</option>
          </select>
        </label>
        <label class="cb-field">
          <span>${escapeHtml(t('cb.cfgChars'))}</span>
          <input type="text" data-cb-key="chars" value="${escapeHtml(cfg.chars || 'S, X, 1, 2')}" placeholder="S, X, 1, 2" />
        </label>
      </div>`;
  } else if (blk.type === 'motor_seq') {
    fieldsHtml = `
      <label class="cb-field cb-field-num">
        <span>${escapeHtml(t('cb.cfgSteps'))}</span>
        <input type="number" min="2" max="8" data-cb-key="steps" value="${clampInt(cfg.steps, 2, 8, 4)}" />
      </label>`;
  } else {
    return '';
  }

  return `
    <div class="cb-editor-head">
      <span>${def.icon} <strong>${escapeHtml(t(`cb.${blk.type}.name`))}</strong></span>
      <button type="button" class="cb-editor-close" id="btnCloseCbEditor" title="${escapeHtml(t('modal.close'))}">✕</button>
    </div>
    <div class="cb-editor-body">${fieldsHtml}</div>`;
}

function isConfigurable(type) {
  return !['eva', 'joy_4way', 'ir_switch', 'hid_guard'].includes(type);
}

export function renderCodeBlocksUI() {
  const drawerBtn = $('#btnToggleBlocksDrawer');
  const drawer = $('#codeBlocksDrawer');
  const hintsBtn = $('#btnCodeHints');
  const activeBar = $('#codeBlocksActive');
  const editorBox = $('#codeBlockEditor');
  if (!drawer || !activeBar) return;

  const blocks = state.codeBlocks || [];
  const blkBadge = $('#blocksCountBadge');
  if (blkBadge) {
    blkBadge.textContent = String(blocks.length);
    blkBadge.classList.toggle('hidden', blocks.length === 0);
  }

  // Sync top buttons
  if (drawerBtn) {
    drawerBtn.classList.toggle('is-open', !!state.blocksDrawerOpen);
    drawerBtn.setAttribute('aria-expanded', String(!!state.blocksDrawerOpen));
  }
  drawer.classList.toggle('hidden', !state.blocksDrawerOpen);

  if (hintsBtn) {
    hintsBtn.classList.toggle('active', !!state.codeHints);
    hintsBtn.setAttribute('aria-pressed', String(!!state.codeHints));
  }

  // 1. Render Active Chips (Drop Zone — auto-hidden when empty & drawer closed to maximize code space)
  const hideEmptyDrop = blocks.length === 0 && !state.blocksDrawerOpen;
  activeBar.classList.toggle('is-collapsed-empty', hideEmptyDrop);
  if (!blocks.length) {
    activeBar.classList.add('is-empty');
    activeBar.innerHTML = `<span class="cb-drop-hint">${escapeHtml(t('cb.dropHint'))}</span>`;
  } else {
    activeBar.classList.remove('is-empty');
    activeBar.innerHTML = blocks.map((blk) => {
      const def = getBlockDef(blk.type);
      if (!def) return '';
      const sum = def.summary(blk.config || {});
      const warn = def.hasWarning(blk.config || {});
      const ram = def.sram(blk.config || {});
      const isEditing = state.editingBlockId === blk.blockId;
      const cfgBtn = isConfigurable(blk.type)
        ? `<button type="button" class="cb-chip-btn ${isEditing ? 'is-active' : ''}" data-cb-edit="${blk.blockId}" title="${escapeHtml(t('cb.editTitle'))}">⚙</button>`
        : '';
      return `
        <div class="cb-chip ${warn ? 'has-warn' : ''} ${isEditing ? 'is-editing' : ''}"
             style="--cb-accent:${def.color}"
             data-cb-chip="${blk.blockId}"
             title="${escapeHtml(warn || `${t(`cb.${blk.type}.desc`)}${ram ? ` (+${ram} B SRAM)` : ''}`)}">
          <span class="cb-chip-ico">${def.icon}</span>
          <span class="cb-chip-lbl">${escapeHtml(t(`cb.${blk.type}.short`))}${sum ? ` <span class="cb-chip-meta">${escapeHtml(sum)}</span>` : ''}</span>
          ${warn ? `<span class="cb-chip-warn" aria-label="Warning">!</span>` : ''}
          <button type="button" class="cb-chip-btn cb-chip-info" data-cb-info="${blk.type}" title="${escapeHtml(t('bguide.infoTitle', { name: t(`cb.${blk.type}.name`) }))}">i</button>
          ${cfgBtn}
          <button type="button" class="cb-chip-btn cb-chip-del" data-cb-del="${blk.blockId}" title="${escapeHtml(t('inspector.remove'))}">✕</button>
        </div>`;
    }).join('');

    activeBar.querySelectorAll('[data-cb-chip]').forEach((chip) => {
      const bid = chip.dataset.cbChip;
      chip.addEventListener('mouseenter', () => setSpotlightBlock(bid));
      chip.addEventListener('mouseleave', () => setSpotlightBlock(null));
    });
    activeBar.querySelectorAll('[data-cb-info]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        hooks.openBlockInfo(btn.dataset.cbInfo);
      });
    });
    activeBar.querySelectorAll('[data-cb-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bid = btn.dataset.cbEdit;
        state.editingBlockId = state.editingBlockId === bid ? null : bid;
        renderCodeBlocksUI();
      });
    });
    activeBar.querySelectorAll('[data-cb-del]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCodeBlock(btn.dataset.cbDel);
      });
    });
  }

  // 2. Render Inline Config Editor (if open)
  const editBlk = state.editingBlockId ? blocks.find((b) => b.blockId === state.editingBlockId) : null;
  if (editorBox) {
    if (!editBlk) {
      state.editingBlockId = null;
      editorBox.classList.add('hidden');
      editorBox.innerHTML = '';
    } else {
      editorBox.classList.remove('hidden');
      editorBox.innerHTML = buildConfigEditorHtml(editBlk);
      editorBox.querySelector('#btnCloseCbEditor')?.addEventListener('click', () => {
        state.editingBlockId = null;
        renderCodeBlocksUI();
      });
      editorBox.querySelectorAll('[data-cb-key]').forEach((inp) => {
        const key = inp.dataset.cbKey;
        const evt = (inp.tagName === 'SELECT' || inp.type === 'checkbox') ? 'change' : 'input';
        inp.addEventListener(evt, () => {
          editBlk.config[key] = inp.type === 'checkbox' ? inp.checked : inp.value;
          hooks.recomputeAndRender();
        });
      });
    }
  }

  // 3. Render Collapsible Palette Drawer (only populate when open or always lightweight)
  const groupsHtml = BLOCK_GROUPS.map((grp) => {
    const items = BLOCK_CATALOG.filter((d) => d.group === grp && d.isVisible());
    if (!items.length) return '';
    // Sort recommended items to the front within each group
    items.sort((a, b) => (b.isRecommended() ? 1 : 0) - (a.isRecommended() ? 1 : 0));

    const cards = items.map((d) => {
      const cnt = blocks.filter((b) => b.type === d.type).length;
      const maxed = cnt >= d.max;
      const rec = d.isRecommended();
      const ram = d.sram(d.defaultConfig(cnt));
      const ramBadge = ram > 0 ? `+${ram}B` : '0B';
      return `
        <div class="cb-pal-item ${cnt ? 'is-added' : ''} ${maxed ? 'is-maxed' : ''} ${rec ? 'is-rec' : ''}"
             style="--cb-accent:${d.color}"
             draggable="${maxed ? 'false' : 'true'}"
             data-cb-add="${d.type}"
             title="${escapeHtml(t(`cb.${d.type}.desc`))}">
          <span class="cb-pal-ico">${d.icon}</span>
          <span class="cb-pal-name">${escapeHtml(t(`cb.${d.type}.short`))}${rec ? ' <span class="cb-star" title="★">★</span>' : ''}</span>
          <span class="cb-pal-ram">${ramBadge}</span>
          <button type="button" class="cb-pal-info-btn" data-cb-info="${d.type}" title="${escapeHtml(t('bguide.infoTitle', { name: t(`cb.${d.type}.name`) }))}">i</button>
          <span class="cb-pal-plus">${maxed ? '✓' : (cnt ? `${cnt}/${d.max}` : '+')}</span>
        </div>`;
    }).join('');

    return `
      <div class="cb-pal-group">
        <div class="cb-pal-group-lbl">${escapeHtml(t(`cb.group.${grp}`))}</div>
        <div class="cb-pal-grid">${cards}</div>
      </div>`;
  }).join('');

  const drawerHeadHtml = `
    <div class="cb-drawer-head">
      <span class="cb-drawer-hint">${escapeHtml(t('cb.btnBlocksTitle').split('(')[0].trim())}</span>
      <button type="button" class="btn btn-ghost btn-sm cb-guide-btn" id="btnOpenBlocksGuide" title="${escapeHtml(t('bguide.btnGuideTitle'))}">${escapeHtml(t('bguide.btnGuide'))}</button>
    </div>`;
  drawer.innerHTML = drawerHeadHtml + groupsHtml;

  drawer.querySelector('#btnOpenBlocksGuide')?.addEventListener('click', (e) => {
    e.stopPropagation();
    hooks.openBlocksOverview();
  });
  drawer.querySelectorAll('[data-cb-info]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      hooks.openBlockInfo(btn.dataset.cbInfo);
    });
  });

  drawer.querySelectorAll('[data-cb-add]').forEach((btn) => {
    const btype = btn.dataset.cbAdd;
    btn.addEventListener('click', (e) => {
      if (e.target.closest('[data-cb-info]')) return;
      addCodeBlock(btype);
    });
    btn.addEventListener('dragstart', (ev) => {
      if (btn.classList.contains('is-maxed')) { ev.preventDefault(); return; }
      ev.dataTransfer.effectAllowed = 'copy';
      ev.dataTransfer.setData('text/x-kcomp-block', btype);
      ev.dataTransfer.setData('text/plain', btype);
      $('#tabCode')?.classList.add('cb-dragging');
    });
    btn.addEventListener('dragend', () => {
      $('#tabCode')?.classList.remove('cb-dragging');
      $('#codeBlocksActive')?.classList.remove('is-drag-over');
      $('#codeOutput')?.classList.remove('is-drag-over');
    });
  });
}

export function bindCodeBlocksEvents() {
  const drawerBtn = $('#btnToggleBlocksDrawer');
  if (drawerBtn) {
    drawerBtn.addEventListener('click', () => {
      state.blocksDrawerOpen = !state.blocksDrawerOpen;
      if (state.blocksDrawerOpen && state.apiDrawerOpen) {
        state.apiDrawerOpen = false;
        $('#apiRefDrawer')?.classList.add('hidden');
        $('#apiCodeResizer')?.classList.add('hidden');
        const apiBtn = $('#btnToggleApiDrawer');
        if (apiBtn) {
          apiBtn.classList.remove('is-open');
          apiBtn.setAttribute('aria-expanded', 'false');
        }
      }
      renderCodeBlocksUI();
    });
  }

  const hintsBtn = $('#btnCodeHints');
  if (hintsBtn) {
    hintsBtn.addEventListener('click', () => {
      state.codeHints = !state.codeHints;
      hooks.recomputeAndRender();
    });
  }

  // Drag-and-drop targets: both the active chips drop zone AND the code block itself!
  const dropTargets = [$('#codeBlocksActive'), $('#codeOutput')].filter(Boolean);
  for (const el of dropTargets) {
    el.addEventListener('dragover', (ev) => {
      const types = Array.from(ev.dataTransfer?.types || []);
      if (!types.includes('text/x-kcomp-block') && !types.includes('text/plain')) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
      el.classList.add('is-drag-over');
    });
    el.addEventListener('dragleave', () => {
      el.classList.remove('is-drag-over');
    });
    el.addEventListener('drop', (ev) => {
      const btype = ev.dataTransfer?.getData('text/x-kcomp-block') || ev.dataTransfer?.getData('text/plain');
      el.classList.remove('is-drag-over');
      $('#tabCode')?.classList.remove('cb-dragging');
      if (btype && getBlockDef(btype)) {
        ev.preventDefault();
        addCodeBlock(btype);
      }
    });
  }
}
