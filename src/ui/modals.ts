// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Component Info Popup, Hardware Lab Sheet (BOM + Jumper Count + Wiring + Sign-Off) & Standalone SVG Library
import { APP_VERSION, COPYRIGHT_AUTHOR, COPYRIGHT_YEARS, SPDX_LICENSE, LICENSE_URL, CONFIGURATOR_REPO_URL, HARDWARE_REPO_URL, resolveAssetUrl } from '../core/constants';
import { state, hooks, $, escapeHtml, getCleanProjectName, showToast, formatRamAmount } from '../core/state';
import {
  getCompDef, countActiveByCompId, getDisplayLabel,
  getExternalPinClaims, getOnboardPinUsage,
  computeDipStates, computeCriticalWarnings, computeSram, computeUsbCurrent
} from '../core/hardware';
import { badgeClass } from './inspector';
import { computeLayoutBounds, updateBoardSvgState, renderDockedComponentsAndWires } from './workbench';
import { COMPONENT_GUIDES } from '../catalog/component-guide-data';
import { buildComponentApiCardHtml, bindComponentApiCardEvents } from './api-browser';
import { t, tComp, tCompInfo, tDipName, getLocale } from '../i18n/index';
import { getActiveBoard, isBoardCarrierActive, listBoards } from '../boards';

export function updateInfoModalDocLink(def) {
  if (!def) return;
  const docLink = $('#infoModalDocLink');
  if (!docLink) return;
  const matchedPdf = state.repoDocsMap.get(def.id);
  if (matchedPdf) {
    docLink.href = matchedPdf.url;
    docLink.textContent = `📄 ${matchedPdf.filename} ↗`;
    docLink.title = t('info.docsOpenTitle', { file: matchedPdf.filename });
    docLink.className = 'btn btn-primary btn-sm';
  } else {
    docLink.href = def.docUrl || 'https://github.com/andkuc/k-comp/tree/main/docs/ModuleDocumentation';
    docLink.textContent = state.repoDocsLoaded ? t('info.docsFolder') : t('info.docsChecking');
    docLink.title = t('info.docsFolderTitle');
    docLink.className = 'btn btn-ghost btn-sm';
  }
}

const PIN_DISPLAY_ORDER = [
  'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'A0', 'A3'
];

function shortBoardPinText(bpId, role) {
  const meta = getActiveBoard()?.pins?.[bpId];
  if (!meta) return bpId;
  if (role === 'INT') {
    if (bpId === 'D2') return 'D2 (INT0)';
    if (bpId === 'D3') return '~D3 (INT1)';
  }
  const hasPwm = (meta.caps || []).includes('PWM');
  return hasPwm ? `~${bpId}` : bpId;
}

