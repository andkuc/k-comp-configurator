// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Interactive Library API & Functions Browser (Onboard A-Z -> External A-Z, Strict Accordion, Resizable Split)
import { state, $, escapeHtml, showToast, saveLayoutPrefs } from '../core/state';
import { getCompDef, getDisplayLabel, computeDipStates } from '../core/hardware';
import { hasBlockType } from '../core/code-blocks';
import { highlightCppCode, highlightCppSignature } from '../core/codegen';
import { getCachedLibraryApi, loadLibraryApiData } from '../catalog/lazy-data';
import { getActiveBoard } from '../boards';
import { getDriverCompat } from '../core/code-profiles';
import { t, tOnboard, getLocale } from '../i18n/index';
import { appBus } from '../store/bus';

function getLocalizedDesc(descObj) {
  if (!descObj) return '';
  const lang = getLocale();
  return descObj[lang] || descObj.en || '';
}

function extractSigParamNames(sig) {
  const m = String(sig || '').match(/\(([^)]*)\)/);
  if (!m) return [];
  const names = [];
  for (const raw of m[1].split(',')) {
    const clean = raw.replace(/=[\s\S]*$/, '').replace(/\[[\s\S]*\]$/, '').trim();
    if (!clean || clean === 'void') continue;
    const toks = clean.split(/[\s*&]+/).filter(Boolean);
    const last = toks[toks.length - 1];
    if (last && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(last) && !/^[A-Z][A-Z0-9_]{2,}$/.test(last)) {
      names.push(last);
    }
  }
  return names;
}

