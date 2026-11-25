// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Multi-Board Printable Hardware Lab Sheet (BOM, Jumper Counts, Board Config & STOPP-Punkt Sign-Off)
import { APP_VERSION, COPYRIGHT_AUTHOR, COPYRIGHT_YEARS, CONFIGURATOR_REPO_URL } from '../../core/constants';
import { state, $, escapeHtml, getCleanProjectName, formatRamAmount, getActiveOnboardDefs } from '../../core/state';
import {
  getCompDef, getDisplayLabel, computeDipStates, computeCriticalWarnings,
  computeSram, computeUsbCurrent, computeUartAssignments, moduleRequires5vLogicWarning
} from '../../core/hardware';
import { computeLayoutBounds, updateBoardSvgState, renderDockedComponentsAndWires } from '../workbench';
import { t, tComp, tDipName, tOnboard, getLocale } from '../../i18n/index';
import { getActiveBoard, isBoardCarrierActive } from '../../boards';
import { appBus } from '../../store/bus';

function classifyWireColor(hex) {
  const c = String(hex || '').toLowerCase();
  if (c === '#ef4444' || c === '#dc2626' || c === '#f43f5e') return { key: 'red', dot: '#ef4444', i18n: 'print.wireColorRed' };
  if (c === '#f97316' || c === '#fb923c' || c === '#ea580c') return { key: 'orange', dot: '#f97316', i18n: 'print.wireColorOrange' };
  if (c === '#334155' || c === '#475569' || c === '#64748b' || c === '#1e293b' || c === '#78350f' || c === '#0f172a') return { key: 'dark', dot: '#334155', i18n: 'print.wireColorDark' };
  if (c === '#eab308' || c === '#facc15' || c === '#fbbf24' || c === '#ca8a04') return { key: 'yellow', dot: '#eab308', i18n: 'print.wireColorYellow' };
  if (c === '#10b981' || c === '#22c55e' || c === '#16a34a' || c === '#34d399') return { key: 'green', dot: '#10b981', i18n: 'print.wireColorGreen' };
  return { key: 'blue', dot: '#0ea5e9', i18n: 'print.wireColorBlue' };
}

// Compute complete board-aware Bill of Materials (BOM) & physical Jumper Wire counts (M-F, M-M, F-F, Grove, colors)

