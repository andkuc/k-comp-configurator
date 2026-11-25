// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Program Structure Blocks UI Panel (Active Chips, Inline Config Editor, Drag-and-Drop Palette & Code Spotlight)
import type { CodeBlockInstance } from '../types';
import { state, $, escapeHtml } from '../core/state';
import {
  BLOCK_CATALOG,
  BLOCK_GROUPS,
  addCodeBlock,
  clampInt,
  getBlockDef,
  removeCodeBlock,
  resolveParserSourceLabel
} from '../core/code-blocks';
import { t } from '../i18n/index';
import { appBus } from '../store/bus';

export function setSpotlightBlock(blockId: string | null): void {
  const codePre = $('#codeOutput') as HTMLElement | null;
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

function buildConfigEditorHtml(blk: CodeBlockInstance): string {
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

function isConfigurable(type: string): boolean {
  return !['eva', 'joy_4way', 'ir_switch', 'hid_guard'].includes(type);
}

export function renderCodeBlocksUI(): void {
  const drawerBtn = $('#btnToggleBlocksDrawer') as HTMLElement | null;
  const drawer = $('#codeBlocksDrawer') as HTMLElement | null;
  const hintsBtn = $('#btnCodeHints') as HTMLElement | null;
  const activeBar = $('#codeBlocksActive') as HTMLElement | null;
  const editorBox = $('#codeBlockEditor') as HTMLElement | null;
  if (!drawer || !activeBar) return;

  if (drawerBtn) {
    drawerBtn.classList.toggle('is-open', !!state.blocksDrawerOpen);
    drawerBtn.setAttribute('aria-expanded', String(!!state.blocksDrawerOpen));
  }
  drawer.classList.toggle('hidden', !state.blocksDrawerOpen);

  if (hintsBtn) {
    hintsBtn.classList.toggle('active', !!state.codeHints);
    hintsBtn.setAttribute('aria-pressed', String(!!state.codeHints));
  }

  const blocks = state.codeBlocks || [];
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

    activeBar.querySelectorAll<HTMLElement>('[data-cb-chip]').forEach((chip) => {
      const bid = chip.dataset.cbChip || null;
      chip.addEventListener('mouseenter', () => setSpotlightBlock(bid));
      chip.addEventListener('mouseleave', () => setSpotlightBlock(null));
    });
    activeBar.querySelectorAll<HTMLElement>('[data-cb-info]').forEach((btn) => {
      btn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        const type = btn.dataset.cbInfo;
        if (type) appBus.emit('modal:openBlockInfo', { type });
      });
    });
    activeBar.querySelectorAll<HTMLElement>('[data-cb-edit]').forEach((btn) => {
      btn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        const bid = btn.dataset.cbEdit || null;
        state.editingBlockId = state.editingBlockId === bid ? null : bid;
        renderCodeBlocksUI();
      });
    });
    activeBar.querySelectorAll<HTMLElement>('[data-cb-del]').forEach((btn) => {
      btn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        const bid = btn.dataset.cbDel;
        if (bid) removeCodeBlock(bid);
      });
    });
  }

  const editBlk = state.editingBlockId ? blocks.find((b) => b.blockId === state.editingBlockId) : null;
  if (editorBox) {
    if (!editBlk) {
      state.editingBlockId = null;
      editorBox.classList.add('hidden');
      editorBox.innerHTML = '';
    } else {
      editorBox.classList.remove('hidden');
      editorBox.innerHTML = buildConfigEditorHtml(editBlk);
      editorBox.querySelector<HTMLElement>('#btnCloseCbEditor')?.addEventListener('click', () => {
        state.editingBlockId = null;
        renderCodeBlocksUI();
      });
      editorBox.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-cb-key]').forEach((inp) => {
        const key = inp.dataset.cbKey;
        if (!key) return;
        const isCheckbox = inp instanceof HTMLInputElement && inp.type === 'checkbox';
        const evt = (inp.tagName === 'SELECT' || isCheckbox) ? 'change' : 'input';
        inp.addEventListener(evt, () => {
          editBlk.config[key] = isCheckbox ? (inp as HTMLInputElement).checked : inp.value;
          appBus.emit('workspace:recompute');
        });
      });
    }
  }

  const groupsHtml = BLOCK_GROUPS.map((grp) => {
    const items = BLOCK_CATALOG.filter((d) => d.group === grp && d.isVisible());
    if (!items.length) return '';
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

  drawer.querySelector<HTMLElement>('#btnOpenBlocksGuide')?.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    appBus.emit('modal:openBlocksOverview');
  });
  drawer.querySelectorAll<HTMLElement>('[data-cb-info]').forEach((btn) => {
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const type = btn.dataset.cbInfo;
      if (type) appBus.emit('modal:openBlockInfo', { type });
    });
  });

  drawer.querySelectorAll<HTMLElement>('[data-cb-add]').forEach((btn) => {
    const btype = btn.dataset.cbAdd;
    if (!btype) return;
    btn.addEventListener('click', (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('[data-cb-info]')) return;
      addCodeBlock(btype);
    });
    btn.addEventListener('dragstart', (ev: DragEvent) => {
      if (btn.classList.contains('is-maxed')) { ev.preventDefault(); return; }
      if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = 'copy';
        ev.dataTransfer.setData('text/x-kcomp-block', btype);
        ev.dataTransfer.setData('text/plain', btype);
      }
      ($('#tabCode') as HTMLElement | null)?.classList.add('cb-dragging');
    });
    btn.addEventListener('dragend', () => {
      ($('#tabCode') as HTMLElement | null)?.classList.remove('cb-dragging');
      ($('#codeBlocksActive') as HTMLElement | null)?.classList.remove('is-drag-over');
      ($('#codeOutput') as HTMLElement | null)?.classList.remove('is-drag-over');
    });
  });
}