function getAllPossibleSignalPins(pinSpec) {
  const allowed = pinSpec.allowedTypes || [];
  const allPins = getActiveBoard()?.pins || {};
  const list = [];
  for (const [bpId, meta] of Object.entries(allPins)) {
    if (meta.blocked) continue;
    const caps = meta.caps || [];
    if (allowed.some((cap) => caps.includes(cap))) {
      list.push(bpId);
    }
  }
  list.sort((a, b) => {
    const ia = PIN_DISPLAY_ORDER.indexOf(a);
    const ib = PIN_DISPLAY_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
  return list;
}

function buildSignalFlowHtml(guide, lang) {
  if (!guide) return '';
  const steps = (guide.flow && (guide.flow[lang] || guide.flow.en)) || [];
  if (!steps.length) return '';
  const dir = guide.dir || 'in';
  const arrow = dir === 'bi' ? '⇄' : '→';
  const dirLabel = dir === 'out' ? t('info.flowOut') : (dir === 'bi' ? t('info.flowBi') : t('info.flowIn'));
  const note = (guide.flowNote && (guide.flowNote[lang] || guide.flowNote.en)) || '';

  const chainHtml = steps.map((step, idx) => {
    const isLast = idx === steps.length - 1;
    const isKcomp = /k-comp/i.test(step);
    const cls = `info-flow-node${isKcomp ? ' is-kcomp' : ''}${idx === 0 ? ' is-start' : ''}${isLast ? ' is-end' : ''}`;
    return `<span class="${cls}">${escapeHtml(step)}</span>${isLast ? '' : `<span class="info-flow-arrow" aria-hidden="true">${arrow}</span>`}`;
  }).join('');

  return `
    <div class="info-section info-flow-card">
      <div class="info-sec-head">
        <h3>🔀 ${escapeHtml(t('info.signalFlowTitle'))}</h3>
        <span class="info-dir-badge is-${dir}">${escapeHtml(dirLabel)}</span>
      </div>
      <div class="info-flow-chain">${chainHtml}</div>
      ${note ? `<p class="info-flow-note">${escapeHtml(note)}</p>` : ''}
    </div>`;
}

function buildRichPinMappingHtml(def) {
  if (!def.pins.length) {
    if (def.requiresDriver === 'tb6612fng') {
      return `
        <div class="info-pin-driver-note">
          <span>⚡</span>
          <span>${escapeHtml(t('info.pinMotorDriverNote'))}</span>
        </div>`;
    }
    return '';
  }

  const extClaims = getExternalPinClaims();
  const obUsage = getOnboardPinUsage();
  const activeInsts = state.active.filter((i) => i.compId === def.id);
  const assignedInstIds = new Set(activeInsts.map((i) => i.instanceId));
  let hasLiveChips = false;
  let hasAnalogNote = false;
  let hasI2cNote = false;
  let hasUartNote = false;

  const renderLivePinChip = (bpId, role, compPinId) => {
    hasLiveChips = true;
    const lbl = shortBoardPinText(bpId, role);
    const ext = extClaims[bpId];
    const ob = obUsage[bpId];
    const assignedHere = activeInsts.some((inst) => inst.pinMap[compPinId] === bpId);

    if (assignedHere) {
      return `<span class="info-pin-chip is-assigned" title="${escapeHtml(t('info.pinTipAssigned', { pin: lbl }))}">${escapeHtml(lbl)}</span>`;
    }
    if (ext && !assignedInstIds.has(ext.instanceId)) {
      return `<span class="info-pin-chip is-used" title="${escapeHtml(t('info.pinTipUsed', { pin: lbl, who: ext.compName }))}">${escapeHtml(lbl)}</span>`;
    }
    if (ob) {
      const dipHint = ob.dip ? `S1-${ob.dip}` : ob.name;
      return `<span class="info-pin-chip is-onboard" title="${escapeHtml(t('info.pinTipOnboard', { pin: lbl, name: ob.name, tag: dipHint }))}">${escapeHtml(lbl)}<span class="info-pin-sub">${escapeHtml(ob.dip ? `S1-${ob.dip}` : 'OB')}</span></span>`;
    }
    return `<span class="info-pin-chip is-free" title="${escapeHtml(t('info.pinTipFree', { pin: lbl }))}">${escapeHtml(lbl)}</span>`;
  };

  const renderI2cHeaderChips = () => {
    hasLiveChips = true;
    hasI2cNote = true;
    return ['H1', 'H2', 'H3'].map((hk) => {
      const holders = state.active.filter((i) => i.i2cHeader === hk);
      const assignedHere = holders.some((i) => i.compId === def.id);
      if (assignedHere) {
        return `<span class="info-pin-chip is-assigned" title="${escapeHtml(t('info.pinTipAssigned', { pin: hk }))}">${hk}</span>`;
      }
      if (holders.length) {
        const who = holders.map((i) => getDisplayLabel(getCompDef(i.compId))).join(' + ');
        return `<span class="info-pin-chip is-used" title="${escapeHtml(t('info.pinTipUsed', { pin: hk, who }))}">${hk}</span>`;
      }
      return `<span class="info-pin-chip is-free" title="${escapeHtml(t('info.pinTipFree', { pin: hk }))}">${hk}</span>`;
    }).join('');
  };

  const rowsHtml = def.pins.map((p) => {
    let destHtml = '';
    let roleHint = '';

    if (p.role === 'POWER_5V' || p.role === 'I2C_VCC') {
      const is33 = def.voltage.includes('3.3V ONLY') || (p.label || '').includes('3.3V');
      destHtml = is33
        ? `<span class="info-pin-chip is-power-warn">3.3V !</span>`
        : `<span class="info-pin-chip is-power">5V</span>`;
    } else if (p.role === 'POWER_3V3') {
      destHtml = `<span class="info-pin-chip is-power-warn">3.3V !</span>`;
    } else if (p.role === 'GND' || p.role === 'I2C_GND') {
      destHtml = `<span class="info-pin-chip is-power">GND</span>`;
    } else if (p.role === 'RESET') {
      destHtml = `<span class="info-pin-chip is-fixed">RESET (S1-1 ON)</span>`;
    } else if (p.role === 'SLOT') {
      if (p.id === 'VCC' || p.id === '3V3') {
        destHtml = `<span class="info-pin-chip is-power">${p.id === '3V3' ? '3.3V' : '5V'} (${escapeHtml(t('info.pinSlotShort'))})</span>`;
      } else if (p.id === 'GND') {
        destHtml = `<span class="info-pin-chip is-power">GND (${escapeHtml(t('info.pinSlotShort'))})</span>`;
      } else if (p.id === 'TX') {
        destHtml = `<span class="info-pin-chip is-fixed">D6 (S1-7 ON)</span>`;
      } else if (p.id === 'RX') {
        destHtml = `<span class="info-pin-chip is-fixed">D7 (S1-8 ON)</span>`;
      } else {
        destHtml = `<span class="info-pin-chip is-fixed">${escapeHtml(p.label)}</span>`;
      }
    } else if (p.role === 'I2C_SDA' || p.role === 'I2C_SCL') {
      const busTag = p.role === 'I2C_SDA' ? 'SDA (A4)' : 'SCL (A5)';
      destHtml = `<span class="info-pin-bus-tag">${busTag}</span><span class="info-pin-via">${escapeHtml(t('info.pinViaHeaders'))}</span>${renderI2cHeaderChips()}`;
    } else if (p.selectable) {
      if (p.role === 'ANALOG') hasAnalogNote = true;
      if (p.role === 'UART_RX') { hasUartNote = true; roleHint = '→ K-Comp RX'; }
      if (p.role === 'UART_TX') { hasUartNote = true; roleHint = '→ K-Comp TX'; }
      if (p.role === 'PWM') roleHint = 'PWM';
      if (p.role === 'INT') roleHint = 'INT0/1';
      const candidates = getAllPossibleSignalPins(p);
      destHtml = candidates.map((bpId) => renderLivePinChip(bpId, p.role, p.id)).join('');
    } else {
      destHtml = `<span class="info-pin-chip is-fixed">${escapeHtml(p.label)}</span>`;
    }

    return `
      <div class="info-pin-row">
        <div class="info-pin-left">
          <span class="pin-dot" style="background:${p.color}"></span>
          <span class="info-pin-name">${escapeHtml(p.id)}</span>
          ${roleHint ? `<span class="info-pin-role">${escapeHtml(roleHint)}</span>` : ''}
        </div>
        <div class="info-pin-chips">${destHtml}</div>
      </div>`;
  }).join('');

  const extraNotes = [];
  if (hasAnalogNote) extraNotes.push(t('info.pinAnalogNote'));
  if (hasI2cNote) extraNotes.push(t('info.pinI2cHubNote'));
  if (hasUartNote) extraNotes.push(t('info.pinUartCross'));

  const legendHtml = hasLiveChips ? `
    <div class="info-pin-legend">
      <span class="ip-leg"><span class="ip-dot is-free"></span>${escapeHtml(t('info.pinLegendFree'))}</span>
      <span class="ip-leg"><span class="ip-dot is-onboard"></span>${escapeHtml(t('info.pinLegendOnboard'))}</span>
      <span class="ip-leg"><span class="ip-dot is-used"></span>${escapeHtml(t('info.pinLegendUsed'))}</span>
      ${activeInsts.length ? `<span class="ip-leg"><span class="ip-dot is-assigned"></span>${escapeHtml(t('info.pinLegendAssigned'))}</span>` : ''}
    </div>` : '';

  const notesHtml = extraNotes.length
    ? `<div class="info-pin-notes">${extraNotes.map((n) => `<span>ℹ ${escapeHtml(n)}</span>`).join('')}</div>`
    : '';

  return `
    <div class="info-pin-grid">
      <div class="info-pin-grid-head">
        <span>${escapeHtml(t('info.pinColModule'))}</span>
        <span>${escapeHtml(t('info.pinColKcomp'))}</span>
      </div>
      ${rowsHtml}
    </div>
    ${legendHtml}
    ${notesHtml}`;
}

export function openComponentInfo(compId) {
  const def = getCompDef(compId);
  if (!def) return;
  const info = tCompInfo(def);
  const lang = getLocale();
  const guide = COMPONENT_GUIDES[def.id] || null;
  const roleTitle = getDisplayLabel(def);
  const cnt = countActiveByCompId(def.id);
  const max = def.maxPerDesign ?? 1;
  const maxed = cnt >= max;

  $('#infoModalTitle').textContent = roleTitle;
  $('#infoModalModel').textContent = `${def.name} — ${tComp(def, 'subtitle')}`;

  const badges = [
    `<span class="badge ${badgeClass(def.interface)}">${def.interface}</span>`,
    def.i2cAddr ? `<span class="badge">I²C ${def.i2cAddr}</span>` : '',
    `<span class="badge ${def.voltage.includes('ONLY') ? 'badge-warn' : ''}">${def.voltage}</span>`,
    `<span class="badge">~${def.currentMa || 0} mA</span>`,
    `<span class="badge">~${def.sram || 0} B RAM</span>`,
    `<span class="badge">Max ${max}×</span>`,
    def.protoArea ? `<span class="badge badge-proto">${escapeHtml(t('info.badgeProto'))}</span>` : ''
  ].filter(Boolean).join('');
  $('#infoModalBadges').innerHTML = badges;

  const ideasHtml = (info.ideas && info.ideas.length)
    ? `<div class="info-ideas">${info.ideas.map((id) => `<span class="info-idea-chip">💡 ${escapeHtml(id)}</span>`).join('')}</div>`
    : '';

  const elecText = guide && guide.electrical ? (guide.electrical[lang] || guide.electrical.en || '') : '';
  const electricalHtml = elecText ? `
    <div class="info-section info-elec-box">
      <h3>⚡ ${escapeHtml(t('info.electricalTitle'))}</h3>
      <p>${escapeHtml(elecText)}</p>
    </div>` : '';

  const signalFlowHtml = buildSignalFlowHtml(guide, lang);
  const pinMappingHtml = buildRichPinMappingHtml(def);

  const allTips = [...(info.tips || [])];
  const locMaxReason = tComp(def, 'maxReason');
  if (locMaxReason && !allTips.some((tp) => tp.toLowerCase().includes('max'))) {
    allTips.push(t('info.maxPerBoard', { max, reason: locMaxReason }));
  }
  const extraTips = guide && guide.extraTips ? (guide.extraTips[lang] || guide.extraTips.en || []) : [];
  for (const et of extraTips) {
    if (et && !allTips.some((tp) => tp.toLowerCase() === et.toLowerCase())) {
      allTips.push(et);
    }
  }
  const tipsHtml = allTips.length
    ? `<ul class="info-tip-list">${allTips.map((tp) => `<li>${escapeHtml(tp)}</li>`).join('')}</ul>`
    : '';

  const incs = (def.code && def.code.includes) ? def.code.includes : [];
  let libText = '';
  if (incs.length) {
    libText = incs.join('\n');
  } else if (def.requiresDriver === 'tb6612fng') {
    libText = '#include <kcomp_motor_i2c.h> // via TB6612FNG Motor Driver Shield';
  } else {
    libText = t('info.noLibComment');
  }
  const canCopyLib = incs.length > 0 || def.requiresDriver === 'tb6612fng';

  const bodyEl = $('#infoModalBody');
  bodyEl.innerHTML = `
    <div class="info-hero-grid">
      <div class="info-svg-stage">
        <img class="info-svg-preview" src="${resolveAssetUrl(def.svgFile)}" alt="${escapeHtml(roleTitle)}" />
        ${def.protoArea ? `<span class="info-svg-tag badge badge-proto">${escapeHtml(t('info.badgeProto'))}</span>` : ''}
      </div>
      <div class="info-hero-text">
        <h3>${escapeHtml(t('info.whatItDoes'))}</h3>
        <p>${escapeHtml(info.whatItDoes || tComp(def, 'subtitle'))}</p>
        ${ideasHtml}
      </div>
    </div>

    ${def.protoArea ? `<div class="comp-warn-note danger">🔴 <strong>${escapeHtml(t('info.protoArea'))}</strong> ${escapeHtml(tComp(def, 'protoNote') || t('info.protoDefault'))}</div>` : ''}

    ${electricalHtml}
    ${signalFlowHtml}

    <div class="info-section">
      <h3>🔌 ${escapeHtml(t('info.pinMappingTitle'))}</h3>
      <p class="info-connect-summary">${escapeHtml(info.howToConnect || t('info.connectDefault'))}</p>
      ${pinMappingHtml}
    </div>

    ${tipsHtml ? `
      <div class="info-section info-tips-box">
        <h3>⚠ ${escapeHtml(t('info.tips'))}</h3>
        ${tipsHtml}
      </div>` : ''}

    <div class="info-section">
      <h3>📚 ${escapeHtml(t('info.libApiSection'))}</h3>
      <div class="info-lib-row">
        <code class="info-lib-code">${escapeHtml(libText)}</code>
        ${canCopyLib ? `<button id="btnInfoCopyLib" class="btn btn-ghost btn-sm info-copy-btn" type="button">${escapeHtml(t('info.copyInclude'))}</button>` : ''}
      </div>
      ${buildComponentApiCardHtml(def.id)}
    </div>`;

  bodyEl.scrollTop = 0;

  bodyEl.querySelector<any>('#btnInfoCopyLib')?.addEventListener('click', async (e: any) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(libText);
      btn.textContent = t('info.copiedInclude');
      showToast(t('api.toastCopied', { item: libText.split('\n')[0] }));
      setTimeout(() => { btn.textContent = t('info.copyInclude'); }, 1200);
    } catch (_) {}
  });

  bindComponentApiCardEvents(bodyEl, def.id);

  state.openInfoCompId = def.id;
  updateInfoModalDocLink(def);

  const addBtn = $('#btnInfoAddComp');
  addBtn.dataset.compId = def.id;
  addBtn.disabled = maxed;
  addBtn.textContent = maxed
    ? t('info.btnAdded', { cnt, max })
    : (cnt ? t('info.btnAddAnother', { cnt, max }) : t('info.btnAdd'));

  $('#compInfoModal').classList.remove('hidden');
}