function buildBomData() {
  const board = getActiveBoard();
  const isBaseDipBoard = board.capabilities.hasDipSwitches;
  const carrierActive = isBoardCarrierActive(board, state.carrierEnabled);
  const isStandaloneMaleHeader = !isBaseDipBoard && !carrierActive;

  const baseBoardItem = isBaseDipBoard
    ? {
        qty: 1,
        name: t('print.bomBaseBoard'),
        spec: t('print.bomBaseSpec'),
        source: t('print.bomBaseNote')
      }
    : {
        qty: 1,
        name: board.name,
        spec: t('print.bomEspBaseSpec', {
          voltage: board.electrical.logicVoltage,
          flashMb: Math.round((board.electrical.flashBytes || 0) / 1048576),
          psramMb: Math.round((board.electrical.psramBytes || 0) / 1048576)
        }),
        source: t('print.bomEspBaseNote')
      };

  const items: Array<{ qty: number; name: string; spec: string; source: string; isWire?: boolean }> = [baseBoardItem];

  // Group active external modules by compId
  const byComp = new Map();
  for (const inst of state.active) {
    byComp.set(inst.compId, (byComp.get(inst.compId) || 0) + 1);
  }

  let needsLevelShifter = false;
  for (const [compId, qty] of byComp.entries()) {
    const def = getCompDef(compId);
    if (!def) continue;
    if (moduleRequires5vLogicWarning(def)) needsLevelShifter = true;
    let src = t('print.bomAssortment');
    if (def.onboardWirelessSlot) src = t('print.bomOnboardSlot');
    else if (def.protoArea) src = isBaseDipBoard ? t('print.bomProtoArea') : t('print.bomBreadboardMount');
    items.push({
      qty,
      name: getDisplayLabel(def),
      spec: `${def.name} (${def.voltage})`,
      source: src
    });
  }

  // Automatic accessory detection
  if (needsLevelShifter) {
    items.push({
      qty: 1,
      name: t('print.bomLevelShifter'),
      spec: t('print.bomLevelShifterSpec'),
      source: t('print.bomLevelShifterNote')
    });
  }
  if (byComp.has('tb6612fng')) {
    items.push({ qty: 1, name: t('print.bomBattery'), spec: t('print.bomBatterySpec'), source: t('print.bomBatteryNote') });
  }
  if (byComp.has('ad8232')) {
    items.push({ qty: 1, name: t('print.bomElectrodes'), spec: t('print.bomElectrodesSpec'), source: t('print.bomElectrodesNote') });
  }
  const rfCnt = (byComp.get('rf433-tx') || 0) + (byComp.get('rf433-rx') || 0);
  if (rfCnt > 0) {
    items.push({ qty: rfCnt, name: t('print.bomAntenna'), spec: t('print.bomAntennaSpec'), source: t('print.bomAntennaNote') });
  }
  if (byComp.has('pn532')) {
    items.push({ qty: 1, name: t('print.bomNfcTags'), spec: t('print.bomNfcTagsSpec'), source: t('print.bomNfcTagsNote') });
  }
  if (byComp.has('ir-rx')) {
    items.push({ qty: 1, name: t('print.bomIrRemote'), spec: t('print.bomIrRemoteSpec'), source: t('print.bomIrRemoteNote') });
  }

  // Exact Jumper Wire Calculation (board- & carrier-aware: M-F, M-M, F-F, Grove)
  let mfCount = 0;
  let mmCount = 0;
  let ffCount = 0;
  let groveCount = 0;
  const colorCounts = new Map();
  const addColor = (hex) => {
    const bucket = classifyWireColor(hex);
    if (!colorCounts.has(bucket.key)) colorCounts.set(bucket.key, { ...bucket, count: 0 });
    colorCounts.get(bucket.key).count++;
  };

  // 0. Centered Breadboard Carrier (e.g. ESP32-S3 mounted on Breadboard)
  if (carrierActive) {
    items.push({
      qty: 1,
      name: t('print.bomCarrierBreadboard'),
      spec: t('print.bomCarrierBreadboardSpec'),
      source: t('print.bomCarrierBreadboardNote')
    });
    for (const cf of (state.carrierFeeders || [])) {
      mmCount++;
      addColor(cf.color);
    }
  }

  // 1. K-Comp V2 onboard breadboard feeders & column bridges are always Male-Male jumpers
  for (const rail of (state.breadboardRails || [])) {
    mmCount++;
    addColor(rail.color);
    for (const _br of (rail.bridges || [])) {
      mmCount++;
      addColor(rail.color);
    }
  }

  // 2. Module wires
  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def || def.onboardWirelessSlot || (!def.pins.length && def.requiresDriver)) continue;

    if (def.id === 'cardkb') {
      groveCount++;
      continue;
    }

    const moduleHasFemaleSocket = !!def.protoArea || def.id === 'sg90-180' || def.id === 'sg90-360';
    for (const p of def.pins) {
      if (isStandaloneMaleHeader) {
        // Standalone ESP32-S3 male pin headers: female-socket modules need M-F, male-pin breakouts need F-F
        if (moduleHasFemaleSocket) mfCount++;
        else ffCount++;
      } else {
        // Female headers (K-Comp V2) or Breadboard tie-points: female-socket modules need M-M, male breakouts need M-F
        if (moduleHasFemaleSocket) mmCount++;
        else mfCount++;
      }
      addColor(p.color);
    }
  }

  if (mfCount > 0) {
    items.push({
      qty: mfCount,
      name: t('print.bomJumperMf'),
      spec: t('print.bomJumperMfSpec'),
      source: t('print.bomJumperMfNote'),
      isWire: true
    });
  }
  if (mmCount > 0) {
    items.push({
      qty: mmCount,
      name: t('print.bomJumperMm'),
      spec: t('print.bomJumperMmSpec'),
      source: t('print.bomJumperMmNote'),
      isWire: true
    });
  }
  if (ffCount > 0) {
    items.push({
      qty: ffCount,
      name: t('print.bomJumperFf'),
      spec: t('print.bomJumperFfSpec'),
      source: t('print.bomJumperFfNote'),
      isWire: true
    });
  }
  if (groveCount > 0) {
    items.push({
      qty: groveCount,
      name: t('print.bomGrove'),
      spec: t('print.bomGroveSpec'),
      source: t('print.bomGroveNote'),
      isWire: true
    });
  }

  const totalJumpers = mfCount + mmCount + ffCount;
  return {
    items,
    mfCount,
    mmCount,
    ffCount,
    groveCount,
    totalJumpers,
    colors: Array.from(colorCounts.values()).sort((a, b) => b.count - a.count)
  };
}