// Formats API description text so constants, variables/params, pins, functions, types & hex values
// render in the same monospace font and syntax-highlighting palette as the Code window.
export function formatApiDescription(text, sig, entry) {
  if (!text) return '';
  const sigParams = new Set(extractSigParamNames(sig));
  const structFields = new Set((entry && entry.fields) ? entry.fields : []);
  const entryMacros = new Set((entry && entry.macros) ? entry.macros : []);

  // Combined ordered tokenizer (native regex literal, zero lookbehind for universal browser support)
  const tokenRe = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b[a-zA-Z_][a-zA-Z0-9_]*\([^()]*\))|(\b[a-zA-Z0-9_]+\.h\b)|(\b0x[0-9a-fA-F]+\b)|(\b(?:[A-Z][A-Z0-9]*_[A-Z0-9_]+(?:\.\.\.|…)?|PROGMEM|HIGH|LOW|OFF|ON)(?![a-zA-Z0-9_]))|((?:~D(?:3|5|6|9|10|11)|\bD(?:1[0-3]|[0-9])|\bA[0-5]|\bS1-[1-8]|\bVIN[+\-−]|\bLO[+\-−]|\b(?:GND|VCC|SDA|SCL|SCK|DT|RX|TX))(?![a-zA-Z0-9_]))|(\.[a-zA-Z_][a-zA-Z0-9_]*)|(\b(?:true|false|void|bool|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t|float_t|float|double|char|byte|long|int|uint|ulong)\b)|(\b(?:BMI160Data|GPSData|GPSCardinal|AS7343Data|GY302Mode|joystickState|GridRenderCallback|GridCursorCallback|[A-Za-z][A-Za-z0-9_]*_t)\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*\b)/g;

  // Common plain English/German words that happen to be short param names: only highlight in param context
  const ambiguousWords = new Set([
    'x', 'y', 'w', 'h', 'r', 'c', 'k', 'id', 'pin', 'mode', 'speed', 'state', 'time', 'data',
    'text', 'value', 'color', 'size', 'start', 'final', 'enable', 'enabled', 'invert', 'dim',
    'angle', 'ratio', 'slot', 'hours', 'type', 'row', 'col', 'rows', 'cols', 'array', 'buffer',
    'length', 'notes', 'durations', 'duration', 'intensity', 'samples', 'address', 'buttons',
    'wheel', 'cycles', 'trim', 'percent', 'bitmap', 'callback', 'valid', 'clear', 'signal'
  ]);

  let out = '';
  let lastIdx = 0;
  let m;

  while ((m = tokenRe.exec(text)) !== null) {
    const idx = m.index;
    const raw = m[0];
    if (idx > lastIdx) out += escapeHtml(text.slice(lastIdx, idx));

    let wrapped = null;
    if (m[1]) {
      wrapped = `<code class="api-inline-code tok-str">${escapeHtml(raw)}</code>`;
    } else if (m[2]) {
      wrapped = `<code class="api-inline-code">${highlightCppCode(raw)}</code>`;
    } else if (m[3]) {
      wrapped = `<code class="api-inline-code tok-hdr">${escapeHtml(raw)}</code>`;
    } else if (m[4]) {
      wrapped = `<code class="api-inline-code tok-num">${escapeHtml(raw)}</code>`;
    } else if (m[5]) {
      // Avoid styling standalone German/English "ON"/"OFF" unless in parenthetical/macro context
      if ((raw === 'ON' || raw === 'OFF') && !/[\(\/:\-]\s*$/.test(text.slice(Math.max(0, idx - 6), idx)) && !/^\s*[\)\/]/.test(text.slice(idx + raw.length, idx + raw.length + 4)) && !/S1-\d\s+$/.test(text.slice(Math.max(0, idx - 6), idx))) {
        wrapped = null;
      } else {
        wrapped = `<code class="api-inline-code tok-const">${escapeHtml(raw)}</code>`;
      }
    } else if (m[6]) {
      wrapped = `<code class="api-inline-code tok-pin">${escapeHtml(raw)}</code>`;
    } else if (m[7]) {
      const prevCh = idx > 0 ? text[idx - 1] : '';
      if (!/[a-zA-Z0-9_]/.test(prevCh)) {
        wrapped = `<code class="api-inline-code tok-var">${escapeHtml(raw)}</code>`;
      }
    } else if (m[8]) {
      wrapped = `<code class="api-inline-code tok-kw">${escapeHtml(raw)}</code>`;
    } else if (m[9]) {
      wrapped = `<code class="api-inline-code tok-type">${escapeHtml(raw)}</code>`;
    } else if (m[10]) {
      const before = text.slice(Math.max(0, idx - 14), idx);
      const after = text.slice(idx + raw.length, idx + raw.length + 10);

      if (entryMacros.has(raw)) {
        wrapped = `<code class="api-inline-code tok-const">${escapeHtml(raw)}</code>`;
      } else if (/^(?:x|y)[0-2]$/.test(raw) || /^[a-z]+[A-Z][a-zA-Z0-9]*$/.test(raw) || /^[a-z][a-z0-9]*_[a-z0-9_]+$/.test(raw)) {
        // Unambiguous camelCase (cellW, offsetX, rxPin, seaLevel, gainReg) or snake_case (time_ms, is_valid, pm2_5, sensor_type) or coords x0/y1
        wrapped = `<code class="api-inline-code tok-var">${escapeHtml(raw)}</code>`;
      } else if (sigParams.has(raw) || structFields.has(raw)) {
        if (!ambiguousWords.has(raw)) {
          // Unambiguous parameter/field names like addr1, addr2, baud, freq, func, rx, tx, mA, bpm, deg, lat1, lon1
          wrapped = `<code class="api-inline-code tok-var">${escapeHtml(raw)}</code>`;
        } else {
          // Highlight common-word param names when in clear parameter-doc or struct-list position:
          // e.g. "• speed:", "• x, y:", "at speed (", "for time_ms", "in samples", "(valid, latitude, ...)", "um x, y"
          const isSingleChar = raw.length === 1;
          const bulletDef = /(?:•|,|\/|\()\s*$/.test(before) && /^\s*(?::|,|\/|\)|is\b|ist\b|është\b)/.test(after);
          const pairList = /\b(?:um|von|for|with|mit|over|über|mbi|into|in|aus|from|under|unter|bei|at|te|als|set|sets)\s+$/.test(before) && !isSingleChar;
          const afterCommaInParens = /\([^)]*$/.test(before) && /^[,\)]/.test(after.trim()) && !isSingleChar;
          if (bulletDef || pairList || afterCommaInParens) {
            wrapped = `<code class="api-inline-code tok-var">${escapeHtml(raw)}</code>`;
          }
        }
      }
    }

    out += wrapped || escapeHtml(raw);
    lastIdx = tokenRe.lastIndex;
  }

  if (lastIdx < text.length) out += escapeHtml(text.slice(lastIdx));
  return out;
}

