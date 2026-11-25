// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Interactive Fillable Student Project Charter (Proposal) & Optional Part 2 Evaluation Sheet
import { APP_VERSION, COPYRIGHT_AUTHOR, COPYRIGHT_YEARS, CONFIGURATOR_REPO_URL } from '../core/constants';
import { state, $, escapeHtml, getCleanProjectName, syncProjectNameUI, getActiveOnboardDefs } from '../core/state';
import {
  getCompDef, getDisplayLabel, getExternalPinClaims, getOnboardPinUsage,
  computeDipStates, computeCriticalWarnings, computeUartAssignments
} from '../core/hardware';
import {
  CHARTER_WORK_PACKAGES, computeProposalHours, createEmptyProposal, normalizeProposal
} from '../core/proposal';
import { scheduleAutoSave } from '../core/persistence';
import { getActiveBoard, isBoardCarrierActive } from '../boards';
import { computeLayoutBounds, updateBoardSvgState, renderDockedComponentsAndWires } from './workbench';
import { t, tOnboard, tBlockedPin, getLocale } from '../i18n/index';
import { appBus } from '../store/bus';

function captureCleanDiagramSvg(): string {
  const svg = $('#masterSvg');
  if (!svg) return '';
  const prevFocused = state.focusedId;
  const prevVb = { ...state.vb };
  const dipStates = computeDipStates();

  state.focusedId = null;
  updateBoardSvgState(dipStates);
  renderDockedComponentsAndWires();

  const bounds = computeLayoutBounds();
  svg.setAttribute('viewBox', `${bounds.x.toFixed(1)} ${bounds.y.toFixed(1)} ${bounds.w.toFixed(1)} ${bounds.h.toFixed(1)}`);
  const clone = svg.cloneNode(true);
  clone.removeAttribute('id');
  clone.setAttribute('viewBox', `${bounds.x.toFixed(1)} ${bounds.y.toFixed(1)} ${bounds.w.toFixed(1)} ${bounds.h.toFixed(1)}`);
  clone.querySelectorAll('.kcomp-pin-hit, #kcomp-onboard-hit-layer, #dragOverlayLayer, #pinFlagsLayer, .hw-flash-group, .drag-hover-ring, .comp-rotate-handle, .comp-quick-rotate, .comp-quick-btn, .pin-needs-free, .wire-hit-path').forEach((n) => n.remove());
  const markup = new XMLSerializer().serializeToString(clone);

  state.focusedId = prevFocused;
  state.vb = prevVb;
  appBus.emit('viewport:applyViewBox');
  updateBoardSvgState(dipStates);
  renderDockedComponentsAndWires();
  return markup;
}