// Categorize wire color hex into standard classroom jumper color buckets
function classifyWireColor(hex) {
  const c = String(hex || '').toLowerCase();
  if (c === '#ef4444' || c === '#dc2626' || c === '#f43f5e') return { key: 'red', dot: '#ef4444', i18n: 'print.wireColorRed' };
  if (c === '#f97316' || c === '#fb923c' || c === '#ea580c') return { key: 'orange', dot: '#f97316', i18n: 'print.wireColorOrange' };
  if (c === '#334155' || c === '#475569' || c === '#64748b' || c === '#1e293b' || c === '#78350f' || c === '#0f172a') return { key: 'dark', dot: '#334155', i18n: 'print.wireColorDark' };
  if (c === '#eab308' || c === '#facc15' || c === '#fbbf24' || c === '#ca8a04') return { key: 'yellow', dot: '#eab308', i18n: 'print.wireColorYellow' };
  if (c === '#10b981' || c === '#22c55e' || c === '#16a34a' || c === '#34d399') return { key: 'green', dot: '#10b981', i18n: 'print.wireColorGreen' };
  return { key: 'blue', dot: '#0ea5e9', i18n: 'print.wireColorBlue' };
}

// Compute complete Bill of Materials (BOM) & physical Jumper Wire counts (M-F, M-M, Grove, colors)
function buildBomData() {
  const items = [
    {
      qty: 1,
      name: t('print.bomBaseBoard'),
      spec: t('print.bomBaseSpec'),
      source: t('print.bomBaseNote')
    }
  ];

  // Group active external modules by compId
  const byComp = new Map();
  for (const inst of state.active) {
    byComp.set(inst.compId, (byComp.get(inst.compId) || 0) + 1);
  }

  for (const [compId, qty] of byComp.entries()) {
    const def = getCompDef(compId);
    if (!def) continue;
    let src = t('print.bomAssortment');
    if (def.onboardWirelessSlot) src = t('print.bomOnboardSlot');
    else if (def.protoArea) src = t('print.bomProtoArea');
    items.push({
      qty,
      name: getDisplayLabel(def),
      spec: `${def.name} (${def.voltage})`,
      source: src
    });
  }

  // Automatic accessory detection
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

  // Exact Jumper Wire Calculation
  let mfCount = 0;
  let mmCount = 0;
  let groveCount = 0;
  const colorCounts = new Map(); // key -> { dot, i18n, count }
  const addColor = (hex) => {
    const bucket = classifyWireColor(hex);
    if (!colorCounts.has(bucket.key)) colorCounts.set(bucket.key, { ...bucket, count: 0 });
    colorCounts.get(bucket.key).count++;
  };

  // 0. Centered Breadboard Carrier (if active, e.g. ESP32-S3 on Breadboard)
  if (isBoardCarrierActive(getActiveBoard(), state.carrierEnabled)) {
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

  // 1. Breadboard feeders & column bridges are always Male-Male jumpers
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

    const usesMaleMale = !!def.protoArea || def.id === 'sg90-180' || def.id === 'sg90-360';
    for (const p of def.pins) {
      if (usesMaleMale) mmCount++;
      else mfCount++;
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
  if (groveCount > 0) {
    items.push({
      qty: groveCount,
      name: t('print.bomGrove'),
      spec: t('print.bomGroveSpec'),
      source: t('print.bomGroveNote'),
      isWire: true
    });
  }

  const totalJumpers = mfCount + mmCount;
  return {
    items,
    mfCount,
    mmCount,
    groveCount,
    totalJumpers,
    colors: Array.from(colorCounts.values()).sort((a, b) => b.count - a.count)
  };
}

export function openPrintStopSheet() {
  const svg = $('#masterSvg');
  const prevFocused = state.focusedId;
  const prevVb = { ...state.vb };

  state.focusedId = null;
  const dipStates = computeDipStates();
  const warnings = computeCriticalWarnings();
  const sramUsed = computeSram();
  const sramPct = Math.round((sramUsed / getActiveBoard().sramTotal) * 100);
  const cur = computeUsbCurrent();

  updateBoardSvgState(dipStates);
  renderDockedComponentsAndWires();

  // Compute BOM AFTER renderDockedComponentsAndWires() so state.breadboardRails is 100% up-to-date
  const bom = buildBomData();

  const bounds = computeLayoutBounds();
  svg.setAttribute('viewBox', `${bounds.x.toFixed(1)} ${bounds.y.toFixed(1)} ${bounds.w.toFixed(1)} ${bounds.h.toFixed(1)}`);
  const clone = svg.cloneNode(true);
  clone.removeAttribute('id');
  clone.setAttribute('viewBox', `${bounds.x.toFixed(1)} ${bounds.y.toFixed(1)} ${bounds.w.toFixed(1)} ${bounds.h.toFixed(1)}`);
  clone.querySelectorAll<any>('.kcomp-pin-hit, #kcomp-onboard-hit-layer, #dragOverlayLayer, #pinFlagsLayer, .hw-flash-group, .drag-hover-ring, .comp-rotate-handle, .comp-quick-rotate, .comp-quick-btn, .pin-needs-free, .wire-hit-path').forEach((n) => n.remove());
  const svgMarkup = new XMLSerializer().serializeToString(clone);

  state.focusedId = prevFocused;
  state.vb = prevVb;
  hooks.applyViewBox();
  updateBoardSvgState(dipStates);
  renderDockedComponentsAndWires();

  // BOM Table Rows
  const bomRowsHtml = bom.items.map((it) => `
    <tr class="${it.isWire ? 'print-row-wire' : ''}">
      <td><span class="print-chk"></span></td>
      <td style="text-align:center;font-family:var(--mono);font-weight:800;">${it.qty}×</td>
      <td><strong>${escapeHtml(it.name)}</strong></td>
      <td>${escapeHtml(it.spec)}</td>
      <td>${escapeHtml(it.source)}</td>
    </tr>`).join('');

  const jumperKpiVal = bom.totalJumpers > 0
    ? `${bom.totalJumpers}× (${bom.mfCount} M–F, ${bom.mmCount} M–M)${bom.groveCount ? ` + ${bom.groveCount} Grove` : ''}`
    : (bom.groveCount ? `${bom.groveCount}× Grove` : '0×');

  const colorChipsHtml = bom.colors.length
    ? `<div class="print-wire-colors">${bom.colors.map((c) => `
        <span class="print-color-chip">
          <span class="pin-dot" style="background:${c.dot}"></span>
          <strong>${c.count}×</strong> ${escapeHtml(t(c.i18n))}
        </span>`).join('')}</div>`
    : '';

  const jumperSummaryHtml = `
    <div class="print-jumper-bar">
      <div class="print-jumper-head">
        <strong>🔌 ${escapeHtml(bom.totalJumpers > 0 ? t('print.jumperSummary', { total: bom.totalJumpers }) : t('print.jumperNone'))}</strong>
        ${bom.totalJumpers > 0 ? `<span class="print-jumper-split">${escapeHtml(t('print.jumperBreakdown', { mf: bom.mfCount, mm: bom.mmCount }))}${bom.groveCount ? ' ' + escapeHtml(t('print.jumperGroveTag', { grove: bom.groveCount })) : ''}</span>` : (bom.groveCount ? `<span class="print-jumper-split">${escapeHtml(t('print.jumperGroveTag', { grove: bom.groveCount }))}</span>` : '')}
      </div>
      ${colorChipsHtml}
    </div>`;

  const dipCells = dipStates.map((d) => `
    <div class="print-dip-cell ${d.on ? 'on' : 'off'}">
      <strong>S1-${d.id}: ${d.on ? t('common.on') : t('common.off')}</strong>
      <small>${escapeHtml(d.pin)} (${escapeHtml(tDipName(d, true))})</small>
    </div>`).join('');

  const wireRows = [];
  for (const rail of (state.breadboardRails || [])) {
    const srcLbl = getActiveBoard().pins[rail.bpId]?.label || rail.bpId;
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
    const role = getDisplayLabel(def);
    const protoTag = def.protoArea ? ` [${t('info.badgeProto')}]` : '';
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
        const bLbl = bbBranch && bbBranch.bbHole
          ? t('print.bbPinDest', { col: bbBranch.bbHole.colName, hole: bbBranch.bbHole.holeNum, label: bbBranch.bbHole.rail.label })
          : (bpId ? (getActiveBoard().pins[bpId]?.label || bpId) : t('print.unassigned'));
        wireRows.push(`
          <tr>
            <td><span class="print-chk"></span></td>
            <td><strong>${escapeHtml(role)}</strong> (${escapeHtml(def.name)})${escapeHtml(protoTag)}</td>
            <td><span class="pin-dot" style="display:inline-block;vertical-align:middle;margin-right:5px;background:${p.color}"></span>${escapeHtml(p.id)}</td>
            <td><strong>${escapeHtml(bLbl)}</strong></td>
          </tr>`);
      }
    }
  }

  const safetyNotes = [
    ...warnings.map((w) => w.text),
    ...state.active.filter((i) => getCompDef(i.compId).voltage.includes('ONLY')).map((i) => t('print.strictlyVoltage', { name: getDisplayLabel(getCompDef(i.compId)), voltage: getCompDef(i.compId).voltage })),
    ...state.active.filter((i) => getCompDef(i.compId).protoArea).map((i) => `${getDisplayLabel(getCompDef(i.compId))}: ${tComp(getCompDef(i.compId), 'protoNote') || t('info.protoDefault')}`)
  ];

  const today = new Date().toLocaleDateString(getLocale() === 'de' ? 'de-AT' : (getLocale() === 'sq' ? 'sq-AL' : undefined));
  $('#printSheet').innerHTML = `
    <div class="stop-banner">
      <div class="stop-oct">!</div>
      <div>
        <h3>${escapeHtml(t('print.bannerTitle'))}</h3>
        <p>${escapeHtml(t('print.bannerDesc'))}</p>
      </div>
    </div>

    <div class="print-meta-grid">
      <div class="print-kpi"><div class="print-kpi-lbl">${escapeHtml(t('print.kpiProject'))}</div><div class="print-kpi-val">${escapeHtml(getCleanProjectName() || t('print.kpiUntitled'))}</div></div>
      <div class="print-kpi"><div class="print-kpi-lbl">${escapeHtml(t('print.kpiBoard'))}</div><div class="print-kpi-val">${escapeHtml(getActiveBoard().name)}</div></div>
      <div class="print-kpi"><div class="print-kpi-lbl">${escapeHtml(t('print.kpiJumpers'))}</div><div class="print-kpi-val">${escapeHtml(jumperKpiVal)}</div></div>
      <div class="print-kpi"><div class="print-kpi-lbl">${escapeHtml(t('print.kpiCurrent'))}</div><div class="print-kpi-val">~${cur.total} mA / 500 mA</div></div>
      <div class="print-kpi"><div class="print-kpi-lbl">${escapeHtml(t('print.kpiSram'))}</div><div class="print-kpi-val">${sramPct}% (${escapeHtml(formatRamAmount(sramUsed, getActiveBoard().sramTotal).usedStr)} / ${escapeHtml(formatRamAmount(sramUsed, getActiveBoard().sramTotal).totalStr)})</div></div>
      <div class="print-kpi"><div class="print-kpi-lbl">${escapeHtml(getActiveBoard().id === 'kcomp-v2' ? t('print.kpiOled') : t('print.kpiLogic'))}</div><div class="print-kpi-val">${escapeHtml(getActiveBoard().id === 'kcomp-v2' ? (state.onboard.onboard_oled ? (state.oledPaged ? t('print.oledPagedVal') : t('print.oledFullVal')) : t('print.oledDisabled')) : `${getActiveBoard().electrical.logicVoltage}V Logic`)}</div></div>
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

    ${dipStates.length ? `
    <div>
      <h4 class="print-sec-title">${escapeHtml(t('print.secDip'))}</h4>
      <div class="print-dip-row">${dipCells}</div>
    </div>` : ''}

    <div>
      <h4 class="print-sec-title">${escapeHtml(t('print.secWires', { count: wireRows.length }))}</h4>
      ${wireRows.length ? `
        <table class="print-table">
          <thead><tr><th style="width:28px">${escapeHtml(t('print.colOk'))}</th><th>${escapeHtml(t('print.colModule'))}</th><th>${escapeHtml(t('print.colModPin'))}</th><th>${escapeHtml(t('print.colBoardPin'))}</th></tr></thead>
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

  $('#printModal').classList.remove('hidden');
}