export function bindCodeBlocksEvents(): void {
  const drawerBtn = $('#btnToggleBlocksDrawer') as HTMLElement | null;
  if (drawerBtn) {
    drawerBtn.addEventListener('click', () => {
      state.blocksDrawerOpen = !state.blocksDrawerOpen;
      if (state.blocksDrawerOpen && state.apiDrawerOpen) {
        state.apiDrawerOpen = false;
        ($('#apiRefDrawer') as HTMLElement | null)?.classList.add('hidden');
        ($('#apiCodeResizer') as HTMLElement | null)?.classList.add('hidden');
        const apiBtn = $('#btnToggleApiDrawer') as HTMLElement | null;
        if (apiBtn) {
          apiBtn.classList.remove('is-open');
          apiBtn.setAttribute('aria-expanded', 'false');
        }
      }
      renderCodeBlocksUI();
    });
  }

  const hintsBtn = $('#btnCodeHints') as HTMLElement | null;
  if (hintsBtn) {
    hintsBtn.addEventListener('click', () => {
      state.codeHints = !state.codeHints;
      appBus.emit('workspace:recompute');
    });
  }

  const dropTargets = [$('#codeBlocksActive') as HTMLElement | null, $('#codeOutput') as HTMLElement | null]
    .filter((el): el is HTMLElement => Boolean(el));
  for (const el of dropTargets) {
    el.addEventListener('dragover', (ev: DragEvent) => {
      const types = Array.from(ev.dataTransfer?.types || []);
      if (!types.includes('text/x-kcomp-block') && !types.includes('text/plain')) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
      el.classList.add('is-drag-over');
    });
    el.addEventListener('dragleave', () => {
      el.classList.remove('is-drag-over');
    });
    el.addEventListener('drop', (ev: DragEvent) => {
      const btype = ev.dataTransfer?.getData('text/x-kcomp-block') || ev.dataTransfer?.getData('text/plain');
      el.classList.remove('is-drag-over');
      ($('#tabCode') as HTMLElement | null)?.classList.remove('cb-dragging');
      if (btype && getBlockDef(btype)) {
        ev.preventDefault();
        addCodeBlock(btype);
      }
    });
  }
}