function resolveActiveApiEntries() {
  const LIBRARY_API = getCachedLibraryApi();
  if (!LIBRARY_API) return [];
  const dipStates = computeDipStates();
  const isOnboardActive = (ob) => {
    if (!state.onboard[ob.id]) return false;
    const dip = ob.dip ? dipStates.find((d) => d.id === ob.dip) : null;
    return !dip || dip.on;
  };

  const showAll = !!state.apiShowAll;
  const loc = getLocale();
  const byTitleAlpha = (a, b) => a.title.localeCompare(b.title, loc, { sensitivity: 'base', numeric: true });

  // 1. Onboard Peripherals FIRST (sorted A-Z by localized title)
  const board = getActiveBoard();
  const obEntries = [];
  const obSource = board.onboardPeripherals || [];
  for (const ob of obSource) {
    if (!showAll && !isOnboardActive(ob)) continue;
    const api = LIBRARY_API[ob.id];
    if (!api) continue;
    const hdr = (ob.id === 'onboard_oled' && state.oledPaged && api.headerPaged) ? api.headerPaged : api.header;
    obEntries.push({
      key: ob.id,
      group: 'onboard',
      title: tOnboard(ob, 'name'),
      sub: ob.pinInfo || '',
      header: hdr,
      verified: api.verified !== false,
      macros: api.macros || [],
      fields: api.fields || [],
      functions: api.functions || []
    });

    if (ob.id === 'onboard_oled' && (showAll || isOnboardActive(ob) || hasBlockType('oled_grid'))) {
      const gridApi = LIBRARY_API.oled_grid;
      if (gridApi) {
        obEntries.push({
          key: 'oled_grid',
          group: 'onboard',
          title: t('cb.oled_grid.name'),
          sub: 'OLED 0.96"',
          header: gridApi.header,
          verified: true,
          macros: gridApi.macros || [],
          fields: gridApi.fields || [],
          functions: gridApi.functions || []
        });
      }
    }
  }
  obEntries.sort(byTitleAlpha);

  // 2. External Modules SECOND (sorted A-Z by localized title)
  const extEntries = [];
  const seenComp = new Set();
  const extList = showAll
    ? (state.catalog?.components || [])
    : (state.active || []).map((i) => getCompDef(i.compId)).filter(Boolean);

  for (const def of extList) {
    if (seenComp.has(def.id)) continue;
    seenComp.add(def.id);
    const api = LIBRARY_API[def.id];
    if (!api) continue;
    extEntries.push({
      key: def.id,
      group: 'external',
      title: getDisplayLabel(def),
      sub: def.name,
      header: api.header,
      verified: api.verified !== false,
      macros: api.macros || [],
      fields: api.fields || [],
      functions: api.functions || []
    });
  }
  extEntries.sort(byTitleAlpha);

  return [...obEntries, ...extEntries];
}

async function copyTextWithFeedback(text, btnEl, toastLabel) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    }
    if (btnEl) {
      btnEl.classList.add('is-copied');
      const tag = btnEl.querySelector('.api-copy-tag');
      if (tag) tag.textContent = '✓';
      setTimeout(() => {
        btnEl.classList.remove('is-copied');
        if (tag) tag.textContent = '📋';
      }, 1150);
    }
    showToast(t('api.toastCopied', { item: toastLabel }));
  } catch (_) {
    showToast(t('api.toastCopyFail'));
  }
}

