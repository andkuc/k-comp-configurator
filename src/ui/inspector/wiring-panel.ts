// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Right Wiring Inspector Panel (Active Module Cards, Empty-Start Onboarding & Grouped Board-Pins Matrix)
import {
  state,
  $,
  escapeHtml,
  getActiveOnboardDefs
} from '../../core/state';
import {
  activateOptionalPin,
  deactivateOptionalPin,
  getCompDef,
  getDisplayLabel,
  getInstanceAddress,
  getInstancePowerRail,
  getExternalPinClaims,
  getOnboardPinUsage,
  isRequiredPin,
  moduleSupportsDualPower,
  removeComponent,
  setInstanceI2CAddress,
  setInstancePowerRail,
  toggleOnboardComponent,
  computeUartAssignments
} from '../../core/hardware';
import { t, tComp, tOnboard, tBlockedPin } from '../../i18n/index';
import { getActiveBoard } from '../../boards';
import { appBus } from '../../store/bus';
import { uiSessionStore } from '../../store/ui-session';
import type { DipSwitchState } from '../../types';

export function buildAllBoardPinsHtml(_dipStates: DipSwitchState[]): string {
  const extClaims = getExternalPinClaims();
  const obUsage = getOnboardPinUsage();
  const allPins = getActiveBoard().pins;
  const flt = state.pinFilter || 'all';
  const keepRow = (isFree: boolean): boolean => flt === 'all' || (flt === 'free' ? isFree : !isFree);
  const wrapGroup = (grpId: string, title: string, badgeHtml: string, rowsHtml: string): string => {
    const isCollapsed = Boolean(state.collapsedPinGroups && state.collapsedPinGroups.has(grpId));
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

  const renderSignalRow = (bpId: string, displayName: string, capHint: string): string => {
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
      const dotCol = pSpec?.color || '#38bdf8';
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
  if (board.capabilities.hasPinMux) {
    const entries = Object.entries(allPins);
    const analogPins: Array<[string, string, string]> = entries
      .filter(([, m]) => m.group === 'analog')
      .map(([id, m]) => [id, id, m.capHint || 'ADC']);
    const digitalPins: Array<[string, string, string]> = entries
      .filter(([, m]) => m.group === 'digital')
      .map(([id, m]) => [id, id, m.capHint || (m.strapping ? 'STRAP' : '')]);
    const i2cPins: Array<[string, string, string]> = entries
      .filter(([, m]) => m.group === 'i2c')
      .map(([id, m]) => [id, id, m.capHint || 'I2C']);
    const analogFreeN = analogPins.filter(([id]) => !allPins[id]?.blocked && !extClaims[id] && !obUsage[id]).length;
    const digitalFreeN = digitalPins.filter(([id]) => !allPins[id]?.blocked && !extClaims[id] && !obUsage[id]).length;
    const i2cExtNamesN = state.active
      .filter((i) => getCompDef(i.compId)?.interface === 'I2C')
      .map((i) => getDisplayLabel(getCompDef(i.compId)));
    const i2cSummaryN = i2cExtNamesN.length
      ? t('inspector.i2cBusUsed', { count: i2cExtNamesN.length, list: i2cExtNamesN.slice(0, 2).join(', ') })
      : t('inspector.i2cBusFree');
    const i2cRowsN = i2cPins.map(([id, lbl, cap]) => keepRow(!i2cExtNamesN.length) ? `
      <div class="bp-row ${!i2cExtNamesN.length ? 'is-free' : ''}">
        <span class="bp-left"><span class="pin-dot" style="background:${id === 'GPIO8' ? '#10b981' : '#eab308'}"></span><span class="bp-name">${lbl}</span><span class="bp-cap">${cap}</span></span>
        <span class="bp-right"><span class="bp-status-who">${escapeHtml(i2cSummaryN)}</span></span>
      </div>` : '').join('');
    const countCap = (capName: string): number =>
      state.active.filter((i) => Object.values(i.pinMap).some((bp) => Boolean(bp && allPins[bp]?.caps?.includes(capName)))).length;
    const sharedLblN = t('inspector.shared');
    const availLblN = t('inspector.available');
    const fmtModN = (cnt: number): string => cnt === 1 ? t('inspector.modCount', { count: cnt }) : t('inspector.modCountPlural', { count: cnt });
    const c3v3N = countCap('3V3');
    const c5vN = countCap('5V');
    const cGndN = countCap('GND');
    const cRstN = countCap('RESET');
    const powerRowsSpecN: Array<[string, string, string, string, boolean]> = [
      ['3.3V', '#fb923c', sharedLblN, c3v3N ? fmtModN(c3v3N) : availLblN, c3v3N === 0],
      ['5V (VBUS)', '#ef4444', sharedLblN, c5vN ? fmtModN(c5vN) : availLblN, c5vN === 0],
      ['GND', '#64748b', sharedLblN, cGndN ? fmtModN(cGndN) : availLblN, cGndN === 0],
      ['RST / EN', '#a855f7', sharedLblN, cRstN ? fmtModN(cRstN) : availLblN, cRstN === 0]
    ];
    const powerRowsN = powerRowsSpecN
      .filter(([, , , , isFree]) => keepRow(isFree))
      .map(([name, col, cap, txt]) => `
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

  const digitalList: Array<[string, string, string]> = [
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

  const analogSig: Array<[string, string, string]> = [
    ['A0', 'A0', 'ADC'],
    ['A1', 'A1', 'ADC'],
    ['A2', 'A2', 'ADC'],
    ['A3', 'A3', 'ADC']
  ];
  const analogFree = analogSig.filter(([id]) => !allPins[id]?.blocked && !extClaims[id] && !obUsage[id]).length;
  const i2cExtNames = state.active
    .filter((i) => getCompDef(i.compId)?.interface === 'I2C')
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

  const i2cHeadersList: Array<[string, string]> = [
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

  const i2cExpRails = (state.breadboardRails || []).filter((r: any) => Boolean(r.isI2cExpansion));
  const i2cExpRowHtml = i2cExpRails.length ? (() => {
    const cols: string[] = [...new Set<string>(i2cExpRails.flatMap((r: any) => (r.colNames || []) as string[]))];
    const colRange = cols.length > 1 ? `${cols[0]}–${cols[cols.length - 1]}` : (cols[0] || '');
    const hdr = i2cExpRails[0].i2cHeader || 'H3';
    const modCnt = i2cExpRails[0].branches.length;
    const desc = t('inspector.i2cExpandedRow', { cols: colRange, count: modCnt, header: hdr });
    return `
      <div class="bp-row is-i2c-expanded" title="${escapeHtml(desc)}">
        <span class="bp-left"><span class="pin-dot" style="background:#c084fc"></span><span class="bp-name">BUS</span><span class="bp-cap">${escapeHtml(t('inspector.i2cExpandedTag'))}</span></span>
        <span class="bp-right"><span class="bp-status-who">${escapeHtml(colRange)} (${modCnt}× via ${hdr})</span></span>
      </div>`;
  })() : '';

  const countRail = (pinIds: string[]): number =>
    state.active.filter((i) => Object.values(i.pinMap).some((bp) => Boolean(bp && pinIds.includes(bp)))).length;
  const c5v = countRail(['PWR_5V', 'H1_VCC', 'H2_VCC', 'H3_VCC']);
  const c3v3 = countRail(['PWR_3V3']);
  const cGnd = countRail(['PWR_GND1', 'PWR_GND2', 'TOP_GND', 'EXT_GND', 'H1_GND', 'H2_GND', 'H3_GND']);
  const cRst = countRail(['PWR_RESET']);
  const bbRailTag = (pinIds: string[]): string => {
    const hit = state.breadboardRails.filter((r: any) => pinIds.includes(r.bpId));
    return hit.length ? ` • Breadboard ${hit.map((r: any) => r.colNames.join('+')).join(', ')}` : '';
  };
  const fmtMod = (cnt: number): string => cnt === 1 ? t('inspector.modCount', { count: cnt }) : t('inspector.modCountPlural', { count: cnt });
  const sharedLbl = t('inspector.shared');
  const availLbl = t('inspector.available');
  const powerRowsSpec: Array<[string, string, string, string, boolean]> = [
    ['5V', '#ef4444', sharedLbl, c5v ? `${fmtMod(c5v)}${bbRailTag(['PWR_5V', 'H1_VCC', 'H2_VCC', 'H3_VCC'])}` : availLbl, c5v === 0],
    ['3.3V', '#fb923c', sharedLbl, c3v3 ? `${fmtMod(c3v3)}${bbRailTag(['PWR_3V3'])}` : availLbl, c3v3 === 0],
    ['GND', '#64748b', sharedLbl, cGnd ? `${fmtMod(cGnd)}${bbRailTag(['PWR_GND1', 'PWR_GND2', 'TOP_GND', 'EXT_GND', 'H1_GND', 'H2_GND', 'H3_GND'])}` : availLbl, cGnd === 0],
    ['RESET', '#a855f7', 'S1-1 ON', cRst ? `${fmtMod(cRst)}${bbRailTag(['PWR_RESET'])}` : t('inspector.autoReset'), cRst === 0]
  ];
  const powerRowsHtml = powerRowsSpec
    .filter(([, , , , isFree]) => keepRow(isFree))
    .map(([name, col, cap, txt]) => `
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

function countFreeIoPins(): number {
  const board = getActiveBoard();
  const extClaims = getExternalPinClaims();
  const obUsage = getOnboardPinUsage();
  const allPins = board.pins;
  const ioPins = Object.entries(allPins).filter(([, m]) => m.signalPin).map(([id]) => id);
  return ioPins.filter((id) => !allPins[id]?.blocked && !extClaims[id] && !obUsage[id]).length;
}

export function renderActiveComponentsInspector(dipStates: DipSwitchState[]): void {
  const list = $('#activeComponentsList') as HTMLElement | null;
  if (!list) return;
  const wiringBadge = $('#wiringTabBadge') as HTMLElement | null;
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
    const obBadgeNote = enabledOnboard.length
      ? `<div class="empty-ob-summary">✓ ${escapeHtml(t('empty.onboardActive', { count: enabledOnboard.length, list: enabledOnboard.map((o) => tOnboard(o, 'shortName')).join(', ') }))}</div>`
      : '';

    bodyHtml = `
      <div class="empty-state empty-state-compact">
        <div class="empty-state-msg">${escapeHtml(t('empty.noModules'))}</div>
        ${obBadgeNote}
      </div>`;
  } else {
    const uartAssigns = computeUartAssignments();
    const cardsHtml = state.active.map((inst) => {
      const def = getCompDef(inst.compId);
      if (!def) return '';
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

      const unassigned = def.pins.filter((p) => p.selectable && isRequiredPin(p) && !inst.pinMap[p.id]);
      const actionHtml = unassigned.length
        ? `<div class="comp-action-note">${escapeHtml(t('inspector.actionRequired', {
            caps: unassigned.map((p) => (p.allowedTypes || ['IO']).join('/')).join(', '),
            pins: unassigned.map((p) => p.id).join(', ')
          }))}</div>`
        : '';

      // Compact inline controls for Dual Power Rail (3.3V/5V), Configurable I2C Address & Optional Pins
      const ctrlChunks: string[] = [];
      if (moduleSupportsDualPower(def)) {
        const curRail = getInstancePowerRail(inst);
        ctrlChunks.push(`
          <div class="comp-rail-toggle" role="group" aria-label="${escapeHtml(t('inspector.powerRailLabel'))}">
            <button type="button" class="rail-opt-btn is-3v3 ${curRail === '3V3' ? 'active' : ''}" data-set-rail-inst="${inst.instanceId}" data-set-rail="3V3" title="${escapeHtml(t('inspector.rail3v3Title'))}">3.3V</button>
            <button type="button" class="rail-opt-btn is-5v ${curRail === '5V' ? 'active' : ''}" data-set-rail-inst="${inst.instanceId}" data-set-rail="5V" title="${escapeHtml(t('inspector.rail5vTitle'))}">5V</button>
          </div>`);
      }
      if (def.i2cAddrOptions && def.i2cAddrOptions.length > 1) {
        const curAddr = (addr || def.i2cAddr || '').toLowerCase();
        const addrBtns = def.i2cAddrOptions.map((o) => {
          const isSel = o.addr.toLowerCase() === curAddr;
          return `<button type="button" class="addr-opt-btn ${isSel ? 'active' : ''}" data-set-addr-inst="${inst.instanceId}" data-set-addr="${escapeHtml(o.addr)}" title="${escapeHtml(o.note || o.addr)}">${escapeHtml(o.addr)}</button>`;
        }).join('');
        ctrlChunks.push(`<div class="comp-addr-toggle" role="group" aria-label="${escapeHtml(t('inspector.i2cAddrLabel'))}">${addrBtns}</div>`);
      }
      const optPins = def.pins.filter((p) => p.tier === 'optional');
      if (optPins.length) {
        const optBtns = optPins.map((op) => {
          const wiredPin = inst.pinMap[op.id];
          const isOn = Boolean(wiredPin);
          const lbl = isOn ? `${op.id} → ${wiredPin}` : `+ ${op.id}`;
          const tip = isOn
            ? t('inspector.optPinOffTitle', { pin: op.id, dest: wiredPin })
            : t('inspector.optPinOnTitle', { pin: op.id, note: op.note || '' });
          return `<button type="button" class="opt-pin-chip ${isOn ? 'is-on' : ''}" data-opt-toggle-inst="${inst.instanceId}" data-opt-toggle-pin="${escapeHtml(op.id)}" title="${escapeHtml(tip)}">${escapeHtml(lbl)}${isOn ? ' <span class="opt-chip-x" aria-hidden="true">×</span>' : ''}</button>`;
        }).join('');
        ctrlChunks.push(`<div class="comp-opt-pins">${optBtns}</div>`);
      }

      const controlsHtml = ctrlChunks.length
        ? `<div class="comp-card-controls">${ctrlChunks.join('')}</div>`
        : '';

      const cardBodyHtml = (controlsHtml || actionHtml || warnHtml)
        ? `<div class="comp-card-body">${controlsHtml}${actionHtml}${warnHtml}</div>`
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
              <div class="comp-card-sub">${escapeHtml(def.name)} • ${escapeHtml(def.voltage || '')} • ~${def.currentMa || 0} mA</div>
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

  list.querySelectorAll<HTMLElement>('[data-wsub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.wsub === 'pins' ? 'pins' : 'modules';
      state.wiringSubTab = next;
      uiSessionStore.patch({ wiringSubTab: next });
      appBus.emit('workspace:recompute');
    });
  });

  list.querySelectorAll<HTMLElement>('[data-card-hover]').forEach((card) => {
    const id = card.dataset.cardHover;
    if (!id) return;
    card.addEventListener('mouseenter', () => appBus.emit('hover:hw', { hwId: id }));
    card.addEventListener('mouseleave', () => appBus.emit('hover:hw', { hwId: null }));
  });

  list.querySelectorAll<HTMLElement>('[data-focus]').forEach((el) => {
    el.addEventListener('click', (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('[data-remove]') || target?.closest('[data-card-info]')) return;
      const id = el.dataset.focus || null;
      const next = state.focusedId === id ? null : id;
      state.focusedId = next;
      uiSessionStore.patch({ focusedId: next });
      appBus.emit('workspace:recompute');
      if (next) appBus.emit('viewport:panToComponent', { instanceId: next });
    });
  });

  list.querySelectorAll<HTMLElement>('[data-focus-pin]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.focusPin || null;
      const next = state.focusedId === id ? null : id;
      state.focusedId = next;
      uiSessionStore.patch({ focusedId: next });
      appBus.emit('workspace:recompute');
      if (next) appBus.emit('target:flash', { instanceId: next, panIfOffscreen: true });
    });
  });

  list.querySelectorAll<HTMLElement>('[data-free-ob]').forEach((btn) => {
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const obId = btn.dataset.freeOb;
      if (obId) toggleOnboardComponent(obId);
    });
  });

  list.querySelectorAll<HTMLElement>('[data-pin-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.pinFilter === 'used' ? 'used' : (btn.dataset.pinFilter === 'free' ? 'free' : 'all');
      state.pinFilter = next;
      uiSessionStore.patch({ pinFilter: next });
      appBus.emit('workspace:recompute');
    });
  });

  list.querySelectorAll<HTMLElement>('[data-pin-group]').forEach((head) => {
    head.addEventListener('click', () => {
      const grp = head.dataset.pinGroup;
      if (!grp) return;
      if (state.collapsedPinGroups.has(grp)) state.collapsedPinGroups.delete(grp);
      else state.collapsedPinGroups.add(grp);
      appBus.emit('workspace:recompute');
    });
  });

  list.querySelectorAll<HTMLElement>('[data-card-info]').forEach((btn) => {
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const cid = btn.dataset.cardInfo;
      if (cid) appBus.emit('modal:openComponentInfo', { compId: cid });
    });
  });

  list.querySelectorAll<HTMLElement>('[data-set-rail]').forEach((btn) => {
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const instId = btn.dataset.setRailInst;
      const rail = btn.dataset.setRail === '3V3' ? '3V3' : '5V';
      if (instId) setInstancePowerRail(instId, rail);
    });
  });

  list.querySelectorAll<HTMLElement>('[data-set-addr]').forEach((btn) => {
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const instId = btn.dataset.setAddrInst;
      const addrVal = btn.dataset.setAddr;
      if (instId && addrVal) setInstanceI2CAddress(instId, addrVal);
    });
  });

  list.querySelectorAll<HTMLElement>('[data-opt-toggle-pin]').forEach((btn) => {
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const instId = btn.dataset.optToggleInst;
      const pinId = btn.dataset.optTogglePin;
      if (!instId || !pinId) return;
      const inst = state.active.find((i) => i.instanceId === instId);
      if (inst?.pinMap[pinId]) deactivateOptionalPin(instId, pinId);
      else activateOptionalPin(instId, pinId);
    });
  });

  list.querySelectorAll<HTMLElement>('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const instId = btn.dataset.remove;
      if (instId) removeComponent(instId);
    });
  });
}