function buildLivePinManagementHtml(): string {
  const board = getActiveBoard();
  const extClaims = getExternalPinClaims();
  const obUsage = getOnboardPinUsage();
  const allPins = board.pins;

  const describePin = (bpId: string): { status: 'free' | 'used' | 'reserved'; text: string } => {
    const meta = allPins[bpId];
    const ext = extClaims[bpId];
    const ob = obUsage[bpId];
    if (ext) {
      const inst = state.active.find((i) => i.instanceId === ext.instanceId);
      const def = inst ? getCompDef(inst.compId) : null;
      return { status: 'used', text: `${def ? getDisplayLabel(def) : ext.compName} (${ext.compPinId})` };
    }
    if (ob) {
      const tag = ob.dip ? `S1-${ob.dip}` : (ob.hardwired ? 'HW' : 'ON');
      return { status: 'used', text: `${ob.name} (${tag})` };
    }
    if (meta && meta.blocked) {
      return { status: 'reserved', text: tBlockedPin(bpId, false) || meta.reason || t('charter.pinReserved') };
    }
    return { status: 'free', text: t('charter.pinFree') };
  };

  if (!board.capabilities.hasPinMux) {
    const leftPins = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9'];
    const rightPins = ['D10', 'D11', 'D12', 'D13', 'A0', 'A1', 'A2', 'A3'];
    const rows = leftPins.map((lp, idx) => {
      const rp = rightPins[idx];
      const lInfo = describePin(lp);
      const rInfo = describePin(rp);
      return `
        <tr>
          <td class="ch-pin-id"><strong>${lp}</strong></td>
          <td class="ch-pin-st is-${lInfo.status}">${escapeHtml(lInfo.text)}</td>
          <td class="ch-pin-id"><strong>${rp}</strong></td>
          <td class="ch-pin-st is-${rInfo.status}">${escapeHtml(rInfo.text)}</td>
        </tr>`;
    }).join('');

    const i2cUsers = [
      ...(state.onboard.onboard_oled ? ['OLED (0x3C)'] : []),
      ...state.active
        .filter((i) => getCompDef(i.compId)?.interface === 'I2C')
        .map((i) => {
          const d = getCompDef(i.compId);
          return `${getDisplayLabel(d)}${d?.i2cAddr ? ` (${d.i2cAddr})` : ''}`;
        })
    ];
    const i2cText = i2cUsers.length ? i2cUsers.join(' · ') : t('charter.pinFree');

    return `
      <table class="charter-pin-table">
        <tbody>
          ${rows}
          <tr>
            <td class="ch-pin-id"><strong>A4 / A5</strong></td>
            <td colspan="3" class="ch-pin-st ${i2cUsers.length ? 'is-used' : 'is-free'}"><strong>I²C (SDA/SCL):</strong> ${escapeHtml(i2cText)}</td>
          </tr>
        </tbody>
      </table>`;
  }

  // Generic board (e.g. ESP32-S3 DevKitC-1): show all assigned GPIO & I2C pins in compact 2-column table + free I/O summary
  const carrierActive = isBoardCarrierActive(board, state.carrierEnabled);
  const usedPins: Array<{ id: string; desc: string }> = [];
  for (const [bpId, meta] of Object.entries(allPins)) {
    if (!meta.signalPin) continue;
    if (extClaims[bpId] || obUsage[bpId]) {
      const info = describePin(bpId);
      const hole = carrierActive
        ? Object.entries(state.carrierWireMap || {}).find(([k]) => {
            const [instId, cpId] = k.split('::');
            const inst = state.active.find((a) => a.instanceId === instId);
            return inst && inst.pinMap[cpId] === bpId;
          })?.[1]
        : null;
      const suffix = hole && hole.kind === 'row' ? ` [${hole.label}]` : '';
      usedPins.push({ id: bpId, desc: `${info.text}${suffix}` });
    }
  }
  const i2cUsers = state.active
    .filter((i) => getCompDef(i.compId)?.interface === 'I2C')
    .map((i) => {
      const d = getCompDef(i.compId);
      return `${getDisplayLabel(d)}${d?.i2cAddr ? ` (${d.i2cAddr})` : ''}`;
    });

  const freeCount = Object.entries(allPins)
    .filter(([id, m]) => m.signalPin && !m.blocked && !extClaims[id] && !obUsage[id])
    .length;

  const pairRows: string[] = [];
  for (let i = 0; i < usedPins.length; i += 2) {
    const a = usedPins[i];
    const b = usedPins[i + 1];
    pairRows.push(`
      <tr>
        <td class="ch-pin-id"><strong>${escapeHtml(a.id)}</strong></td>
        <td class="ch-pin-st is-used">${escapeHtml(a.desc)}</td>
        <td class="ch-pin-id">${b ? `<strong>${escapeHtml(b.id)}</strong>` : ''}</td>
        <td class="ch-pin-st ${b ? 'is-used' : 'is-free'}">${b ? escapeHtml(b.desc) : ''}</td>
      </tr>`);
  }

  return `
    <table class="charter-pin-table">
      <tbody>
        ${pairRows.join('')}
        <tr>
          <td class="ch-pin-id"><strong>${escapeHtml(board.defaultI2cPins ? `${board.defaultI2cPins.sda}/${board.defaultI2cPins.scl}` : 'I²C')}</strong></td>
          <td colspan="3" class="ch-pin-st ${i2cUsers.length ? 'is-used' : 'is-free'}"><strong>I²C Bus:</strong> ${escapeHtml(i2cUsers.length ? i2cUsers.join(' · ') : t('charter.pinFree'))} · ${escapeHtml(t('charter.freeIoSummary', { count: freeCount, board: board.shortName }))}</td>
        </tr>
      </tbody>
    </table>`;
}