export function openSvgLibrary() {
  const boardItems = listBoards().map((b) => ({
    id: b.id,
    name: b.id === 'kcomp-v2' ? t('svgLib.boardName') : b.name,
    file: b.svgAsset
  }));
  const items = [
    ...boardItems,
    ...state.catalog.components.map((c) => ({ id: c.id, name: c.name, file: c.svgFile }))
  ];
  $('#svgGallery').innerHTML = items.map((it) => `
    <div class="gallery-tile">
      <img src="${resolveAssetUrl(it.file)}" alt="${escapeHtml(it.name)}" loading="lazy" />
      <strong>${escapeHtml(it.name)}</strong>
      <a href="${resolveAssetUrl(it.file)}" download="${it.id}.svg">⬇ ${it.id}.svg</a>
    </div>`).join('');
  $('#svgModal').classList.remove('hidden');
}


export function openAboutModal() {
  const body = $('#aboutModalBody');
  if (!body) return;
  body.innerHTML = `
    <div class="about-hero-box">
      <div class="about-badge">${escapeHtml(getActiveBoard().badge)}</div>
      <div>
        <div class="about-title-line"><strong>K-Comp Configurator</strong> <span class="badge">v${escapeHtml(APP_VERSION)}</span></div>
        <div class="about-author-line">© ${escapeHtml(COPYRIGHT_YEARS)} ${escapeHtml(COPYRIGHT_AUTHOR)}</div>
        <div class="about-origin-line">${escapeHtml(t('about.desc'))}</div>
      </div>
    </div>
    <p class="about-note">${escapeHtml(t('about.licenseShort', { spdx: SPDX_LICENSE }))}</p>
    <div class="about-links-row">
      <a class="btn btn-primary btn-sm" href="${escapeHtml(CONFIGURATOR_REPO_URL)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('about.repoApp'))} ↗</a>
      <a class="btn btn-ghost btn-sm" href="${escapeHtml(HARDWARE_REPO_URL)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('about.repoHw'))} ↗</a>
      <a class="btn btn-ghost btn-sm" href="${resolveAssetUrl('LICENSE')}" target="_blank" rel="noopener noreferrer">LICENSE</a>
      <a class="btn btn-ghost btn-sm" href="${escapeHtml(LICENSE_URL)}" target="_blank" rel="noopener noreferrer">PolyForm NC ↗</a>
      <a class="btn btn-ghost btn-sm" href="${resolveAssetUrl('NOTICE')}" target="_blank" rel="noopener noreferrer">NOTICE</a>
    </div>`;
  $('#aboutModal')?.classList.remove('hidden');
}