function countActiveBoardApis() {
  if (getCachedLibraryApi()) {
    const prev = state.apiShowAll;
    state.apiShowAll = false;
    const n = resolveActiveApiEntries().length;
    state.apiShowAll = prev;
    return n;
  }
  // Lightweight pre-load count (avoids loading 163 KB library-api-data until user opens ƒx API!)
  const board = getActiveBoard();
  const dipStates = computeDipStates();
  let count = 0;
  for (const ob of (board.onboardPeripherals || [])) {
    if (!state.onboard[ob.id]) continue;
    const dip = ob.dip ? dipStates.find((d) => d.id === ob.dip) : null;
    if (!dip || dip.on) {
      count++;
      if (ob.id === 'onboard_oled') count++;
    }
  }
  const uniqueExt = new Set((state.active || []).map((i) => i.compId));
  return count + uniqueExt.size;
}

export function renderApiBrowserUI() {
  const btn = $('#btnToggleApiDrawer');
  const badge = $('#apiCountBadge');
  const drawer = $('#apiRefDrawer');
  const resizer = $('#apiCodeResizer');
  if (!drawer) return;

  if (badge) {
    const activeApiCount = countActiveBoardApis();
    badge.textContent = String(activeApiCount);
    badge.classList.toggle('hidden', activeApiCount === 0);
  }
  if (btn) {
    btn.classList.toggle('is-open', !!state.apiDrawerOpen);
    btn.setAttribute('aria-expanded', String(!!state.apiDrawerOpen));
  }
  drawer.classList.toggle('hidden', !state.apiDrawerOpen);
  if (resizer) resizer.classList.toggle('hidden', !state.apiDrawerOpen);
  if (!state.apiDrawerOpen) return;

  if (!getCachedLibraryApi()) {
    drawer.innerHTML = `<div class="api-empty" style="padding:14px;">${escapeHtml(t('common.loading'))}</div>`;
    void loadLibraryApiData().then(() => {
      if (state.apiDrawerOpen) renderApiBrowserUI();
    });
    return;
  }

  const q = (state.apiSearch || '').trim().toLowerCase();
  const entries = resolveActiveApiEntries();

  const filtered = entries.map((e) => {
    if (!q) return e;
    const headMatch = `${e.title} ${e.sub} ${e.header}`.toLowerCase().includes(q);
    const matchedFns = headMatch
      ? e.functions
      : e.functions.filter((f) => `${f.sig} ${f.call} ${getLocalizedDesc(f.desc)}`.toLowerCase().includes(q));
    const matchedMacros = headMatch
      ? e.macros
      : e.macros.filter((m) => m.toLowerCase().includes(q));
    const matchedFields = headMatch
      ? e.fields
      : e.fields.filter((fl) => fl.toLowerCase().includes(q));
    if (!matchedFns.length && !matchedMacros.length && !matchedFields.length) return null;
    return { ...e, functions: matchedFns, macros: matchedMacros, fields: matchedFields };
  }).filter(Boolean);

  // Strict single-open accordion: none expanded by default (state.apiExpandedKey === null)
  if (state.apiExpandedKey && !filtered.some((e) => e.key === state.apiExpandedKey)) {
    state.apiExpandedKey = null;
  }

  const renderGroup = (grpKey, items) => {
    if (!items.length) return '';
    const cards = items.map((e) => {
      const isOpen = state.apiExpandedKey === e.key;
      const isStdHeader = e.header.endsWith('.h');
      const includeStmt = isStdHeader ? `#include <${e.header}>` : '';

      const fnsHtml = e.functions.map((f, idx) => `
        <button type="button"
                class="api-fn-row"
                data-api-copy-key="${escapeHtml(e.key)}"
                data-api-fn-idx="${idx}"
                title="${escapeHtml(t('api.clickCopyHint'))}">
          <div class="api-fn-top">
            <span class="api-phase api-phase-${escapeHtml(f.phase || 'output')}">${escapeHtml(t(`api.phase.${f.phase || 'output'}`))}</span>
            <code class="api-fn-sig">${highlightCppSignature(f.sig)}</code>
            <span class="api-copy-tag" aria-hidden="true">📋</span>
          </div>
          <div class="api-fn-desc">${formatApiDescription(getLocalizedDesc(f.desc), f.sig, e)}</div>
        </button>`).join('');

      const fieldsHtml = (e.fields && e.fields.length) ? `
        <div class="api-macros-row">
          <span class="api-macros-lbl tok-kw">struct:</span>
          ${e.fields.map((fl) => `<button type="button" class="api-macro-chip api-field-chip" data-api-macro=".${escapeHtml(fl)}" title="${escapeHtml(t('api.clickCopyMacro'))}"><span class="tok-var">.${escapeHtml(fl)}</span></button>`).join('')}
        </div>` : '';
      const macrosHtml = e.macros.length ? `
        <div class="api-macros-row">
          <span class="api-macros-lbl tok-prep">#define:</span>
          ${e.macros.map((m) => `<button type="button" class="api-macro-chip" data-api-macro="${escapeHtml(m)}" title="${escapeHtml(t('api.clickCopyMacro'))}">${highlightCppSignature(m)}</button>`).join('')}
        </div>` : '';

      return `
        <div class="api-comp-card ${isOpen ? 'is-open' : ''}">
          <div class="api-comp-head" data-api-toggle="${escapeHtml(e.key)}">
            <span class="api-caret" aria-hidden="true">${isOpen ? '▾' : '▸'}</span>
            <span class="api-comp-title">${escapeHtml(e.title)}</span>
            ${includeStmt
              ? `<button type="button" class="api-hdr-chip" data-api-inc="${escapeHtml(includeStmt)}" title="${escapeHtml(t('api.clickCopyInclude'))}"><span class="tok-hdr">&lt;${escapeHtml(e.header)}&gt;</span></button>`
              : `<span class="api-hdr-plain">${escapeHtml(e.header)}</span>`}
            ${(() => {
              const doc = state.repoDocsMap.get(e.key);
              return doc ? `<a class="api-pdf-link" href="${escapeHtml(doc.url)}" target="_blank" rel="noopener" title="${escapeHtml(t('info.docsOpenTitle', { file: doc.filename }))}" aria-label="${escapeHtml(doc.filename)}">📄</a>` : '';
            })()}
            ${(() => {
              const curBoard = getActiveBoard();
              if (curBoard.mcu !== 'atmega328p') {
                const compat = getDriverCompat(e.key, curBoard);
                if (compat === 'avr-only') return `<span class="api-compat-badge is-avr" title="${escapeHtml(t('api.compatAvrOnlyTitle'))}">${escapeHtml(t('api.compatAvrOnly'))}</span>`;
                if (compat === 'portable-untested') return `<span class="api-compat-badge is-beta" title="${escapeHtml(t('api.compatUntestedTitle'))}">${escapeHtml(t('api.compatUntested'))}</span>`;
                return `<span class="api-compat-badge is-verified" title="${escapeHtml(t('api.compatVerifiedTitle'))}">${escapeHtml(t('api.compatVerified'))}</span>`;
              }
              return !e.verified ? `<span class="api-beta-badge" title="${escapeHtml(t('api.betaHint'))}">BETA</span>` : '';
            })()}
            <span class="api-fn-count">${e.functions.length}</span>
          </div>
          ${isOpen ? `<div class="api-comp-body">${fnsHtml}${fieldsHtml}${macrosHtml}</div>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="api-group">
        <div class="cb-pal-group-lbl">${escapeHtml(t(grpKey))}</div>
        ${cards}
      </div>`;
  };

  const obItems = filtered.filter((e) => e.group === 'onboard');
  const extItems = filtered.filter((e) => e.group === 'external');

  // Onboard alphabetical FIRST, then External alphabetical SECOND
  const bodyHtml = filtered.length
    ? `${renderGroup('api.groupOnboard', obItems)}${renderGroup('api.groupExternal', extItems)}`
    : `<div class="api-empty">${escapeHtml(t('api.noMatches'))}</div>`;

  drawer.innerHTML = `
    <div class="api-drawer-bar">
      <input id="apiSearchInput" class="api-search-input" type="search" value="${escapeHtml(state.apiSearch || '')}" placeholder="${escapeHtml(t('api.searchPlaceholder'))}" autocomplete="off" />
      <button type="button" id="btnApiScope" class="btn btn-ghost btn-sm api-scope-btn ${state.apiShowAll ? 'is-all' : ''}" title="${escapeHtml(t('api.scopeTitle'))}">
        ${escapeHtml(state.apiShowAll ? t('api.scopeAll') : t('api.scopeActive'))}
      </button>
    </div>
    <div class="api-drawer-hint">${escapeHtml(t('api.drawerHint'))}</div>
    <div class="api-list">${bodyHtml}</div>`;

  const inp = drawer.querySelector('#apiSearchInput');
  if (inp) {
    inp.addEventListener('input', (ev: any) => {
      state.apiSearch = ev.target.value;
      const pos = ev.target.selectionStart;
      renderApiBrowserUI();
      const nextInp = $('#apiSearchInput');
      if (nextInp) {
        nextInp.focus();
        try { nextInp.setSelectionRange(pos, pos); } catch (_) {}
      }
    });
  }

  drawer.querySelector('#btnApiScope')?.addEventListener('click', () => {
    state.apiShowAll = !state.apiShowAll;
    renderApiBrowserUI();
  });

  // Strict single-open accordion + bidirectional hardware spotlight on hover/open
  drawer.querySelectorAll('[data-api-toggle]').forEach((head) => {
    const key = head.dataset.apiToggle;
    head.addEventListener('mouseenter', () => appBus.emit('hover:hw', { hwId: key }));
    head.addEventListener('mouseleave', () => appBus.emit('hover:hw', { hwId: null }));
    head.addEventListener('click', (ev: any) => {
      if (ev.target.closest('[data-api-inc]') || ev.target.closest('.api-pdf-link')) return;
      const willOpen = state.apiExpandedKey !== key;
      state.apiExpandedKey = willOpen ? key : null;
      renderApiBrowserUI();
      if (willOpen) {
        const obKey = key === 'oled_grid' ? 'onboard_oled' : key;
        if (obKey.startsWith('onboard_')) {
          appBus.emit('target:flash', { onboardId: obKey });
        } else {
          const inst = state.active.find((i) => i.compId === key);
          if (inst) appBus.emit('target:flash', { instanceId: inst.instanceId, panIfOffscreen: true });
        }
      }
    });
  });

  drawer.querySelectorAll('[data-api-inc]').forEach((btnInc) => {
    btnInc.addEventListener('click', (ev: any) => {
      ev.stopPropagation();
      const inc = btnInc.dataset.apiInc;
      copyTextWithFeedback(inc, btnInc, inc);
    });
  });

  const entryMap = new Map(filtered.map((e) => [e.key, e]));
  drawer.querySelectorAll('[data-api-copy-key]').forEach((row) => {
    row.addEventListener('click', () => {
      const ent = entryMap.get(row.dataset.apiCopyKey);
      const fn = ent && ent.functions[parseInt(row.dataset.apiFnIdx, 10)];
      if (!fn) return;
      const shortName = fn.sig.split('(')[0].trim().split(/\s+/).pop() + '()';
      copyTextWithFeedback(fn.call, row, shortName);
    });
  });

  drawer.querySelectorAll('[data-api-macro]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const mac = chip.dataset.apiMacro;
      copyTextWithFeedback(mac, chip, mac);
    });
  });
}

export function bindApiResizer() {
  const resizer = $('#apiCodeResizer');
  const drawer = $('#apiRefDrawer');
  const tabCode = $('#tabCode');
  if (!resizer || !drawer || !tabCode) return;

  let startY = 0;
  let startH = 260;

  resizer.addEventListener('pointerdown', (e: any) => {
    e.preventDefault();
    state.resizingApi = true;
    startY = e.clientY;
    startH = drawer.getBoundingClientRect().height;
    resizer.classList.add('dragging');
    document.body.classList.add('resizing-api');
    try { if (resizer.setPointerCapture) resizer.setPointerCapture(e.pointerId); } catch (_) {}
  });

  window.addEventListener('pointermove', (e: any) => {
    if (!state.resizingApi) return;
    const tabRect = tabCode.getBoundingClientRect();
    const drawerRect = drawer.getBoundingClientRect();
    const minH = 110;
    const minCodeH = 100;
    const maxH = Math.max(minH, Math.round(tabRect.bottom - drawerRect.top - minCodeH - 22));
    const newH = Math.max(minH, Math.min(maxH, Math.round(startH + (e.clientY - startY))));
    document.documentElement.style.setProperty('--api-drawer-h', `${newH}px`);
  });

  const endResize = () => {
    if (!state.resizingApi) return;
    state.resizingApi = false;
    resizer.classList.remove('dragging');
    document.body.classList.remove('resizing-api');
    saveLayoutPrefs();
  };
  window.addEventListener('pointerup', endResize);
  window.addEventListener('pointercancel', endResize);
}

export function bindApiBrowserEvents() {
  bindApiResizer();
  const btn = $('#btnToggleApiDrawer');
  if (!btn) return;
  btn.addEventListener('click', () => {
    state.apiDrawerOpen = !state.apiDrawerOpen;
    if (state.apiDrawerOpen && state.blocksDrawerOpen) {
      state.blocksDrawerOpen = false;
      $('#codeBlocksDrawer')?.classList.add('hidden');
      const blkBtn = $('#btnToggleBlocksDrawer');
      if (blkBtn) {
        blkBtn.classList.remove('is-open');
        blkBtn.setAttribute('aria-expanded', 'false');
      }
      if (!(state.codeBlocks && state.codeBlocks.length)) {
        $('#codeBlocksActive')?.classList.add('is-collapsed-empty');
      }
    }
    renderApiBrowserUI();
  });
}

// Reusable expandable library reference card (functions, struct fields, #define macros & #include)
// Used inside the Component Info popup with identical formatting & click-to-copy behavior as ƒx API
export function buildComponentApiCardHtml(compKey) {
  const LIBRARY_API = getCachedLibraryApi();
  const api = LIBRARY_API ? LIBRARY_API[compKey] : null;
  if (!api) return '';

  const entry = {
    key: compKey,
    header: api.header || '',
    verified: api.verified !== false,
    macros: api.macros || [],
    fields: api.fields || [],
    functions: api.functions || []
  };
  const isStdHeader = entry.header.endsWith('.h');
  const includeStmt = isStdHeader ? `#include <${entry.header}>` : '';

  const fnsHtml = entry.functions.map((f, idx) => `
    <button type="button"
            class="api-fn-row"
            data-info-api-fn="${idx}"
            title="${escapeHtml(t('api.clickCopyHint'))}">
      <div class="api-fn-top">
        <span class="api-phase api-phase-${escapeHtml(f.phase || 'output')}">${escapeHtml(t(`api.phase.${f.phase || 'output'}`))}</span>
        <code class="api-fn-sig">${highlightCppSignature(f.sig)}</code>
        <span class="api-copy-tag" aria-hidden="true">📋</span>
      </div>
      <div class="api-fn-desc">${formatApiDescription(getLocalizedDesc(f.desc), f.sig, entry)}</div>
    </button>`).join('');

  const fieldsHtml = entry.fields.length ? `
    <div class="api-macros-row">
      <span class="api-macros-lbl tok-kw">struct:</span>
      ${entry.fields.map((fl) => `<button type="button" class="api-macro-chip api-field-chip" data-info-api-macro=".${escapeHtml(fl)}" title="${escapeHtml(t('api.clickCopyMacro'))}"><span class="tok-var">.${escapeHtml(fl)}</span></button>`).join('')}
    </div>` : '';

  const macrosHtml = entry.macros.length ? `
    <div class="api-macros-row">
      <span class="api-macros-lbl tok-prep">#define:</span>
      ${entry.macros.map((m) => `<button type="button" class="api-macro-chip" data-info-api-macro="${escapeHtml(m)}" title="${escapeHtml(t('api.clickCopyMacro'))}">${highlightCppSignature(m)}</button>`).join('')}
    </div>` : '';

  const extraCnt = entry.fields.length + entry.macros.length;
  const countLabel = extraCnt > 0
    ? `${entry.functions.length} ƒx · ${extraCnt} #`
    : `${entry.functions.length} ƒx`;

  return `
    <div class="api-comp-card info-api-card" data-info-api-card="${escapeHtml(compKey)}">
      <div class="api-comp-head info-api-head" role="button" tabindex="0" aria-expanded="false" data-info-api-toggle="1">
        <span class="api-caret" aria-hidden="true">▸</span>
        <span class="api-comp-title">${escapeHtml(t('info.apiExpandLabel'))}</span>
        ${includeStmt
          ? `<button type="button" class="api-hdr-chip" data-info-api-inc="${escapeHtml(includeStmt)}" title="${escapeHtml(t('api.clickCopyInclude'))}"><span class="tok-hdr">&lt;${escapeHtml(entry.header)}&gt;</span></button>`
          : `<span class="api-hdr-plain">${escapeHtml(entry.header)}</span>`}
        ${!entry.verified ? `<span class="api-beta-badge" title="${escapeHtml(t('api.betaHint'))}">BETA</span>` : ''}
        <span class="api-fn-count">${escapeHtml(countLabel)}</span>
      </div>
      <div class="api-comp-body info-api-body hidden">
        <div class="info-api-hint">${escapeHtml(t('api.drawerHint'))}</div>
        ${fnsHtml}${fieldsHtml}${macrosHtml}
      </div>
    </div>`;
}

export function bindComponentApiCardEvents(containerEl, compKey) {
  if (!containerEl) return;
  const LIBRARY_API = getCachedLibraryApi();
  const api = LIBRARY_API ? LIBRARY_API[compKey] : null;
  if (!api) return;

  const card = containerEl.querySelector(`[data-info-api-card="${compKey}"]`);
  if (!card) return;
  const head = card.querySelector('[data-info-api-toggle]');
  const body = card.querySelector('.info-api-body');
  const caret = card.querySelector('.api-caret');

  const toggleCard = () => {
    const willOpen = body.classList.contains('hidden');
    body.classList.toggle('hidden', !willOpen);
    card.classList.toggle('is-open', willOpen);
    if (head) head.setAttribute('aria-expanded', String(willOpen));
    if (caret) caret.textContent = willOpen ? '▾' : '▸';
    if (willOpen) {
      setTimeout(() => { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30);
    }
  };

  if (head && body) {
    head.addEventListener('click', (ev: any) => {
      if (ev.target.closest('[data-info-api-inc]')) return;
      toggleCard();
    });
    head.addEventListener('keydown', (ev: any) => {
      if (ev.target.closest('[data-info-api-inc]')) return;
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggleCard();
      }
    });
  }

  card.querySelectorAll('[data-info-api-inc]').forEach((btnInc) => {
    btnInc.addEventListener('click', (ev: any) => {
      ev.stopPropagation();
      const inc = btnInc.dataset.infoApiInc;
      copyTextWithFeedback(inc, btnInc, inc);
    });
  });

  const fns = api.functions || [];
  card.querySelectorAll('[data-info-api-fn]').forEach((row) => {
    row.addEventListener('click', () => {
      const fn = fns[parseInt(row.dataset.infoApiFn, 10)];
      if (!fn) return;
      const shortName = fn.sig.split('(')[0].trim().split(/\s+/).pop() + '()';
      copyTextWithFeedback(fn.call, row, shortName);
    });
  });

  card.querySelectorAll('[data-info-api-macro]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const mac = chip.dataset.infoApiMacro;
      copyTextWithFeedback(mac, chip, mac);
    });
  });
}