function buildHoursSummaryHtml(prop: any): string {
  const hrs = computeProposalHours(prop);
  const s1Lbl = (prop.student1 || '').trim() || t('charter.whoS1');
  const s2Lbl = (prop.student2 || '').trim() || t('charter.whoS2');
  const overWarn = hrs.overLimitIndices.length
    ? `<span class="charter-hrs-warn">⚠ ${escapeHtml(t('charter.wpOver10h', { list: hrs.overLimitIndices.map((i) => `#${i + 1}`).join(', ') }))}</span>`
    : '';
  return `
    <span class="charter-hrs-pill"><strong>${escapeHtml(s1Lbl)}:</strong> ${hrs.s1Hours} h</span>
    <span class="charter-hrs-pill"><strong>${escapeHtml(s2Lbl)}:</strong> ${hrs.s2Hours} h</span>
    <span class="charter-hrs-pill"><strong>${escapeHtml(t('charter.whoBoth'))}:</strong> ${hrs.bothHours} h</span>
    <span class="charter-hrs-pill is-total"><strong>${escapeHtml(t('charter.totalHours'))}:</strong> ${hrs.totalTaskHours} h (${hrs.totalPersonHours} P-h)</span>
    ${overWarn}`;
}

function buildPart2GradingHtml(prop: any, todayFallback: string): string {
  const dateVal = (prop.date || '').trim() || todayFallback;
  const rowsTech = [
    ['charter.evalTech1Title', 'charter.evalTech1Desc'],
    ['charter.evalTech2Title', 'charter.evalTech2Desc'],
    ['charter.evalTech3Title', 'charter.evalTech3Desc'],
    ['charter.evalTech4Title', 'charter.evalTech4Desc']
  ];
  const rowsProc = [
    ['charter.evalProc1Title', 'charter.evalProc1Desc'],
    ['charter.evalProc2Title', 'charter.evalProc2Desc'],
    ['charter.evalProc3Title', 'charter.evalProc3Desc']
  ];
  const rowsProd = [
    ['charter.evalProd1Title', 'charter.evalProd1Desc'],
    ['charter.evalProd2Title', 'charter.evalProd2Desc'],
    ['charter.evalProd3Title', 'charter.evalProd3Desc']
  ];

  const renderSection = (titleKey: string, items: string[][]) => `
    <h4 class="print-sec-title">${escapeHtml(t(titleKey))}</h4>
    <table class="print-table charter-eval-table">
      <thead>
        <tr>
          <th>${escapeHtml(t('charter.evalColCriteria'))}</th>
          <th style="width:86px;text-align:center">${escapeHtml(t('charter.evalColRating'))}</th>
          <th style="width:32%">${escapeHtml(t('charter.evalColNotes'))}</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(([tk, dk]) => `
          <tr>
            <td><strong>${escapeHtml(t(tk))}:</strong> ${escapeHtml(t(dk))}</td>
            <td style="text-align:center;font-family:var(--mono);color:#64748b;">___ / 10</td>
            <td></td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  return `
    <div id="charterPart2Box" class="charter-part2 ${prop.includeGrading ? '' : 'hidden'}">
      <div class="charter-banner is-eval">
        <div class="charter-banner-badge">P2</div>
        <div>
          <h3>${escapeHtml(t('charter.part2Title'))}</h3>
          <p>${escapeHtml(t('charter.part2Sub'))}</p>
        </div>
      </div>

      <div class="charter-meta-summary">
        <div><strong>${escapeHtml(t('charter.lblSchoolYear'))}:</strong> <span data-p2-sync="schoolYear">${escapeHtml(prop.schoolYear || '—')}</span></div>
        <div><strong>${escapeHtml(t('charter.lblClass'))}:</strong> <span data-p2-sync="className">${escapeHtml(prop.className || '—')}</span></div>
        <div><strong>${escapeHtml(t('charter.lblTeam'))}:</strong> <span data-p2-sync="teamName">${escapeHtml(prop.teamName || '—')}</span></div>
        <div><strong>${escapeHtml(t('charter.lblDate'))}:</strong> <span data-p2-sync="date">${escapeHtml(dateVal)}</span></div>
        <div><strong>${escapeHtml(t('charter.lblStudent1'))}:</strong> <span data-p2-sync="student1">${escapeHtml(prop.student1 || '—')}</span></div>
        <div><strong>${escapeHtml(t('charter.lblStudent2'))}:</strong> <span data-p2-sync="student2">${escapeHtml(prop.student2 || '—')}</span></div>
      </div>

      ${renderSection('charter.evalSecTech', rowsTech)}
      ${renderSection('charter.evalSecProc', rowsProc)}
      ${renderSection('charter.evalSecProd', rowsProd)}

      <div class="charter-grade-footer">
        <div class="charter-grade-box">${escapeHtml(t('charter.evalTotalScore'))}: <strong>_______ / 100</strong></div>
        <div class="charter-grade-box">${escapeHtml(t('charter.evalGrade'))}: <strong>___________</strong></div>
      </div>
    </div>`;
}

