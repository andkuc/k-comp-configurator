// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Left Catalog, Onboard Strip, Footer Gauges, Warnings, Right Inspector, Tooltips & Resizers
import { resolveAssetUrl } from '../core/constants';
import { state, hooks, $, escapeHtml, isMobileViewport, setMobileView, applyPanelCollapseState, saveLayoutPrefs, getActiveOnboardDefs, formatRamAmount } from '../core/state';
import {
  getCompDef, countActiveByCompId, getDisplayLabel, getInstanceAddress,
  getExternalPinClaims, getOnboardPinUsage, addComponent, removeComponent,
  toggleDipSwitch, toggleOnboardComponent, computeUartAssignments
} from '../core/hardware';
import { t, tComp, tOnboard, tPreset, tCategory, tBlockedPin } from '../i18n/index';
import { DEFAULT_BOARD_ID, getActiveBoard } from '../boards';

function getCssPxVar(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const val = parseFloat(raw);
  return Number.isFinite(val) ? val : fallback;
}

export function bindSidebarResizer() {
  const resizer = $('#sidebarResizer');
  if (!resizer) return;

  const colBtn = $('#btnCollapseSidebar');
  if (colBtn) {
    colBtn.addEventListener('pointerdown', (e: any) => e.stopPropagation());
    colBtn.addEventListener('click', (e: any) => {
      e.stopPropagation();
      state.sidebarCollapsed = !state.sidebarCollapsed;
      applyPanelCollapseState();
      saveLayoutPrefs();
      hooks.applyViewBox();
    });
  }

  resizer.addEventListener('click', (e: any) => {
    if (state.sidebarCollapsed && !e.target.closest('.resizer-collapse-btn')) {
      state.sidebarCollapsed = false;
      applyPanelCollapseState();
      saveLayoutPrefs();
      hooks.applyViewBox();
    }
  });

  resizer.addEventListener('pointerdown', (e: any) => {
    if (e.target.closest('.resizer-collapse-btn') || state.sidebarCollapsed) return;
    e.preventDefault();
    state.resizingSidebar = true;
    resizer.classList.add('dragging');
    document.body.classList.add('resizing-sidebar');
  });

  window.addEventListener('pointermove', (e: any) => {
    if (!state.resizingSidebar) return;
    const inspW = state.inspectorCollapsed ? 16 : getCssPxVar('--inspector-w', 330);
    const minW = 240;
    const maxW = Math.max(minW, Math.min(560, window.innerWidth - inspW - 340));
    const newW = Math.max(minW, Math.min(maxW, e.clientX));
    document.documentElement.style.setProperty('--sidebar-w', `${Math.round(newW)}px`);
  });

  const endResize = () => {
    if (!state.resizingSidebar) return;
    state.resizingSidebar = false;
    resizer.classList.remove('dragging');
    document.body.classList.remove('resizing-sidebar');
    saveLayoutPrefs();
  };
  window.addEventListener('pointerup', endResize);
  window.addEventListener('pointercancel', endResize);
}

export function bindInspectorResizer() {
  const resizer = $('#inspectorResizer');
  if (!resizer) return;

  const colBtn = $('#btnCollapseInspector');
  if (colBtn) {
    colBtn.addEventListener('pointerdown', (e: any) => e.stopPropagation());
    colBtn.addEventListener('click', (e: any) => {
      e.stopPropagation();
      state.inspectorCollapsed = !state.inspectorCollapsed;
      applyPanelCollapseState();
      saveLayoutPrefs();
      hooks.applyViewBox();
    });
  }

  resizer.addEventListener('click', (e: any) => {
    if (state.inspectorCollapsed && !e.target.closest('.resizer-collapse-btn')) {
      state.inspectorCollapsed = false;
      applyPanelCollapseState();
      saveLayoutPrefs();
      hooks.applyViewBox();
    }
  });

  resizer.addEventListener('pointerdown', (e: any) => {
    if (e.target.closest('.resizer-collapse-btn') || state.inspectorCollapsed) return;
    e.preventDefault();
    state.resizingInspector = true;
    resizer.classList.add('dragging');
    document.body.classList.add('resizing-inspector');
  });

  window.addEventListener('pointermove', (e: any) => {
    if (!state.resizingInspector) return;
    const sideW = state.sidebarCollapsed ? 16 : getCssPxVar('--sidebar-w', 326);
    const minW = 240;
    const maxW = Math.max(minW, Math.min(720, window.innerWidth - sideW - 340));
    const newW = Math.max(minW, Math.min(maxW, window.innerWidth - e.clientX));
    document.documentElement.style.setProperty('--inspector-w', `${Math.round(newW)}px`);
  });

  const endResize = () => {
    if (!state.resizingInspector) return;
    state.resizingInspector = false;
    resizer.classList.remove('dragging');
    document.body.classList.remove('resizing-inspector');
    saveLayoutPrefs();
  };
  window.addEventListener('pointerup', endResize);
  window.addEventListener('pointercancel', endResize);
}


let onboardResizeObserver: ResizeObserver | null = null;
let onboardWrapRaf = 0;
let lastOnboardStripWidth = -1;

export function syncOnboardWrapLayout(force = false) {
  const strip = $('#onboardStrip');
  if (!strip) return;
  const availW = Math.floor(strip.clientWidth);
  if (availW <= 0) return;
  if (!force && availW === lastOnboardStripWidth) return;
  lastOnboardStripWidth = availW;

  const pills = Array.from(strip.querySelectorAll<any>('.ob-pill'));
  const brk = strip.querySelector<any>('.ob-row-break');
  if (!pills.length || !brk) return;

  const gap = 5; // matches CSS column-gap: 5px
  const widths = pills.map((p) => Math.ceil(p.getBoundingClientRect().width));
  const totalW = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);

  if (totalW <= availW) {
    brk.classList.add('hidden');
    return;
  }

  // Find the most balanced 2-row split point minimizing max(row1Width, row2Width)
  let bestIdx = -1;
  let bestMax = Infinity;
  let r1 = 0;
  for (let i = 1; i < pills.length; i++) {
    r1 += widths[i - 1] + (i > 1 ? gap : 0);
    let r2 = 0;
    for (let j = i; j < pills.length; j++) {
      r2 += widths[j] + (j > i ? gap : 0);
    }
    const maxW = Math.max(r1, r2);
    if (r1 <= availW && r2 <= availW && maxW < bestMax) {
      bestMax = maxW;
      bestIdx = i;
    }
  }

  if (bestIdx > 0) {
    if (pills[bestIdx].previousElementSibling !== brk) {
      strip.insertBefore(brk, pills[bestIdx]);
    }
    brk.classList.remove('hidden');
  } else {
    // Very narrow container: let natural flex-wrap distribute pills cleanly
    brk.classList.add('hidden');
  }
}

function ensureOnboardResizeObserver() {
  if (onboardResizeObserver || typeof ResizeObserver === 'undefined') return;
  const strip = $('#onboardStrip');
  if (!strip) return;
  onboardResizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(onboardWrapRaf);
    onboardWrapRaf = requestAnimationFrame(() => syncOnboardWrapLayout(false));
  });
  onboardResizeObserver.observe(strip);
}

