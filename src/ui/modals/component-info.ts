// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Scrollable Student Component Info Modal (SVG Hero, Electrical Principle, Signal Flow, Live Pin Map & Inline API)
import { resolveAssetUrl } from '../../core/constants';
import { state, $, escapeHtml, showToast } from '../../core/state';
import {
  getCompDef, countActiveByCompId, getDisplayLabel,
  getExternalPinClaims, getOnboardPinUsage
} from '../../core/hardware';
import { badgeClass } from '../inspector';
import { getCachedComponentGuides, getCachedLibraryApi, loadComponentGuides, loadLibraryApiData } from '../../catalog/lazy-data';
import { buildComponentApiCardHtml, bindComponentApiCardEvents } from '../api-browser';
import { t, tComp, tCompInfo, getLocale } from '../../i18n/index';
import { getActiveBoard } from '../../boards';

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
  const cachedGuides = getCachedComponentGuides();
  const cachedApi = getCachedLibraryApi();
  if (!cachedGuides || !cachedApi) {
    state.openInfoCompId = def.id;
    void Promise.all([loadComponentGuides(), loadLibraryApiData()]).then(() => {
      if (state.openInfoCompId === def.id) openComponentInfo(def.id);
    });
  }
  const info = tCompInfo(def);
  const lang = getLocale();
  const guide = cachedGuides ? (cachedGuides[def.id] || null) : null;
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

  bodyEl.querySelector('#btnInfoCopyLib')?.addEventListener('click', async (e: any) => {
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