export function openProjectCharter() {
  state.printModalTab = 'charter';
  state.proposal = normalizeProposal(state.proposal);
  const prop = state.proposal;
  const board = getActiveBoard();
  const carrierActive = isBoardCarrierActive(board, state.carrierEnabled);
  const dipStates = computeDipStates();
  const warnings = computeCriticalWarnings();
  const uartAssigns = computeUartAssignments();
  const svgMarkup = captureCleanDiagramSvg();
  const today = new Date().toLocaleDateString(getLocale() === 'de' ? 'de-AT' : (getLocale() === 'sq' ? 'sq-AL' : undefined));

  // Sync modal header & tabs
  const heading = $('#printModalHeading');
  const subtitle = $('#printModalSubtitle');
  if (heading) heading.textContent = t('charter.modalTitle');
  if (subtitle) subtitle.textContent = t('charter.modalSubtitle');
  $('#btnPrintTabLab')?.classList.remove('active');
  $('#btnPrintTabCharter')?.classList.add('active');
  $('#btnPrintShareLink')?.classList.remove('hidden');

  // Onboard components checklist (auto-synced from active board)
  const dipById: Record<number, any> = {};
  dipStates.forEach((d) => { dipById[d.id] = d; });
  const onboardDefs = getActiveOnboardDefs();
  const onboardChipsHtml = onboardDefs.map((ob) => {
    const dip = ob.dip ? dipById[ob.dip] : null;
    const isOn = dip ? dip.on : !!state.onboard[ob.id];
    const lbl = tOnboard(ob, 'name');
    return `<span class="charter-ob-chip ${isOn ? 'is-on' : ''}"><span class="ch-chk">${isOn ? '☑' : '☐'}</span> ${escapeHtml(lbl)}</span>`;
  }).join('');

  // External components summary (scope advisory if > 3 modules)
  const extCardsHtml = state.active.length
    ? state.active.map((inst, idx) => {
        const def = getCompDef(inst.compId);
        if (!def) return '';
        const uInfo = uartAssigns[inst.instanceId];
        const sigStr = uInfo
          ? `${def.interface} (${uInfo.badgeLabel})`
          : (def.i2cAddr ? `${def.interface} (${def.i2cAddr})` : def.interface);
        return `
          <div class="charter-ext-card">
            <div class="charter-ext-head"><strong>#${idx + 1} ${escapeHtml(getDisplayLabel(def))}</strong></div>
            <div><small>${escapeHtml(t('charter.extModel'))}:</small> ${escapeHtml(def.name)}</div>
            <div><small>${escapeHtml(t('charter.extVoltage'))}:</small> ${escapeHtml(def.voltage || '—')}</div>
            <div><small>${escapeHtml(t('charter.extSignal'))}:</small> ${escapeHtml(sigStr)}</div>
          </div>`;
      }).join('')
    : `<div class="charter-empty-note">${escapeHtml(t('charter.noExternal'))}</div>`;

  const critWarns = warnings.filter((w) => w.critical);
  const scopeAlerts: string[] = [];
  if (state.active.length > 3) {
    scopeAlerts.push(t('charter.scopeWarnTooMany', { count: state.active.length }));
  }
  for (const w of critWarns) scopeAlerts.push(w.text);

  // Sprint Work Packages (8 predefined tasks across 3 phases)
  const s1OptLabel = (prop.student1 || '').trim() ? `S1: ${prop.student1.trim()}` : t('charter.whoS1');
  const s2OptLabel = (prop.student2 || '').trim() ? `S2: ${prop.student2.trim()}` : t('charter.whoS2');

  const phaseRowspans: Record<number, { key: string; span: number }> = {
    0: { key: 'charter.phaseSetup', span: 4 },
    4: { key: 'charter.phaseMerge', span: 2 },
    6: { key: 'charter.phaseFinals', span: 2 }
  };

  const wpRowsHtml = CHARTER_WORK_PACKAGES.map((tpl, idx) => {
    const wp = prop.workPackages[idx] || { goal: '', hours: '', who: tpl.defaultWho };
    const phaseCell = phaseRowspans[idx]
      ? `<td class="ch-phase-cell" rowspan="${phaseRowspans[idx].span}">${escapeHtml(t(phaseRowspans[idx].key))}</td>`
      : '';
    const whoPrint = wp.who === 'S1'
      ? ((prop.student1 || '').trim() || t('charter.whoS1'))
      : (wp.who === 'S2' ? ((prop.student2 || '').trim() || t('charter.whoS2')) : t('charter.whoBoth'));
    return `
      <tr>
        ${phaseCell}
        <td style="text-align:center;font-weight:700;">${tpl.id}</td>
        <td>${escapeHtml(t(tpl.taskKey))}</td>
        <td>
          <input type="text" class="charter-input charter-edit-ctrl" data-wp-idx="${idx}" data-wp-field="goal"
                 value="${escapeHtml(wp.goal)}" placeholder="${escapeHtml(t(tpl.goalPlaceholderKey))}" maxlength="240" />
          <span class="charter-print-val" data-wp-print="${idx}:goal">${escapeHtml(wp.goal || '—')}</span>
        </td>
        <td style="width:68px;">
          <input type="number" min="0" max="40" step="0.5" class="charter-input charter-hrs-inp charter-edit-ctrl"
                 data-wp-idx="${idx}" data-wp-field="hours" value="${escapeHtml(wp.hours)}" placeholder="h" />
          <span class="charter-print-val" data-wp-print="${idx}:hours">${escapeHtml(wp.hours ? `${wp.hours} h` : '___ h')}</span>
        </td>
        <td style="width:108px;">
          <select class="charter-select charter-edit-ctrl" data-wp-idx="${idx}" data-wp-field="who">
            <option value="S1"${wp.who === 'S1' ? ' selected' : ''}>${escapeHtml(s1OptLabel)}</option>
            <option value="S2"${wp.who === 'S2' ? ' selected' : ''}>${escapeHtml(s2OptLabel)}</option>
            <option value="BOTH"${wp.who === 'BOTH' ? ' selected' : ''}>${escapeHtml(t('charter.whoBoth'))}</option>
          </select>
          <span class="charter-print-val" data-wp-print="${idx}:who">${escapeHtml(whoPrint)}</span>
        </td>
      </tr>`;
  }).join('');

  const sheet = $('#printSheet');
  if (!sheet) return;
  sheet.innerHTML = `
    <div class="charter-sheet">
      <!-- Interactive toolbar (hidden on print) -->
      <div class="charter-toolbar no-print">
        <div class="charter-toolbar-info">
          <span>📝 ${escapeHtml(t('charter.editHint'))}</span>
        </div>
        <div class="charter-toolbar-actions">
          <label class="charter-check-toggle">
            <input type="checkbox" id="chkCharterPart2" ${prop.includeGrading ? 'checked' : ''} />
            <span>${escapeHtml(t('charter.includePart2'))}</span>
          </label>
          <button type="button" id="btnCharterReset" class="btn btn-ghost btn-sm">${escapeHtml(t('charter.btnResetFields'))}</button>
        </div>
      </div>

      <!-- PART 1 HEADER -->
      <div class="charter-banner">
        <div class="charter-banner-badge">P1</div>
        <div>
          <h3>${escapeHtml(t('charter.part1Title'))}</h3>
          <p>${escapeHtml(t('charter.part1Sub'))}</p>
        </div>
      </div>

      <!-- 1. GENERAL INFORMATION -->
      <div>
        <h4 class="print-sec-title">${escapeHtml(t('charter.secGeneral'))}</h4>
        <div class="charter-form-grid">
          <label class="charter-field">
            <span>${escapeHtml(t('charter.lblSchoolYear'))}</span>
            <input type="text" class="charter-input charter-edit-ctrl" data-ch-field="schoolYear" value="${escapeHtml(prop.schoolYear)}" placeholder="2026/27" maxlength="20" />
            <span class="charter-print-val" data-ch-print="schoolYear">${escapeHtml(prop.schoolYear || '—')}</span>
          </label>
          <label class="charter-field">
            <span>${escapeHtml(t('charter.lblClass'))}</span>
            <input type="text" class="charter-input charter-edit-ctrl" data-ch-field="className" value="${escapeHtml(prop.className)}" placeholder="${escapeHtml(t('charter.phClass'))}" maxlength="32" />
            <span class="charter-print-val" data-ch-print="className">${escapeHtml(prop.className || '_______________')}</span>
          </label>
          <label class="charter-field">
            <span>${escapeHtml(t('charter.lblStudent1'))}</span>
            <input type="text" class="charter-input charter-edit-ctrl" data-ch-field="student1" value="${escapeHtml(prop.student1)}" placeholder="${escapeHtml(t('charter.phStudent1'))}" maxlength="64" />
            <span class="charter-print-val" data-ch-print="student1">${escapeHtml(prop.student1 || '_______________________')}</span>
          </label>
          <label class="charter-field">
            <span>${escapeHtml(t('charter.lblTeam'))}</span>
            <input type="text" class="charter-input charter-edit-ctrl" data-ch-field="teamName" value="${escapeHtml(prop.teamName)}" placeholder="${escapeHtml(t('charter.phTeam'))}" maxlength="64" />
            <span class="charter-print-val" data-ch-print="teamName">${escapeHtml(prop.teamName || '_______________________')}</span>
          </label>
          <label class="charter-field">
            <span>${escapeHtml(t('charter.lblDate'))}</span>
            <input type="text" class="charter-input charter-edit-ctrl" data-ch-field="date" value="${escapeHtml(prop.date || today)}" placeholder="${escapeHtml(today)}" maxlength="32" />
            <span class="charter-print-val" data-ch-print="date">${escapeHtml(prop.date || today)}</span>
          </label>
          <label class="charter-field">
            <span>${escapeHtml(t('charter.lblStudent2'))}</span>
            <input type="text" class="charter-input charter-edit-ctrl" data-ch-field="student2" value="${escapeHtml(prop.student2)}" placeholder="${escapeHtml(t('charter.phStudent2'))}" maxlength="64" />
            <span class="charter-print-val" data-ch-print="student2">${escapeHtml(prop.student2 || '_______________________')}</span>
          </label>
        </div>
      </div>

      <!-- 2. THE CONCEPT (THE PITCH) -->
      <div>
        <h4 class="print-sec-title">${escapeHtml(t('charter.secConcept'))}</h4>
        <div class="charter-concept-stack">
          <label class="charter-field">
            <span>${escapeHtml(t('charter.lblProjectName'))}</span>
            <input type="text" class="charter-input charter-edit-ctrl" id="charterProjectNameInput" value="${escapeHtml(getCleanProjectName())}" placeholder="${escapeHtml(t('topbar.projectPlaceholder'))}" maxlength="60" />
            <span class="charter-print-val" id="charterProjectNamePrint">${escapeHtml(getCleanProjectName() || t('print.kpiUntitled'))}</span>
          </label>
          <label class="charter-field">
            <span>${escapeHtml(t('charter.lblSlogan'))}</span>
            <input type="text" class="charter-input charter-edit-ctrl" data-ch-field="slogan" value="${escapeHtml(prop.slogan)}" placeholder="${escapeHtml(t('charter.phSlogan'))}" maxlength="240" />
            <span class="charter-print-val" data-ch-print="slogan">${escapeHtml(prop.slogan || '—')}</span>
          </label>
          <label class="charter-field">
            <span>${escapeHtml(t('charter.lblUserStories'))} <small class="charter-field-hint">${escapeHtml(t('charter.hintUserStories'))}</small></span>
            <textarea class="charter-textarea charter-edit-ctrl" rows="3" data-ch-field="userStories" placeholder="${escapeHtml(t('charter.phUserStories'))}" maxlength="2000">${escapeHtml(prop.userStories)}</textarea>
            <div class="charter-print-val is-multiline" data-ch-print="userStories">${escapeHtml(prop.userStories || '—')}</div>
          </label>
          <label class="charter-field">
            <span>${escapeHtml(t('charter.lblScope'))} <small class="charter-field-hint">${escapeHtml(t('charter.hintScope'))}</small></span>
            <textarea class="charter-textarea charter-edit-ctrl" rows="3" data-ch-field="functionalScope" placeholder="${escapeHtml(t('charter.phScope'))}" maxlength="2000">${escapeHtml(prop.functionalScope)}</textarea>
            <div class="charter-print-val is-multiline" data-ch-print="functionalScope">${escapeHtml(prop.functionalScope || '—')}</div>
          </label>
        </div>
      </div>

      <!-- 3. HARDWARE ARCHITECTURE & PIN MANAGEMENT (AUTO-SYNCED FROM LIVE BOARD) -->
      <div>
        <h4 class="print-sec-title">${escapeHtml(t('charter.secHardware', { board: board.name }))}${carrierActive ? ' · Breadboard' : ''}</h4>
        ${scopeAlerts.length ? `
          <div class="print-warn-box">
            <strong>${escapeHtml(t('charter.scopeAlertsTitle'))}</strong>
            <ul>${scopeAlerts.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
          </div>` : ''}

        <div class="charter-sub-lbl">${escapeHtml(t('charter.lblOnboardUsed'))}</div>
        <div class="charter-ob-grid">${onboardChipsHtml}</div>

        <div class="charter-sub-lbl">${escapeHtml(t('charter.lblExternalUsed', { count: state.active.length }))}</div>
        <div class="charter-ext-grid">${extCardsHtml}</div>

        ${svgMarkup ? `<div class="print-svg-box charter-svg-box">${svgMarkup}</div>` : ''}

        <div class="charter-sub-lbl">${escapeHtml(t('charter.lblPinMgmt'))}</div>
        ${buildLivePinManagementHtml()}

        <label class="charter-field" style="margin-top:8px;">
          <span>${escapeHtml(t('charter.lblBoardMods'))}</span>
          <textarea class="charter-textarea charter-edit-ctrl" rows="2" data-ch-field="boardMods" placeholder="${escapeHtml(t('charter.phBoardMods'))}" maxlength="1000">${escapeHtml(prop.boardMods)}</textarea>
          <div class="charter-print-val is-multiline" data-ch-print="boardMods">${escapeHtml(prop.boardMods || '—')}</div>
        </label>
      </div>

      <!-- 4. IMPLEMENTATION PLAN (THE SPRINT) -->
      <div>
        <h4 class="print-sec-title">${escapeHtml(t('charter.secSprint'))}</h4>
        <table class="print-table charter-wp-table">
          <thead>
            <tr>
              <th style="width:76px">${escapeHtml(t('charter.wpColPhase'))}</th>
              <th style="width:28px;text-align:center">#</th>
              <th style="width:28%">${escapeHtml(t('charter.wpColTask'))}</th>
              <th>${escapeHtml(t('charter.wpColGoal'))}</th>
              <th style="width:68px">${escapeHtml(t('charter.wpColHours'))}</th>
              <th style="width:108px">${escapeHtml(t('charter.wpColWho'))}</th>
            </tr>
          </thead>
          <tbody>${wpRowsHtml}</tbody>
        </table>
        <div id="charterHoursSummary" class="charter-hours-summary">${buildHoursSummaryHtml(prop)}</div>
      </div>

      <!-- 5. DEFINITION OF DONE & TEACHER APPROVAL -->
      <div>
        <h4 class="print-sec-title">${escapeHtml(t('charter.secDod'))}</h4>
        <ul class="charter-dod-list">
          <li>☐ ${escapeHtml(t('charter.dod1'))}</li>
          <li>☐ ${escapeHtml(t('charter.dod2'))}</li>
          <li>☐ ${escapeHtml(t('charter.dod3'))}</li>
          <li>☐ ${escapeHtml(t('charter.dod4'))}</li>
        </ul>

        <div class="charter-approval-box">
          <div class="charter-approval-head"><strong>${escapeHtml(t('charter.approvalTitle'))}</strong></div>
          <div class="charter-approval-opts">
            <span>☐ ${escapeHtml(t('charter.approvalOk'))}</span>
            <span>☐ ${escapeHtml(t('charter.approvalRevise'))}</span>
            <span>☐ ${escapeHtml(t('charter.approvalSimple'))}</span>
            <span>☐ ${escapeHtml(t('charter.approvalComplex'))}</span>
          </div>
          <div class="charter-teacher-sig">${escapeHtml(t('charter.approvalTeacherSig'))}: ________________________________________</div>
          <div class="charter-risk-note">${escapeHtml(t('charter.approvalRiskNote'))}</div>
          <div class="charter-student-sigs">
            <div>${escapeHtml(t('charter.sigStudent1'))}: ___________________________</div>
            <div>${escapeHtml(t('charter.sigStudent2'))}: ___________________________</div>
          </div>
        </div>
      </div>

      <!-- OPTIONAL PART 2: EVALUATION & GRADING (100 PTS) -->
      ${buildPart2GradingHtml(prop, today)}

      <div class="print-copyright-foot">
        <span>K-Comp Configurator v${escapeHtml(APP_VERSION)} · © ${escapeHtml(COPYRIGHT_YEARS)} ${escapeHtml(COPYRIGHT_AUTHOR)}</span>
        <span>${escapeHtml(CONFIGURATOR_REPO_URL.replace('https://', ''))}</span>
      </div>
    </div>`;

  // Bind live reactive inputs (update state.proposal, print mirrors, Part 2 mirrors, hours summary, and auto-save!)
  const updateWhoLabels = () => {
    const s1 = (state.proposal.student1 || '').trim() ? `S1: ${state.proposal.student1.trim()}` : t('charter.whoS1');
    const s2 = (state.proposal.student2 || '').trim() ? `S2: ${state.proposal.student2.trim()}` : t('charter.whoS2');
    sheet.querySelectorAll('[data-wp-field="who"]').forEach((sel: any) => {
      const idx = parseInt(sel.dataset.wpIdx, 10);
      if (sel.options[0]) sel.options[0].textContent = s1;
      if (sel.options[1]) sel.options[1].textContent = s2;
      const wp = state.proposal.workPackages[idx];
      const pr = sheet.querySelector(`[data-wp-print="${idx}:who"]`);
      if (pr && wp) {
        pr.textContent = wp.who === 'S1'
          ? ((state.proposal.student1 || '').trim() || t('charter.whoS1'))
          : (wp.who === 'S2' ? ((state.proposal.student2 || '').trim() || t('charter.whoS2')) : t('charter.whoBoth'));
      }
    });
  };

  const refreshHours = () => {
    const box = sheet.querySelector('#charterHoursSummary');
    if (box) box.innerHTML = buildHoursSummaryHtml(state.proposal);
  };

  const projNameInp = sheet.querySelector('#charterProjectNameInput');
  projNameInp?.addEventListener('input', (e: any) => {
    state.projectName = e.target.value;
    syncProjectNameUI();
    const pr = sheet.querySelector('#charterProjectNamePrint');
    if (pr) pr.textContent = getCleanProjectName() || t('print.kpiUntitled');
    scheduleAutoSave();
  });

  sheet.querySelectorAll('[data-ch-field]').forEach((el: any) => {
    el.addEventListener('input', (e: any) => {
      const field = el.dataset.chField;
      const val = e.target.value;
      (state.proposal as any)[field] = val;
      const pr = sheet.querySelector(`[data-ch-print="${field}"]`);
      if (pr) pr.textContent = val.trim() ? val : '—';
      const p2 = sheet.querySelector(`[data-p2-sync="${field}"]`);
      if (p2) p2.textContent = val.trim() ? val : '—';
      if (field === 'student1' || field === 'student2') {
        updateWhoLabels();
        refreshHours();
      }
      scheduleAutoSave();
    });
  });

  sheet.querySelectorAll('[data-wp-idx]').forEach((el: any) => {
    const evtName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evtName, (e: any) => {
      const idx = parseInt(el.dataset.wpIdx, 10);
      const field = el.dataset.wpField;
      const val = e.target.value;
      if (!state.proposal.workPackages[idx]) return;
      (state.proposal.workPackages[idx] as any)[field] = val;
      const pr = sheet.querySelector(`[data-wp-print="${idx}:${field}"]`);
      if (pr) {
        if (field === 'hours') pr.textContent = val ? `${val} h` : '___ h';
        else if (field === 'who') {
          pr.textContent = val === 'S1'
            ? ((state.proposal.student1 || '').trim() || t('charter.whoS1'))
            : (val === 'S2' ? ((state.proposal.student2 || '').trim() || t('charter.whoS2')) : t('charter.whoBoth'));
        } else {
          pr.textContent = val.trim() ? val : '—';
        }
      }
      if (field === 'hours' || field === 'who') refreshHours();
      scheduleAutoSave();
    });
  });

  sheet.querySelector('#chkCharterPart2')?.addEventListener('change', (e: any) => {
    state.proposal.includeGrading = !!e.target.checked;
    const p2Box = sheet.querySelector('#charterPart2Box');
    if (p2Box) p2Box.classList.toggle('hidden', !state.proposal.includeGrading);
    scheduleAutoSave();
  });

  sheet.querySelector('#btnCharterReset')?.addEventListener('click', () => {
    appBus.emit('history:push');
    state.proposal = createEmptyProposal();
    scheduleAutoSave();
    openProjectCharter();
  });

  $('#printModal')?.classList.remove('hidden');
}