export function renderOnboardBar(dipStates) {
  const strip = $('#onboardStrip');
  const dipById = {};
  dipStates.forEach((d) => { dipById[d.id] = d; });

  const board = getActiveBoard();
  const extClaims = getExternalPinClaims();
  const obDefs = getActiveOnboardDefs();
  const chips = obDefs.map((ob) => {
    const dip = ob.dip ? dipById[ob.dip] : null;
    const claimedPin = Array.isArray(ob.pins) ? ob.pins.find((p) => extClaims[p.pinId]) : null;
    const extBlocked = (dip && dip.forcedOff) || !!claimedPin;
    const isOn = dip ? dip.on : (!extBlocked && !!state.onboard[ob.id]);
    const obName = tOnboard(ob, 'name');
    const obShort = tOnboard(ob, 'shortName') || obName;
    const tag = ob.dip
      ? `S1-${ob.dip}`
      : (ob.id === 'onboard_oled' ? (state.oledPaged ? t('bottom.oledShortPaged') : t('bottom.oledShortFull')) : (ob.pinInfo || '').split(' ')[0]);
    const blockReason = dip?.reason || (claimedPin ? extClaims[claimedPin.pinId].compName : '');
    const title = extBlocked
      ? t('onboard.disabledReason', { name: obName, reason: blockReason })
      : t('onboard.toggleTitle', { name: obName, pinInfo: ob.pinInfo || '', action: isOn ? t('onboard.actionDisable') : t('onboard.actionEnable') });

    return `
      <button class="ob-pill ${isOn ? 'active' : ''} ${extBlocked ? 'ext-blocked' : ''}"
              style="--ob-accent:${ob.accent || '#38bdf8'}"
              data-ob-toggle="${ob.id}" title="${escapeHtml(title)}">
        <span class="ob-dot"></span>
        <span>${escapeHtml(obShort)}</span>
        <span class="ob-dip-tag">${extBlocked ? 'EXT' : escapeHtml(tag)}</span>
      </button>`;
  });

  if (board.capabilities.hasWirelessSlot) {
    const wForcedOff = dipById[7]?.forcedOff || dipById[8]?.forcedOff;
    const wActive = !wForcedOff && (dipById[7]?.on || dipById[8]?.on);
    chips.push(`
      <button class="ob-pill ${wActive ? 'active' : ''} ${wForcedOff ? 'ext-blocked' : ''}"
              style="--ob-accent:#c084fc"
              data-ob-toggle="onboard_wireless"
              title="${escapeHtml(wForcedOff ? t('onboard.wirelessBlocked') : t('onboard.wirelessTitle'))}">
        <span class="ob-dot"></span>
        <span>${escapeHtml(t('onboard.wireless'))}</span>
        <span class="ob-dip-tag">${wForcedOff ? 'EXT' : 'S1-7,8'}</span>
      </button>`);
  }

  strip.innerHTML = chips.join('') + '<span class="ob-row-break hidden" aria-hidden="true"></span>';
  strip.querySelectorAll<any>('[data-ob-toggle]').forEach((btn) => {
    const obId = btn.dataset.obToggle;
    btn.addEventListener('click', () => toggleOnboardComponent(obId));
    btn.addEventListener('mouseenter', () => hooks.setHwHover(obId));
    btn.addEventListener('mouseleave', () => hooks.setHwHover(null));
  });
  ensureOnboardResizeObserver();
  syncOnboardWrapLayout(true);
}

export function renderDipStrip(dipStates) {
  const strip = $('#dipStrip');
  if (!strip) return;
  strip.innerHTML = dipStates.map((d) =>
    `<button class="dip-pill ${d.on ? 'on' : 'off'} ${d.lockedOn ? 'locked' : ''}" data-dip-btn="${d.id}" title="S1-${d.id} (${d.pin}): ${escapeHtml(d.reason)}">${d.id}:${d.on ? 'ON' : 'OFF'}</button>`
  ).join('');
  strip.querySelectorAll<any>('[data-dip-btn]').forEach((btn) => {
    btn.addEventListener('click', () => toggleDipSwitch(parseInt(btn.dataset.dipBtn, 10)));
  });
}

export function renderCategoryTabs() {
  const field = state.groupMode === 'topic' ? 'topic' : 'category';
  const rawCats = [...new Set(state.catalog.components.map((c) => c[field]).filter(Boolean))];
  const cats = ['All', ...rawCats];
  if (!cats.includes(state.category)) state.category = 'All';

  document.querySelectorAll<any>('.grp-mode-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.groupMode === state.groupMode);
  });

  const container = $('#categoryTabs');
  container.innerHTML = cats.map((c) =>
    `<button class="cat-btn ${state.category === c ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(tCategory(c))}</button>`
  ).join('');
  container.querySelectorAll<any>('.cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = btn.dataset.cat;
      renderCategoryTabs();
      renderCatalogList();
    });
  });
}

export function badgeClass(iface) {
  if (iface.includes('I2C')) return 'badge-i2c';
  if (iface.includes('UART') || iface.includes('SLOT')) return 'badge-uart';
  if (iface.includes('PWM')) return 'badge-pwm';
  if (iface.includes('ANALOG')) return 'badge-analog';
  if (iface.includes('DRIVER')) return 'badge-warn';
  return '';
}

export function shortInterfaceLabel(iface) {
  if (iface === 'ONBOARD SLOT') return t('iface.slot');
  if (iface === 'DRIVER ONLY') return t('iface.driver');
  if (iface === 'INTERRUPT') return 'INT';
  if (iface === 'ANALOG / DIG') return 'ANALOG';
  if (iface === 'PWM / DIG') return 'PWM';
  return iface;
}