export function openPrintStopSheet() {
  state.printModalTab = 'labsheet';
  const heading = $('#printModalHeading');
  const subtitle = $('#printModalSubtitle');
  if (heading) heading.textContent = t('print.heading');
  if (subtitle) subtitle.textContent = t('print.subtitle');
  $('#btnPrintTabLab')?.classList.add('active');
  $('#btnPrintTabCharter')?.classList.remove('active');
  $('#btnPrintShareLink')?.classList.add('hidden');
  const svg = $('#masterSvg');
  const prevFocused = state.focusedId;
  const prevVb = { ...state.vb };
  const board = getActiveBoard();
  const hasModeToggle = board.onboardPeripherals.some((o) => o.modeToggle);
  const carrierActive = isBoardCarrierActive(board, state.carrierEnabled);
  const maxMa = board.electrical.usbMaxMa;

  state.focusedId = null;
  const dipStates = computeDipStates();
  const warnings = computeCriticalWarnings();
  const sramUsed = computeSram();
  const sramPct = Math.round((sramUsed / board.electrical.sramBytes) * 100);
  const ramFmt = formatRamAmount(sramUsed, board.electrical.sramBytes);
  const cur = computeUsbCurrent();
  const uartAssigns = computeUartAssignments();

  if (svg) {
    updateBoardSvgState(dipStates);
    renderDockedComponentsAndWires();
  }

  // Compute BOM AFTER renderDockedComponentsAndWires() so rails & carrierFeeders are 100% up-to-date
  const bom = buildBomData();

  let svgMarkup = '';
  if (svg) {
    const bounds = computeLayoutBounds();
    svg.setAttribute('viewBox', `${bounds.x.toFixed(1)} ${bounds.y.toFixed(1)} ${bounds.w.toFixed(1)} ${bounds.h.toFixed(1)}`);
    const clone = svg.cloneNode(true);
    clone.removeAttribute('id');
    clone.setAttribute('viewBox', `${bounds.x.toFixed(1)} ${bounds.y.toFixed(1)} ${bounds.w.toFixed(1)} ${bounds.h.toFixed(1)}`);
    clone.querySelectorAll('.kcomp-pin-hit, #kcomp-onboard-hit-layer, #dragOverlayLayer, #pinFlagsLayer, .hw-flash-group, .drag-hover-ring, .comp-rotate-handle, .comp-quick-rotate, .comp-quick-btn, .pin-needs-free, .wire-hit-path').forEach((n) => n.remove());
    svgMarkup = new XMLSerializer().serializeToString(clone);
  }

  state.focusedId = prevFocused;
  state.vb = prevVb;
  appBus.emit('viewport:applyViewBox');
  if (svg) {
    updateBoardSvgState(dipStates);
    renderDockedComponentsAndWires();
  }

  // BOM Table Rows
  const bomRowsHtml = bom.items.map((it) => `
    <tr class="${it.isWire ? 'print-row-wire' : ''}">
      <td><span class="print-chk"></span></td>
      <td style="text-align:center;font-family:var(--mono);font-weight:800;">${it.qty}×</td>
      <td><strong>${escapeHtml(it.name)}</strong></td>
      <td>${escapeHtml(it.spec)}</td>
      <td>${escapeHtml(it.source)}</td>
    </tr>`).join('');

  const splitParts: string[] = [];
  if (bom.mfCount > 0) splitParts.push(`${bom.mfCount} M–F`);
  if (bom.mmCount > 0) splitParts.push(`${bom.mmCount} M–M`);
  if (bom.ffCount > 0) splitParts.push(`${bom.ffCount} F–F`);
  const jumperKpiVal = bom.totalJumpers > 0
    ? `${bom.totalJumpers}× (${splitParts.join(', ')})${bom.groveCount ? ` + ${bom.groveCount} Grove` : ''}`
    : (bom.groveCount ? `${bom.groveCount}× Grove` : '0×');

  const colorChipsHtml = bom.colors.length
    ? `<div class="print-wire-colors">${bom.colors.map((c) => `
        <span class="print-color-chip">
          <span class="pin-dot" style="background:${c.dot}"></span>
          <strong>${c.count}×</strong> ${escapeHtml(t(c.i18n))}
        </span>`).join('')}</div>`
    : '';

  const breakdownStr = splitParts.length ? splitParts.join(' • ') : t('print.jumperBreakdown', { mf: bom.mfCount, mm: bom.mmCount });
  const jumperSummaryHtml = `
    <div class="print-jumper-bar">
      <div class="print-jumper-head">
        <strong>🔌 ${escapeHtml(bom.totalJumpers > 0 ? t('print.jumperSummary', { total: bom.totalJumpers }) : t('print.jumperNone'))}</strong>
        ${bom.totalJumpers > 0 ? `<span class="print-jumper-split">${escapeHtml(breakdownStr)}${bom.groveCount ? ' ' + escapeHtml(t('print.jumperGroveTag', { grove: bom.groveCount })) : ''}</span>` : (bom.groveCount ? `<span class="print-jumper-split">${escapeHtml(t('print.jumperGroveTag', { grove: bom.groveCount }))}</span>` : '')}
      </div>
      ${colorChipsHtml}
    </div>`;

  // Section 2: Either K-Comp V2 DIP Switch Block S1 OR Board Configuration & Pin-Mux Summary (ESP32-S3 etc.)
  let section2Html = '';
  if (dipStates.length) {
    const dipCells = dipStates.map((d) => `
      <div class="print-dip-cell ${d.on ? 'on' : 'off'}">
        <strong>S1-${d.id}: ${d.on ? t('common.on') : t('common.off')}</strong>
        <small>${escapeHtml(d.pin)} (${escapeHtml(tDipName(d, true))})</small>
      </div>`).join('');
    section2Html = `
      <div>
        <h4 class="print-sec-title">${escapeHtml(t('print.secDip'))}</h4>
        <div class="print-dip-row">${dipCells}</div>
      </div>`;
  } else {
    const cfgCards: Array<{ title: string; val: string; sub: string; active?: boolean }> = [
      {
        title: t('print.cfgMountTitle'),
        val: carrierActive ? t('print.cfgMountBreadboard') : t('print.cfgMountStandalone'),
        sub: carrierActive ? t('print.cfgMountBreadboardSub') : t('print.cfgMountStandaloneSub'),
        active: carrierActive
      },
      {
        title: t('print.cfgLogicTitle'),
        val: `${board.electrical.logicVoltage}V`,
        sub: board.electrical.logicVoltage < 5 ? t('print.cfgLogic3v3Sub') : t('print.cfgLogic5vSub'),
        active: true
      }
    ];
    for (const ob of getActiveOnboardDefs()) {
      const isOn = !!state.onboard[ob.id];
      cfgCards.push({
        title: tOnboard(ob, 'shortName') || ob.name,
        val: isOn ? t('common.on') : t('common.off'),
        sub: ob.pinInfo || '',
        active: isOn
      });
    }
    if (board.defaultI2cPins) {
      const i2cCount = state.active.filter((i) => getCompDef(i.compId)?.interface === 'I2C').length;
      cfgCards.push({
        title: t('print.cfgI2cTitle'),
        val: i2cCount ? `${i2cCount}× ${t('print.cfgActive')}` : t('print.cfgUnused'),
        sub: `SDA ${board.defaultI2cPins.sda} / SCL ${board.defaultI2cPins.scl}`,
        active: i2cCount > 0
      });
    }
    const uartList = Object.entries(uartAssigns);
    if (uartList.length) {
      const summary = uartList.map(([, u]) => u.badgeLabel).join(', ');
      cfgCards.push({
        title: t('print.cfgUartTitle'),
        val: summary,
        sub: t('print.cfgUartSub', { count: uartList.length }),
        active: true
      });
    }
    section2Html = `
      <div>
        <h4 class="print-sec-title">${escapeHtml(t('print.secBoardCfg'))}</h4>
        <div class="print-cfg-grid">
          ${cfgCards.map((c) => `
            <div class="print-cfg-cell ${c.active ? 'on' : 'off'}">
              <strong>${escapeHtml(c.title)}: ${escapeHtml(c.val)}</strong>
              <small>${escapeHtml(c.sub)}</small>
            </div>`).join('')}
        </div>
      </div>`;
  }

  // Section 3: Wiring Checklist (includes K-Comp V2 breadboard feeders AND ESP32-S3 carrier feeders + exact holes + UART tags)
  const wireRows: string[] = [];
  if (carrierActive) {
    for (const cf of (state.carrierFeeders || [])) {
      const sideLbl = cf.side === 'left' ? t('carrier.sideLeft') : t('carrier.sideRight');
      const pinLbl = board.pins[cf.feederPinId]?.label || cf.feederPinId;
      wireRows.push(`
        <tr class="print-row-rail">
          <td><span class="print-chk"></span></td>
          <td><strong>${escapeHtml(t('print.carrierFeederRow', { rail: cf.label, side: sideLbl }))}</strong></td>
          <td><span class="pin-dot" style="display:inline-block;vertical-align:middle;margin-right:5px;background:${cf.color}"></span>${escapeHtml(pinLbl)}</td>
          <td><strong>${escapeHtml(t('print.carrierFeederDest', { rail: cf.label, side: sideLbl }))}</strong></td>
        </tr>`);
    }
  }
  for (const rail of (state.breadboardRails || [])) {
    const srcLbl = board.pins[rail.bpId]?.label || rail.bpId;
    wireRows.push(`
      <tr class="print-row-rail">
        <td><span class="print-chk"></span></td>
        <td><strong>${escapeHtml(t('print.bbRailRow', { label: rail.label }))}</strong></td>
        <td><span class="pin-dot" style="display:inline-block;vertical-align:middle;margin-right:5px;background:${rail.color}"></span>${escapeHtml(srcLbl)}</td>
        <td><strong>${escapeHtml(t('print.bbRailFeeds', { col: rail.feederHole.colName, count: rail.branches.length }))}</strong></td>
      </tr>`);
    for (const br of (rail.bridges || [])) {
      wireRows.push(`
        <tr class="print-row-rail">
          <td><span class="print-chk"></span></td>
          <td><strong>${escapeHtml(t('print.bbBridgeRow', { label: rail.label }))}</strong></td>
          <td>${escapeHtml(t('print.bbHoleShort', { col: br.fromName, hole: 4 }))}</td>
          <td><strong>${escapeHtml(t('print.bbHoleShort', { col: br.toName, hole: 4 }))}</strong></td>
        </tr>`);
    }
  }
  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def) continue;
    const role = getDisplayLabel(def);
    const protoTag = def.protoArea ? ` [${t('info.badgeProto')}]` : '';
    const uInfo = uartAssigns[inst.instanceId] || null;
    const uartTag = uInfo
      ? ` <span class="print-uart-tag ${uInfo.kind === 'hw' ? 'is-hw' : 'is-sw'}">${escapeHtml(uInfo.badgeLabel)}</span>`
      : '';
    if (!def.pins.length && def.requiresDriver) {
      wireRows.push(`
        <tr>
          <td><span class="print-chk"></span></td>
          <td><strong>${escapeHtml(role)}</strong> (${escapeHtml(def.name)})</td>
          <td>M+ / M−</td>
          <td>${escapeHtml(t('print.dcDest'))}</td>
        </tr>`);
    } else {
      for (const p of def.pins) {
        const bpId = inst.pinMap[p.id];
        const bbBranch = state.breadboardRails
          .flatMap((r) => r.branches)
          .find((b) => b.box.inst.instanceId === inst.instanceId && b.p.id === p.id);
        const carrierHole = carrierActive ? state.carrierWireMap?.[`${inst.instanceId}::${p.id}`] : null;
        const rawPinLbl = bpId ? (board.pins[bpId]?.label || bpId) : t('print.unassigned');

        let bLbl = rawPinLbl;
        if (bbBranch && bbBranch.bbHole) {
          bLbl = t('print.bbPinDest', { col: bbBranch.bbHole.colName, hole: bbBranch.bbHole.holeNum, label: bbBranch.bbHole.rail.label });
        } else if (carrierHole) {
          bLbl = carrierHole.kind === 'rail'
            ? t('print.carrierRailDest', { hole: carrierHole.label })
            : t('print.carrierRowDest', { hole: carrierHole.label, pin: rawPinLbl });
        }

        const isUartPin = p.role === 'UART_RX' || p.role === 'UART_TX';
        wireRows.push(`
          <tr>
            <td><span class="print-chk"></span></td>
            <td><strong>${escapeHtml(role)}</strong> (${escapeHtml(def.name)})${escapeHtml(protoTag)}${isUartPin ? uartTag : ''}</td>
            <td><span class="pin-dot" style="display:inline-block;vertical-align:middle;margin-right:5px;background:${p.color}"></span>${escapeHtml(p.id)}</td>
            <td><strong>${escapeHtml(bLbl)}</strong></td>
          </tr>`);
      }
    }
  }

  const safetyNotes = [
    ...warnings.map((w) => w.text),
    ...state.active.filter((i) => getCompDef(i.compId)?.voltage?.includes('ONLY')).map((i) => t('print.strictlyVoltage', { name: getDisplayLabel(getCompDef(i.compId)), voltage: getCompDef(i.compId).voltage })),
    ...state.active.filter((i) => getCompDef(i.compId)?.protoArea).map((i) => `${getDisplayLabel(getCompDef(i.compId))}: ${tComp(getCompDef(i.compId), 'protoNote') || t('info.protoDefault')}`)
  ];

  const today = new Date().toLocaleDateString(getLocale() === 'de' ? 'de-AT' : (getLocale() === 'sq' ? 'sq-AL' : undefined));
  const bannerDesc = dipStates.length
    ? t('print.bannerDesc')
    : t('print.bannerDescGeneric', { board: board.shortName, voltage: board.electrical.logicVoltage });
  const boardPinColHead = carrierActive
    ? t('print.colBoardBreadboardPin', { board: board.shortName })
    : t('print.colBoardPinDynamic', { board: board.shortName });

  $('#printSheet').innerHTML = `
    <div class="stop-banner">
      <div class="stop-oct">!</div>
      <div>
        <h3>${escapeHtml(t('print.bannerTitle'))}</h3>
        <p>${escapeHtml(bannerDesc)}</p>
      </div>
    </div>

    <div class="print-meta-grid">
      <div class="print-kpi"><div class="print-kpi-lbl">${escapeHtml(t('print.kpiProject'))}</div><div class="print-kpi-val">${escapeHtml(getCleanProjectName() || t('print.kpiUntitled'))}</div></div>
      <div class="print-kpi"><div class="print-kpi-lbl">${escapeHtml(t('print.kpiBoard'))}</div><div class="print-kpi-val">${escapeHtml(board.name)}</div></div>
      <div class="print-kpi"><div class="print-kpi-lbl">${escapeHtml(t('print.kpiJumpers'))}</div><div class="print-kpi-val">${escapeHtml(jumperKpiVal)}</div></div>
      <div class="print-kpi"><div class="print-kpi-lbl">${escapeHtml(t('print.kpiCurrent'))}</div><div class="print-kpi-val">~${cur.total} mA / ${maxMa} mA</div></div>
      <div class="print-kpi"><div class="print-kpi-lbl">${escapeHtml(t('print.kpiSram'))}</div><div class="print-kpi-val">${sramPct}% (${escapeHtml(ramFmt.usedStr)} / ${escapeHtml(ramFmt.totalStr)})</div></div>
      <div class="print-kpi"><div class="print-kpi-lbl">${escapeHtml(hasModeToggle ? t('print.kpiOled') : t('print.kpiLogic'))}</div><div class="print-kpi-val">${escapeHtml(hasModeToggle ? (state.onboard.onboard_oled ? (state.oledPaged ? t('print.oledPagedVal') : t('print.oledFullVal')) : t('print.oledDisabled')) : `${board.electrical.logicVoltage}V Logic${carrierActive ? ' · Breadboard' : ''}`)}</div></div>
    </div>

    <div class="print-svg-box">${svgMarkup}</div>

    ${safetyNotes.length ? `
      <div class="print-warn-box">
        <strong>${escapeHtml(t('print.safetyTitle'))}</strong>
        <ul>${safetyNotes.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
      </div>` : ''}

    <div>
      <h4 class="print-sec-title">${escapeHtml(t('print.secBom'))}</h4>
      <table class="print-table">
        <thead>
          <tr>
            <th style="width:28px">${escapeHtml(t('print.colOk'))}</th>
            <th style="width:46px;text-align:center">${escapeHtml(t('print.bomColQty'))}</th>
            <th>${escapeHtml(t('print.bomColItem'))}</th>
            <th>${escapeHtml(t('print.bomColModel'))}</th>
            <th>${escapeHtml(t('print.bomColSource'))}</th>
          </tr>
        </thead>
        <tbody>${bomRowsHtml}</tbody>
      </table>
      ${jumperSummaryHtml}
    </div>

    ${section2Html}

    <div>
      <h4 class="print-sec-title">${escapeHtml(t('print.secWires', { count: wireRows.length }))}</h4>
      ${wireRows.length ? `
        <table class="print-table">
          <thead><tr><th style="width:28px">${escapeHtml(t('print.colOk'))}</th><th>${escapeHtml(t('print.colModule'))}</th><th>${escapeHtml(t('print.colModPin'))}</th><th>${escapeHtml(boardPinColHead)}</th></tr></thead>
          <tbody>${wireRows.join('')}</tbody>
        </table>` : `<p style="font-size:12px;color:#475569;margin:4px 0;">${escapeHtml(t('print.noExternal'))}</p>`}
    </div>

    <div class="print-sign-grid">
      <div class="print-sign-field">${escapeHtml(t('print.signStudent'))}</div>
      <div class="print-sign-field">${escapeHtml(t('print.signDate', { date: today }))}</div>
      <div class="print-sign-field">${escapeHtml(t('print.signTeacher'))}</div>
    </div>
    <div class="print-copyright-foot">
      <span>K-Comp Configurator v${escapeHtml(APP_VERSION)} · © ${escapeHtml(COPYRIGHT_YEARS)} ${escapeHtml(COPYRIGHT_AUTHOR)}</span>
      <span>${escapeHtml(CONFIGURATOR_REPO_URL.replace('https://', ''))}</span>
    </div>`;

  $('#printModal')?.classList.remove('hidden');
}