export function renderCatalogList() {
  const q = state.search.trim().toLowerCase();
  const field = state.groupMode === 'topic' ? 'topic' : 'category';
  const list = state.catalog.components.filter((c) => {
    if (state.category !== 'All' && c[field] !== state.category) return false;
    if (!q) return true;
    const infoTxt = c.studentInfo ? c.studentInfo.whatItDoes : '';
    const locSub = tComp(c, 'subtitle');
    const locName = getDisplayLabel(c);
    return `${locName} ${locSub} ${c.friendlyName || ''} ${c.name} ${c.subtitle} ${c.topic || ''} ${c.interface} ${c.i2cAddr || ''} ${infoTxt}`.toLowerCase().includes(q);
  });

  const container = $('#catalogList');
  container.innerHTML = list.map((c) => {
    const cnt = countActiveByCompId(c.id);
    const max = c.maxPerDesign ?? 1;
    const maxed = cnt >= max;
    const btnText = maxed ? (max === 1 ? '✓' : `${cnt}/${max}`) : (cnt ? `${cnt}/${max}` : '+');
    const roleTitle = getDisplayLabel(c);
    const limitTitle = maxed
      ? t('catalog.maxTitle', { max, reason: tComp(c, 'maxReason') || t('catalog.limitReached') })
      : t('catalog.addTitle', { role: roleTitle, model: c.name });
    const secondBadge = c.protoArea
      ? `<span class="badge badge-proto" title="${escapeHtml(tComp(c, 'protoNote') || t('catalog.protoFallback'))}">PROTO</span>`
      : (c.i2cAddr
          ? `<span class="badge">${c.i2cAddr}</span>`
          : (c.voltage.includes('ONLY') ? `<span class="badge badge-warn">3.3V!</span>` : ''));

    const activeCountChip = cnt
      ? `<span class="cat-active-qty" title="${escapeHtml(t('catalog.placedCount', { count: cnt }))}">×${cnt}</span>`
      : '';
    const locateBtn = cnt
      ? `<button class="cat-locate-btn" type="button" data-cat-locate="${c.id}" title="${escapeHtml(t('catalog.locateTitle', { role: roleTitle }))}" aria-label="${escapeHtml(t('catalog.locateTitle', { role: roleTitle }))}">⌖</button>`
      : '';

    return `
      <div class="cat-item ${cnt ? 'added' : ''} ${maxed ? 'maxed' : ''}" data-add="${c.id}" title="${escapeHtml(limitTitle)}">
        <img class="cat-thumb" src="${resolveAssetUrl(c.svgFile)}" alt="${escapeHtml(roleTitle)}" loading="lazy" />
        <div class="cat-meta">
          <div class="cat-role">${escapeHtml(roleTitle)}${activeCountChip}</div>
          <div class="cat-model">${escapeHtml(c.name)}</div>
        </div>
        <div class="cat-right">
          <div class="cat-badges-right">
            <span class="badge ${badgeClass(c.interface)}">${shortInterfaceLabel(c.interface)}</span>
            ${secondBadge}
          </div>
          ${locateBtn}
          <button class="cat-info-btn" type="button" data-info="${c.id}" title="${escapeHtml(t('catalog.infoTitle', { role: roleTitle }))}">i</button>
          <button class="cat-add-btn" type="button" aria-label="${escapeHtml(t('catalog.addAria', { role: roleTitle }))}">${btnText}</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll<any>('.cat-locate-btn').forEach((btn) => {
    btn.addEventListener('click', (e: any) => {
      e.stopPropagation();
      const cid = btn.dataset.catLocate;
      const matches = state.active.filter((i) => i.compId === cid);
      if (!matches.length) return;
      const curIdx = matches.findIndex((i) => i.instanceId === state.focusedId);
      const next = matches[(curIdx + 1) % matches.length];
      state.focusedId = next.instanceId;
      if (isMobileViewport()) setMobileView('board');
      hooks.recomputeAndRender();
      hooks.flashTarget({ instanceId: next.instanceId, panIfOffscreen: true });
    });
  });

  container.querySelectorAll<any>('.cat-info-btn').forEach((btn) => {
    btn.addEventListener('click', (e: any) => {
      e.stopPropagation();
      hooks.openComponentInfo(btn.dataset.info);
    });
  });

  container.querySelectorAll<any>('.cat-item').forEach((item) => {
    const cid = item.dataset.add;
    item.addEventListener('click', (e: any) => {
      if (e.target.closest('.cat-info-btn') || e.target.closest('.cat-locate-btn')) return;
      addComponent(cid);
    });
    if (item.classList.contains('added')) {
      item.addEventListener('mouseenter', () => hooks.setHwHover(cid));
      item.addEventListener('mouseleave', () => hooks.setHwHover(null));
    }
  });
}

export function renderSram(sramInfo) {
  const used = typeof sramInfo === 'object' && sramInfo !== null ? sramInfo.used : Number(sramInfo || 0);
  const total = typeof sramInfo === 'object' && sramInfo !== null ? sramInfo.total : getActiveBoard().sramTotal;
  const breakdown = typeof sramInfo === 'object' && sramInfo !== null && Array.isArray(sramInfo.breakdown) ? sramInfo.breakdown : [];
  const pct = Math.min(100, Math.round((used / total) * 100));
  const pill = $('#sramText');
  if (pill) {
    const lvl = pct >= 85 ? 'danger' : pct >= 70 ? 'warn' : 'ok';
    pill.innerHTML = `<span class="gauge-lbl">SRAM ${pct}%</span><span class="gauge-track"><span class="gauge-fill is-${lvl}" style="width:${pct}%"></span></span>`;
    const fmt = formatRamAmount(used, total);
    const head = total >= 16384
      ? `RAM: ${fmt.usedStr} / ${fmt.totalStr} (${pct}%)`
      : t('bottom.sramTitle', { used, total });
    pill.title = breakdown.length ? `${head}\n${breakdown.join('\n')}` : head;
    pill.className = 'sram-pill has-gauge' + (lvl !== 'ok' ? ' ' + lvl : '');
  }

  const oledBtn = $('#btnOledMode');
  if (oledBtn) {
    const oledOn = getActiveBoard().id === 'kcomp-v2' && !!state.onboard.onboard_oled;
    oledBtn.classList.toggle('hidden', !oledOn);
    if (oledOn) {
      const suggest = !state.oledPaged && pct >= 70;
      oledBtn.textContent = state.oledPaged ? t('bottom.oledPaged') : (suggest ? t('bottom.oledSuggest') : t('bottom.oledFull'));
      oledBtn.className = 'btn-oled-mode' + (state.oledPaged ? ' is-paged' : (suggest ? ' suggest-paged' : ''));
      oledBtn.title = state.oledPaged ? t('bottom.oledPagedTitle') : t('bottom.oledFullTitle');
    }
  }
}

export function renderCurrent(cur) {
  const pill = $('#currentText');
  if (!pill) return;
  const maxMa = getActiveBoard().electrical?.usbMaxMa || state.catalog.usbCurrentMaxMa || 500;
  const pct = Math.min(100, Math.round((cur.total / maxMa) * 100));
  const lvl = cur.total >= 450 ? 'danger' : cur.total >= 350 ? 'warn' : 'ok';
  pill.innerHTML = `<span class="gauge-lbl">5V ~${cur.total}mA</span><span class="gauge-track"><span class="gauge-fill is-${lvl}" style="width:${pct}%"></span></span>`;
  pill.title = `${t('bottom.currentTitle', { total: cur.total, max: maxMa })}\n${cur.breakdown.join('\n')}`;
  pill.className = 'sram-pill current-pill has-gauge' + (lvl !== 'ok' ? ' ' + lvl : '');
}

export function renderWarnings(warns) {
  const bar = $('#warningsBar');
  if (!warns.length) { bar.classList.add('hidden'); bar.classList.remove('is-advisory-only'); return; }
  bar.classList.remove('hidden');
  bar.classList.toggle('is-advisory-only', warns.every((w) => !!w.advisory));
  bar.innerHTML = warns.map((w, idx) => {
    const quickHtml = (w.quickActions && w.quickActions.length)
      ? w.quickActions.map((qa) => `<button class="warn-quick-btn" type="button" data-quick-free="${qa.onboardId}">${escapeHtml(t('warn.disableBtn', { label: qa.label }))}</button>`).join('')
      : '';
    const hasTarget = !!w.target;
    const locateHint = hasTarget ? ` title="${escapeHtml(t('warn.clickToLocate'))}"` : '';
    const jumpIcon = hasTarget ? `<span class="warn-locate-ico" aria-hidden="true">⌖</span>` : '';
    const ico = w.actionNeeded ? '⚡' : (w.advisory ? 'ℹ' : '⚠');
    const cls = `warn-item${w.actionNeeded ? ' action-needed' : ''}${w.advisory ? ' is-advisory' : ''}${hasTarget ? ' is-clickable' : ''}`;
    return `<div class="${cls}" data-warn-idx="${idx}"${locateHint}><span>${ico}</span><span class="warn-text">${escapeHtml(w.text)}</span>${quickHtml}${jumpIcon}</div>`;
  }).join('');
  bar.querySelectorAll<any>('[data-quick-free]').forEach((btn) => {
    btn.addEventListener('click', (e: any) => {
      e.stopPropagation();
      toggleOnboardComponent(btn.dataset.quickFree);
    });
  });
  bar.querySelectorAll<any>('.warn-item.is-clickable').forEach((row) => {
    row.addEventListener('click', (e: any) => {
      if (e.target.closest('[data-quick-free]')) return;
      const w = warns[parseInt(row.dataset.warnIdx, 10)];
      if (!w || !w.target) return;
      if (w.target.instanceId) {
        state.focusedId = w.target.instanceId;
        hooks.recomputeAndRender();
      }
      hooks.flashTarget(w.target);
    });
  });
}

export function buildAllBoardPinsHtml(dipStates) {
  const extClaims = getExternalPinClaims();
  const obUsage = getOnboardPinUsage();
  const allPins = getActiveBoard().pins;
  const flt = state.pinFilter || 'all';
  const keepRow = (isFree) => flt === 'all' || (flt === 'free' ? isFree : !isFree);
  const wrapGroup = (grpId, title, badgeHtml, rowsHtml) => {
    const isCollapsed = state.collapsedPinGroups && state.collapsedPinGroups.has(grpId);
    const body = rowsHtml || `<div class="bp-empty">${escapeHtml(t('inspector.pinFilterEmpty'))}</div>`;
    return `
      <div class="pin-group-box ${isCollapsed ? 'is-collapsed' : ''}">
        <button type="button" class="pin-group-head" data-pin-group="${grpId}" aria-expanded="${!isCollapsed}">
          <span class="pin-group-title"><span class="bp-caret" aria-hidden="true">${isCollapsed ? '▸' : '▾'}</span>${escapeHtml(title)}</span>
          ${badgeHtml}
        </button>
        ${isCollapsed ? '' : `<div class="pin-group-rows">${body}</div>`}
      </div>`;
  };

  const renderSignalRow = (bpId, displayName, capHint) => {
    const meta = allPins[bpId];
    const ext = extClaims[bpId];
    const ob = obUsage[bpId];

    if (meta && meta.blocked) {
      if (!keepRow(false)) return '';
      const shortReason = tBlockedPin(bpId, false) || meta.reason || 'Reserved';
      return `
        <div class="bp-row is-reserved" title="${escapeHtml(tBlockedPin(bpId, true))}">
          <span class="bp-left">
            <span class="pin-dot" style="background:#ef4444"></span>
            <span class="bp-name">${displayName}</span>
            ${capHint ? `<span class="bp-cap">${capHint}</span>` : ''}
          </span>
          <span class="bp-right"><span class="bp-status-who">🔒 ${shortReason}</span></span>
        </div>`;
    }

    if (ext) {
      if (!keepRow(false)) return '';
      const inst = state.active.find((i) => i.instanceId === ext.instanceId);
      const def = inst ? getCompDef(inst.compId) : null;
      const pSpec = def ? def.pins.find((p) => p.id === ext.compPinId) : null;
      const dotCol = pSpec ? pSpec.color : '#38bdf8';
      const whoLbl = `${def ? getDisplayLabel(def) : ext.compName} (${ext.compPinId})`;
      return `
        <div class="bp-row is-clickable" data-focus-pin="${ext.instanceId}" title="${escapeHtml(t('inspector.pinClickFocus', { who: whoLbl }))}">
          <span class="bp-left">
            <span class="pin-dot" style="background:${dotCol}"></span>
            <span class="bp-name">${displayName}</span>
            ${capHint ? `<span class="bp-cap">${capHint}</span>` : ''}
          </span>
          <span class="bp-right"><span class="bp-status-who">${escapeHtml(whoLbl)}</span></span>
        </div>`;
    }

    if (ob) {
      if (!keepRow(false)) return '';
      const tag = ob.dip ? `S1-${ob.dip}` : 'ON';
      const canToggle = !ob.hardwired && !ob.lockedBySlot;
      return `
        <div class="bp-row is-onboard" title="${escapeHtml(t('inspector.pinOnboardTitle', { name: ob.name }))}">
          <span class="bp-left">
            <span class="pin-dot" style="background:${ob.color}"></span>
            <span class="bp-name">${displayName}</span>
            ${capHint ? `<span class="bp-cap">${capHint}</span>` : ''}
          </span>
          <span class="bp-right">
            <span class="bp-status-who">${escapeHtml(ob.name)} (${tag})</span>
            ${canToggle ? `<button class="bp-free-btn" type="button" data-free-ob="${ob.onboardId}" title="${escapeHtml(t('inspector.btnFreeTitle', { name: ob.name, pin: bpId }))}">${escapeHtml(t('inspector.btnFree'))}</button>` : ''}
          </span>
        </div>`;
    }

    if (!keepRow(true)) return '';
    return `
      <div class="bp-row is-free" title="${escapeHtml(t('inspector.pinFreeTitle', { pin: displayName }))}">
        <span class="bp-left">
          <span class="pin-dot" style="background:#22c55e"></span>
          <span class="bp-name">${displayName}</span>
          ${capHint ? `<span class="bp-cap">${capHint}</span>` : ''}
        </span>
        <span class="bp-right"><span class="bp-status-free">${escapeHtml(t('inspector.statusFree'))}</span></span>
      </div>`;
  };

  const board = getActiveBoard();
  if (board.id !== 'kcomp-v2') {
    const entries = Object.entries(allPins);
    const analogPins = entries.filter(([, m]) => m.group === 'analog').map(([id, m]) => [id, id, m.capHint || 'ADC']);
    const digitalPins = entries.filter(([, m]) => m.group === 'digital').map(([id, m]) => [id, id, m.capHint || (m.strapping ? 'STRAP' : '')]);
    const i2cPins = entries.filter(([, m]) => m.group === 'i2c').map(([id, m]) => [id, id, m.capHint || 'I2C']);
    const analogFreeN = analogPins.filter(([id]) => !allPins[id]?.blocked && !extClaims[id] && !obUsage[id]).length;
    const digitalFreeN = digitalPins.filter(([id]) => !allPins[id]?.blocked && !extClaims[id] && !obUsage[id]).length;
    const i2cExtNamesN = state.active.filter((i) => getCompDef(i.compId)?.interface === 'I2C').map((i) => getDisplayLabel(getCompDef(i.compId)));
    const i2cSummaryN = i2cExtNamesN.length ? t('inspector.i2cBusUsed', { count: i2cExtNamesN.length, list: i2cExtNamesN.slice(0, 2).join(', ') }) : t('inspector.i2cBusFree');
    const i2cRowsN = i2cPins.map(([id, lbl, cap]) => keepRow(!i2cExtNamesN.length) ? `
      <div class="bp-row ${!i2cExtNamesN.length ? 'is-free' : ''}">
        <span class="bp-left"><span class="pin-dot" style="background:${id === 'GPIO8' ? '#10b981' : '#eab308'}"></span><span class="bp-name">${lbl}</span><span class="bp-cap">${cap}</span></span>
        <span class="bp-right"><span class="bp-status-who">${escapeHtml(i2cSummaryN)}</span></span>
      </div>` : '').join('');
    const countCap = (capName) => state.active.filter((i) => Object.values(i.pinMap).some((bp) => allPins[bp as string]?.caps?.includes(capName))).length;
    const sharedLblN = t('inspector.shared');
    const availLblN = t('inspector.available');
    const fmtModN = (cnt) => cnt === 1 ? t('inspector.modCount', { count: cnt }) : t('inspector.modCountPlural', { count: cnt });
    const c3v3N = countCap('3V3'), c5vN = countCap('5V'), cGndN = countCap('GND'), cRstN = countCap('RESET');
    const powerRowsN = [
      ['3.3V', '#fb923c', sharedLblN, c3v3N ? fmtModN(c3v3N) : availLblN, c3v3N === 0],
      ['5V (VBUS)', '#ef4444', sharedLblN, c5vN ? fmtModN(c5vN) : availLblN, c5vN === 0],
      ['GND', '#64748b', sharedLblN, cGndN ? fmtModN(cGndN) : availLblN, cGndN === 0],
      ['RST / EN', '#a855f7', sharedLblN, cRstN ? fmtModN(cRstN) : availLblN, cRstN === 0]
    ].filter(([, , , , isFree]) => keepRow(isFree)).map(([name, col, cap, txt]) => `
      <div class="bp-row">
        <span class="bp-left"><span class="pin-dot" style="background:${col}"></span><span class="bp-name">${name}</span><span class="bp-cap">${escapeHtml(cap)}</span></span>
        <span class="bp-right"><span class="bp-status-who">${escapeHtml(txt)}</span></span>
      </div>`).join('');
    const filterTabsN = `
      <div class="pin-filter-bar" role="tablist">
        <button type="button" class="pin-flt-btn ${flt === 'all' ? 'active' : ''}" data-pin-filter="all">${escapeHtml(t('inspector.pinFilterAll'))}</button>
        <button type="button" class="pin-flt-btn ${flt === 'used' ? 'active' : ''}" data-pin-filter="used">${escapeHtml(t('inspector.pinFilterUsed'))}</button>
        <button type="button" class="pin-flt-btn ${flt === 'free' ? 'active' : ''}" data-pin-filter="free">${escapeHtml(t('inspector.pinFilterFree'))}</button>
      </div>`;
    return `
      <div class="board-pins-panel">
        <div class="section-mini-head">
          <span>${escapeHtml(board.shortName)} — ${escapeHtml(t('inspector.boardPinsHead'))}</span>
          <span>${escapeHtml(t('inspector.freeIoCount', { count: digitalFreeN + analogFreeN }))}</span>
        </div>
        ${filterTabsN}
        ${wrapGroup('analog', 'ADC1 (Wi-Fi Safe)', `<span class="pin-group-free ${analogFreeN ? '' : 'none-free'}">${escapeHtml(t('inspector.freeCount', { count: analogFreeN }))}</span>`, analogPins.map(([id, lbl, cap]) => renderSignalRow(id, lbl, cap)).join(''))}
        ${wrapGroup('digital', t('inspector.groupDigital'), `<span class="pin-group-free ${digitalFreeN ? '' : 'none-free'}">${escapeHtml(t('inspector.freeCount', { count: digitalFreeN }))}</span>`, digitalPins.map(([id, lbl, cap]) => renderSignalRow(id, lbl, cap)).join(''))}
        ${wrapGroup('i2c', 'I²C (GPIO Matrix)', `<span class="pin-group-free">${escapeHtml(sharedLblN)}</span>`, i2cRowsN)}
        ${wrapGroup('power', t('inspector.groupPower'), `<span class="pin-group-free">${escapeHtml(sharedLblN)}</span>`, powerRowsN)}
      </div>`;
  }

  const digitalList = [
    ['D13', 'D13', ''],
    ['D12', 'D12', ''],
    ['D11', '~D11', 'PWM'],
    ['D10', '~D10', 'PWM'],
    ['D9',  '~D9',  'PWM'],
    ['D8',  'D8',   ''],
    ['D7',  'D7',   ''],
    ['D6',  '~D6',  'PWM'],
    ['D5',  '~D5',  'PWM'],
    ['D4',  'D4',   ''],
    ['D3',  '~D3',  'PWM/INT'],
    ['D2',  'D2',   'INT0'],
    ['D1',  'D1',   'TX'],
    ['D0',  'D0',   'RX']
  ];
  const digitalFree = digitalList.filter(([id]) => !allPins[id]?.blocked && !extClaims[id] && !obUsage[id]).length;
  const digitalRowsHtml = digitalList.map(([id, lbl, cap]) => renderSignalRow(id, lbl, cap)).join('');

  const analogSig = [
    ['A0', 'A0', 'ADC'],
    ['A1', 'A1', 'ADC'],
    ['A2', 'A2', 'ADC'],
    ['A3', 'A3', 'ADC']
  ];
  const analogFree = analogSig.filter(([id]) => !allPins[id]?.blocked && !extClaims[id] && !obUsage[id]).length;
  const i2cExtNames = state.active
    .filter((i) => getCompDef(i.compId).interface === 'I2C')
    .map((i) => getDisplayLabel(getCompDef(i.compId)));
  const i2cUsers = [...(state.onboard.onboard_oled ? ['OLED'] : []), ...i2cExtNames];
  const i2cSummary = i2cUsers.length
    ? t('inspector.i2cBusUsed', { count: i2cUsers.length, list: `${i2cUsers.slice(0, 2).join(', ')}${i2cUsers.length > 2 ? '…' : ''}` })
    : t('inspector.i2cBusFree');
  const i2cFree = !i2cUsers.length;
  const analogRowsHtml = [
    ...analogSig.map(([id, lbl, cap]) => renderSignalRow(id, lbl, cap)),
    keepRow(i2cFree) ? `<div class="bp-row ${i2cFree ? 'is-free' : ''}">
       <span class="bp-left"><span class="pin-dot" style="background:#10b981"></span><span class="bp-name">A4</span><span class="bp-cap">SDA</span></span>
       <span class="bp-right"><span class="bp-status-who" title="${escapeHtml(i2cSummary)}">${escapeHtml(i2cSummary)}</span></span>
     </div>` : '',
    keepRow(i2cFree) ? `<div class="bp-row ${i2cFree ? 'is-free' : ''}">
       <span class="bp-left"><span class="pin-dot" style="background:#eab308"></span><span class="bp-name">A5</span><span class="bp-cap">SCL</span></span>
       <span class="bp-right"><span class="bp-status-who" title="${escapeHtml(i2cSummary)}">${escapeHtml(i2cSummary)}</span></span>
     </div>` : ''
  ].join('');

  const i2cHeadersList = [
    ['H1', t('inspector.headerTopLeft')],
    ['H2', t('inspector.headerMidRight')],
    ['H3', t('inspector.headerBotRight')]
  ];
  let i2cFreeCount = 0;
  const i2cRowsHtml = i2cHeadersList.map(([hk, loc]) => {
    const assigned = state.active.filter((i) => i.i2cHeader === hk);
    if (!assigned.length) {
      i2cFreeCount++;
      if (!keepRow(true)) return '';
      return `
        <div class="bp-row is-free">
          <span class="bp-left"><span class="pin-dot" style="background:#22c55e"></span><span class="bp-name">${hk}</span><span class="bp-cap">${escapeHtml(loc)}</span></span>
          <span class="bp-right"><span class="bp-status-free">${escapeHtml(t('inspector.statusFree'))}</span></span>
        </div>`;
    }
    if (!keepRow(false)) return '';
    const firstId = assigned[0].instanceId;
    const lbl = assigned.map((i) => {
      const d = getCompDef(i.compId);
      const a = getInstanceAddress(i);
      return `${getDisplayLabel(d)}${a ? ' (' + a + ')' : ''}`;
    }).join(' + ');
    return `
      <div class="bp-row is-clickable" data-focus-pin="${firstId}" title="${escapeHtml(lbl)}">
        <span class="bp-left"><span class="pin-dot" style="background:#a855f7"></span><span class="bp-name">${hk}</span><span class="bp-cap">${escapeHtml(loc)}</span></span>
        <span class="bp-right"><span class="bp-status-who">${escapeHtml(lbl)}</span></span>
      </div>`;
  }).join('');
  const i2cExpRails = (state.breadboardRails || []).filter((r) => r.isI2cExpansion);
  const i2cExpRowHtml = i2cExpRails.length ? (() => {
    const cols = [...new Set(i2cExpRails.flatMap((r) => r.colNames))];
    const colRange = cols.length > 1 ? `${cols[0]}–${cols[cols.length - 1]}` : cols[0];
    const hdr = i2cExpRails[0].i2cHeader || 'H3';
    const modCnt = i2cExpRails[0].branches.length;
    const desc = t('inspector.i2cExpandedRow', { cols: colRange, count: modCnt, header: hdr });
    return `
      <div class="bp-row is-i2c-expanded" title="${escapeHtml(desc)}">
        <span class="bp-left"><span class="pin-dot" style="background:#c084fc"></span><span class="bp-name">BUS</span><span class="bp-cap">${escapeHtml(t('inspector.i2cExpandedTag'))}</span></span>
        <span class="bp-right"><span class="bp-status-who">${escapeHtml(colRange)} (${modCnt}× via ${hdr})</span></span>
      </div>`;
  })() : '';

  const countRail = (pinIds) => state.active.filter((i) => Object.values(i.pinMap).some((bp) => pinIds.includes(bp))).length;
  const c5v = countRail(['PWR_5V', 'H1_VCC', 'H2_VCC', 'H3_VCC']);
  const c3v3 = countRail(['PWR_3V3']);
  const cGnd = countRail(['PWR_GND1', 'PWR_GND2', 'TOP_GND', 'EXT_GND', 'H1_GND', 'H2_GND', 'H3_GND']);
  const cRst = countRail(['PWR_RESET']);
  const bbRailTag = (pinIds) => {
    const hit = state.breadboardRails.filter((r) => pinIds.includes(r.bpId));
    return hit.length ? ` • Breadboard ${hit.map((r) => r.colNames.join('+')).join(', ')}` : '';
  };
  const fmtMod = (cnt) => cnt === 1 ? t('inspector.modCount', { count: cnt }) : t('inspector.modCountPlural', { count: cnt });
  const sharedLbl = t('inspector.shared');
  const availLbl = t('inspector.available');
  const powerRowsHtml = [
    ['5V', '#ef4444', sharedLbl, c5v ? `${fmtMod(c5v)}${bbRailTag(['PWR_5V','H1_VCC','H2_VCC','H3_VCC'])}` : availLbl, c5v === 0],
    ['3.3V', '#fb923c', sharedLbl, c3v3 ? `${fmtMod(c3v3)}${bbRailTag(['PWR_3V3'])}` : availLbl, c3v3 === 0],
    ['GND', '#64748b', sharedLbl, cGnd ? `${fmtMod(cGnd)}${bbRailTag(['PWR_GND1','PWR_GND2','TOP_GND','EXT_GND','H1_GND','H2_GND','H3_GND'])}` : availLbl, cGnd === 0],
    ['RESET', '#a855f7', 'S1-1 ON', cRst ? `${fmtMod(cRst)}${bbRailTag(['PWR_RESET'])}` : t('inspector.autoReset'), cRst === 0]
  ].filter(([, , , , isFree]) => keepRow(isFree)).map(([name, col, cap, txt]) => `
    <div class="bp-row">
      <span class="bp-left"><span class="pin-dot" style="background:${col}"></span><span class="bp-name">${name}</span><span class="bp-cap">${escapeHtml(cap)}</span></span>
      <span class="bp-right"><span class="bp-status-who">${escapeHtml(txt)}</span></span>
    </div>`).join('');

  const filterTabsHtml = `
    <div class="pin-filter-bar" role="tablist">
      <button type="button" class="pin-flt-btn ${flt === 'all' ? 'active' : ''}" data-pin-filter="all">${escapeHtml(t('inspector.pinFilterAll'))}</button>
      <button type="button" class="pin-flt-btn ${flt === 'used' ? 'active' : ''}" data-pin-filter="used">${escapeHtml(t('inspector.pinFilterUsed'))}</button>
      <button type="button" class="pin-flt-btn ${flt === 'free' ? 'active' : ''}" data-pin-filter="free">${escapeHtml(t('inspector.pinFilterFree'))}</button>
    </div>`;

  return `
    <div class="board-pins-panel">
      <div class="section-mini-head">
        <span>${escapeHtml(t('inspector.boardPinsHead'))}</span>
        <span>${escapeHtml(t('inspector.freeIoCount', { count: digitalFree + analogFree }))}</span>
      </div>
      ${filterTabsHtml}
      ${wrapGroup('digital', t('inspector.groupDigital'), `<span class="pin-group-free ${digitalFree ? '' : 'none-free'}">${escapeHtml(t('inspector.freeCount', { count: digitalFree }))}</span>`, digitalRowsHtml)}
      ${wrapGroup('analog', t('inspector.groupAnalog'), `<span class="pin-group-free ${analogFree ? '' : 'none-free'}">${escapeHtml(t('inspector.freeCount', { count: analogFree }))}</span>`, analogRowsHtml)}
      ${wrapGroup('i2c', t('inspector.groupI2c'), `<span class="pin-group-free ${i2cFreeCount ? '' : 'none-free'}">${escapeHtml(t('inspector.freeCount', { count: i2cFreeCount }))}</span>`, `${i2cRowsHtml}${keepRow(false) ? i2cExpRowHtml : ''}`)}
      ${wrapGroup('power', t('inspector.groupPower'), `<span class="pin-group-free">${escapeHtml(sharedLbl)}</span>`, powerRowsHtml)}
    </div>`;
}

function countFreeIoPins() {
  const board = getActiveBoard();
  const extClaims = getExternalPinClaims();
  const obUsage = getOnboardPinUsage();
  const allPins = board.pins;
  const ioPins = board.id === 'kcomp-v2'
    ? ['D13','D12','D11','D10','D9','D8','D7','D6','D5','D4','D3','D2','D1','D0','A0','A1','A2','A3']
    : Object.entries(allPins).filter(([, m]) => m.signalPin).map(([id]) => id);
  return ioPins.filter((id) => !allPins[id]?.blocked && !extClaims[id] && !obUsage[id]).length;
}

export function renderActiveComponentsInspector(dipStates) {
  const list = $('#activeComponentsList');
  const wiringBadge = $('#wiringTabBadge');
  if (wiringBadge) {
    const cnt = state.active.length;
    wiringBadge.textContent = String(cnt);
    wiringBadge.classList.toggle('hidden', cnt === 0);
  }

  const freeIoCount = countFreeIoPins();
  const subTab = state.wiringSubTab === 'pins' ? 'pins' : 'modules';
  const subNavHtml = `
    <div class="wiring-subnav" role="tablist">
      <button type="button" class="wsub-btn ${subTab === 'modules' ? 'active' : ''}" data-wsub="modules" role="tab" aria-selected="${subTab === 'modules'}">
        <span>${escapeHtml(t('inspector.subModules'))}</span>
        <span class="wsub-pill">${state.active.length}</span>
      </button>
      <button type="button" class="wsub-btn ${subTab === 'pins' ? 'active' : ''}" data-wsub="pins" role="tab" aria-selected="${subTab === 'pins'}">
        <span>${escapeHtml(t('inspector.subPins'))}</span>
        <span class="wsub-pill is-free">${escapeHtml(t('inspector.freeCount', { count: freeIoCount }))}</span>
      </button>
    </div>`;

  let bodyHtml = '';
  if (subTab === 'pins') {
    bodyHtml = buildAllBoardPinsHtml(dipStates);
  } else if (!state.active.length) {
    const enabledOnboard = getActiveOnboardDefs().filter((ob) => {
      if (!state.onboard[ob.id]) return false;
      const dip = ob.dip ? dipStates.find((d) => d.id === ob.dip) : null;
      return !dip || dip.on;
    });
    const curBoardId = getActiveBoard().id;
    const presets = (state.catalog?.presets || []).filter((p) => (p.boardId || DEFAULT_BOARD_ID) === curBoardId);
    const presetBtns = presets.map((p) => {
      const shortLbl = tPreset(p, 'name').split('(')[0].trim();
      return `<button type="button" class="empty-preset-btn" data-empty-preset="${escapeHtml(p.id)}">${escapeHtml(shortLbl)}</button>`;
    }).join('');

    const obBadgeNote = enabledOnboard.length
      ? `<div class="empty-ob-summary">✓ ${escapeHtml(t('empty.onboardActive', { count: enabledOnboard.length, list: enabledOnboard.map((o) => tOnboard(o, 'shortName')).join(', ') }))}</div>`
      : '';

    bodyHtml = `
      <div class="empty-start-wrap">
        <div class="empty-start-head">
          <div class="empty-start-title">${escapeHtml(t('empty.title'))}</div>
          <div class="empty-start-sub">${escapeHtml(t('empty.subtitle'))}</div>
          ${obBadgeNote}
        </div>
        <div class="empty-start-cards">
          <button type="button" class="empty-step-card" id="btnEmptyStepOnboard">
            <span class="empty-step-num">1</span>
            <span class="empty-step-body">
              <strong>${escapeHtml(t('empty.step1Title'))}</strong>
              <span>${escapeHtml(t('empty.step1Desc'))}</span>
            </span>
            <span class="empty-step-arrow" aria-hidden="true">↓</span>
          </button>
          <button type="button" class="empty-step-card" id="btnEmptyStepCatalog">
            <span class="empty-step-num">2</span>
            <span class="empty-step-body">
              <strong>${escapeHtml(t('empty.step2Title'))}</strong>
              <span>${escapeHtml(t('empty.step2Desc'))}</span>
            </span>
            <span class="empty-step-arrow" aria-hidden="true">←</span>
          </button>
          <div class="empty-step-card is-presets">
            <span class="empty-step-num">3</span>
            <div class="empty-step-body">
              <strong>${escapeHtml(t('empty.step3Title'))}</strong>
              <div class="empty-preset-row">${presetBtns}</div>
            </div>
          </div>
        </div>
      </div>`;
  } else {
    const uartAssigns = computeUartAssignments();
    const cardsHtml = state.active.map((inst) => {
      const def = getCompDef(inst.compId);
      const uartInfo = uartAssigns[inst.instanceId] || null;
      const uartBadgeHtml = uartInfo
        ? `<span class="badge ${uartInfo.kind === 'hw' ? 'badge-uart-hw' : 'badge-uart-sw'}" title="${escapeHtml(uartInfo.kind === 'hw' ? t('uart.hwBadgeTitle', { ch: uartInfo.channel, baud: uartInfo.baud }) : t('uart.swBadgeTitle', { baud: uartInfo.baud }))}">${escapeHtml(uartInfo.badgeLabel)}</span>`
        : '';
      const roleTitle = getDisplayLabel(def);
      const addr = getInstanceAddress(inst);
      const isFocused = state.focusedId === inst.instanceId;

      const warnText = tComp(def, 'shortWarn') || '';
      const warnHtml = warnText
        ? `<div class="comp-warn-note ${/ONLY|NEVER|Skip|DANGER|CRITICAL|MANDATORY|NUR|NIEMALS|überspringen|GEFAHR|KRITISCH|STRENG|VETËM|KURRË|Anashkalo|RREZIK|KRITIKE|DETYRUESHME|STRIKT/i.test(warnText) ? 'danger' : ''}">${escapeHtml(warnText)}</div>`
        : '';

      const unassigned = def.pins.filter((p) => p.selectable && !inst.pinMap[p.id]);
      const actionHtml = unassigned.length
        ? `<div class="comp-action-note">${escapeHtml(t('inspector.actionRequired', {
            caps: unassigned.map((p) => (p.allowedTypes || ['IO']).join('/')).join(', '),
            pins: unassigned.map((p) => p.id).join(', ')
          }))}</div>`
        : '';

      const cardBodyHtml = (actionHtml || warnHtml)
        ? `<div class="comp-card-body">${actionHtml}${warnHtml}</div>`
        : '';

      return `
        <div class="comp-card ${isFocused ? 'focused' : ''} ${unassigned.length ? 'needs-action' : ''}" data-card-hover="${inst.instanceId}">
          <div class="comp-card-head" data-focus="${inst.instanceId}">
            <div class="comp-card-title-wrap">
              <div class="comp-card-title">
                <span>${escapeHtml(roleTitle)}</span>
                ${addr ? `<span class="badge badge-i2c">${addr}</span>` : ''}
                ${inst.i2cHeader ? `<span class="badge">${inst.i2cHeader}</span>` : ''}
                ${uartBadgeHtml}
                ${def.protoArea ? `<span class="badge badge-proto" title="${escapeHtml(tComp(def, 'protoNote') || t('catalog.protoFallback'))}">PROTO</span>` : ''}
              </div>
              <div class="comp-card-sub">${escapeHtml(def.name)} • ${escapeHtml(def.voltage)} • ~${def.currentMa || 0} mA</div>
            </div>
            <div class="comp-card-actions">
              <button class="card-info-btn" type="button" data-card-info="${def.id}" title="${escapeHtml(t('catalog.infoTitle', { role: roleTitle }))}">i</button>
              <button class="btn btn-sm btn-danger-ghost" type="button" data-remove="${inst.instanceId}" title="${escapeHtml(t('inspector.remove'))}">✕</button>
            </div>
          </div>
          ${cardBodyHtml}
        </div>`;
    }).join('');

    bodyHtml = `
      <div class="active-modules-wrap">
        <div class="section-mini-head">
          <span>${escapeHtml(t('inspector.activeHead', { count: state.active.length }))}</span>
          <span>${escapeHtml(t('inspector.dragHint'))}</span>
        </div>
        ${cardsHtml}
      </div>`;
  }

  list.innerHTML = `${subNavHtml}${bodyHtml}`;

  list.querySelectorAll<any>('[data-wsub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.wiringSubTab = btn.dataset.wsub;
      hooks.recomputeAndRender();
    });
  });

  $('#btnEmptyStepOnboard')?.addEventListener('click', () => {
    if (isMobileViewport()) setMobileView('board');
    const bar = $('.onboard-bar');
    if (bar) {
      bar.classList.remove('is-pulse-guide');
      void bar.offsetWidth;
      bar.classList.add('is-pulse-guide');
      setTimeout(() => bar.classList.remove('is-pulse-guide'), 1600);
    }
    hooks.flashTarget({ onboardId: 'onboard_oled' });
  });

  $('#btnEmptyStepCatalog')?.addEventListener('click', () => {
    if (isMobileViewport()) {
      setMobileView('parts');
    } else if (state.sidebarCollapsed) {
      state.sidebarCollapsed = false;
      applyPanelCollapseState();
      saveLayoutPrefs();
      hooks.applyViewBox();
    }
    setTimeout(() => { $('#searchInput')?.focus(); }, 40);
  });

  list.querySelectorAll<any>('[data-empty-preset]').forEach((btn) => {
    btn.addEventListener('click', () => hooks.loadPreset(btn.dataset.emptyPreset));
  });

  list.querySelectorAll<any>('[data-card-hover]').forEach((card) => {
    const id = card.dataset.cardHover;
    card.addEventListener('mouseenter', () => hooks.setHwHover(id));
    card.addEventListener('mouseleave', () => hooks.setHwHover(null));
  });

  list.querySelectorAll<any>('[data-focus]').forEach((el) => {
    el.addEventListener('click', (e: any) => {
      if (e.target.closest('[data-remove]') || e.target.closest('[data-card-info]')) return;
      const id = el.dataset.focus;
      const next = state.focusedId === id ? null : id;
      state.focusedId = next;
      hooks.recomputeAndRender();
      if (next) hooks.panToComponent(next);
    });
  });
  list.querySelectorAll<any>('[data-focus-pin]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.focusPin;
      const next = state.focusedId === id ? null : id;
      state.focusedId = next;
      hooks.recomputeAndRender();
      if (next) hooks.flashTarget({ instanceId: next, panIfOffscreen: true });
    });
  });
  list.querySelectorAll<any>('[data-free-ob]').forEach((btn) => {
    btn.addEventListener('click', (e: any) => {
      e.stopPropagation();
      toggleOnboardComponent(btn.dataset.freeOb);
    });
  });
  list.querySelectorAll<any>('[data-pin-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.pinFilter = btn.dataset.pinFilter;
      hooks.recomputeAndRender();
    });
  });
  list.querySelectorAll<any>('[data-pin-group]').forEach((head) => {
    head.addEventListener('click', () => {
      const grp = head.dataset.pinGroup;
      if (state.collapsedPinGroups.has(grp)) state.collapsedPinGroups.delete(grp);
      else state.collapsedPinGroups.add(grp);
      hooks.recomputeAndRender();
    });
  });
  list.querySelectorAll<any>('[data-card-info]').forEach((btn) => {
    btn.addEventListener('click', (e: any) => {
      e.stopPropagation();
      hooks.openComponentInfo(btn.dataset.cardInfo);
    });
  });
  list.querySelectorAll<any>('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => removeComponent(btn.dataset.remove));
  });
}

export function showPinTooltip(pinId, ev) {
  const meta = getActiveBoard().pins[pinId];
  if (!meta) return;
  const ext = getExternalPinClaims()[pinId];
  const ob = getOnboardPinUsage()[pinId];
  let status = t('tip.pinFree');
  if (meta.blocked) {
    status = t('tip.pinReserved', { reason: escapeHtml(tBlockedPin(pinId, true)) });
  } else if (ext) {
    status = t('tip.pinWired', { comp: escapeHtml(ext.compName), pin: escapeHtml(ext.compPinId) });
  } else if (ob) {
    const hint = ob.dip ? t('tip.hintDip', { dip: ob.dip }) : t('tip.hintChip');
    status = t('tip.pinOnboard', { name: escapeHtml(ob.name), hint });
  }
  showCustomTooltip(`<strong>${escapeHtml(meta.label)}</strong><br>${status}`, ev);
}

export function showCustomTooltip(html, ev) {
  const tip = $('#boardTooltip');
  tip.innerHTML = html;
  tip.classList.remove('hidden');
  moveTooltip(ev);
}

export function moveTooltip(ev) {
  const wrap = $('#canvasWrapper').getBoundingClientRect();
  const tip = $('#boardTooltip');
  tip.style.left = `${Math.min(wrap.width - 235, Math.max(8, ev.clientX - wrap.left + 14))}px`;
  tip.style.top = `${Math.min(wrap.height - 85, Math.max(8, ev.clientY - wrap.top + 14))}px`;
}

export function hideTooltip() {
  const tip = $('#boardTooltip');
  if (tip) tip.classList.add('hidden');
}
