// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Top-Level Workspace Switcher & Live-Hydrated Future Workspace Preview Panels
import { state, $, escapeHtml } from '../core/state';
import { getActiveBoard } from '../boards';
import { projectStore, type DerivedWorkspace } from '../store';
import { getCompilerProvider, isWebSerialAvailable } from '../services';
import { t } from '../i18n/index';
import {
  DEFAULT_WORKSPACE_ID,
  WORKSPACES,
  detectInitialWorkspaceId,
  isValidWorkspaceId,
  type WorkspaceId
} from './registry';

let activeWorkspaceId: WorkspaceId = DEFAULT_WORKSPACE_ID;

export function getActiveWorkspace(): WorkspaceId {
  return activeWorkspaceId;
}

export function renderWorkspaceSwitcher(): void {
  const slot = $('#workspaceSwitchSlot');
  if (!slot) return;
  slot.innerHTML = WORKSPACES.map((w) => {
    const isActive = w.id === activeWorkspaceId;
    const tagHtml = w.status === 'preview' && w.targetVersion
      ? `<span class="ws-ver-dot" aria-hidden="true"></span>`
      : '';
    return `
      <button type="button"
              class="ws-tab-btn ${isActive ? 'active' : ''} ${w.status === 'preview' ? 'is-preview' : ''}"
              data-ws-id="${w.id}"
              role="tab"
              aria-selected="${String(isActive)}"
              title="${escapeHtml(t(w.titleKey))}">
        <span class="ws-tab-ico" aria-hidden="true">${w.icon}</span>
        <span class="ws-tab-lbl">${escapeHtml(t(w.labelKey))}</span>
        ${tagHtml}
      </button>`;
  }).join('');

  slot.querySelectorAll('[data-ws-id]').forEach((btn: any) => {
    btn.addEventListener('click', () => {
      setActiveWorkspace(btn.dataset.wsId);
    });
  });
}

function buildPreviewPanelHtml(wsId: WorkspaceId, derived: DerivedWorkspace): string {
  const board = derived.board;
  const net = derived.netlist;
  const backBtn = `<button type="button" class="btn btn-primary btn-sm" data-ws-return="hardware">← ${escapeHtml(t('ws.backToHardware'))}</button>`;

  if (wsId === 'program') {
    const modCount = state.active.length;
    const blkCount = (state.codeBlocks || []).length;
    return `
      <div class="ws-stage-card">
        <div class="ws-stage-head">
          <div>
            <span class="ws-pill-tag">${escapeHtml(t('ws.roadmapTag', { ver: 'v0.5' }))}</span>
            <h2>${escapeHtml(t('ws.programHeading'))}</h2>
            <p>${escapeHtml(t('ws.programDesc'))}</p>
          </div>
          <div class="ws-stage-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-ws-open-code="1">${escapeHtml(t('ws.openCodeNow'))}</button>
            ${backBtn}
          </div>
        </div>
        <div class="ws-kpi-grid">
          <div class="ws-kpi"><span class="ws-kpi-lbl">${escapeHtml(t('ws.kpiTargetBoard'))}</span><strong>${escapeHtml(board.name)}</strong></div>
          <div class="ws-kpi"><span class="ws-kpi-lbl">${escapeHtml(t('ws.kpiCodeProfile'))}</span><strong>${escapeHtml(state.codeProfile)}</strong></div>
          <div class="ws-kpi"><span class="ws-kpi-lbl">${escapeHtml(t('ws.kpiActiveModules'))}</span><strong>${modCount} · ${blkCount} ${escapeHtml(t('ws.blocksLabel'))}</strong></div>
          <div class="ws-kpi"><span class="ws-kpi-lbl">Program IR</span><strong>kcomp-ir/1</strong></div>
        </div>
        <div class="ws-feature-grid">
          <div class="ws-feature-box">
            <h3>${escapeHtml(t('ws.progFeat1Title'))}</h3>
            <p>${escapeHtml(t('ws.progFeat1Desc'))}</p>
          </div>
          <div class="ws-feature-box">
            <h3>${escapeHtml(t('ws.progFeat2Title'))}</h3>
            <p>${escapeHtml(t('ws.progFeat2Desc'))}</p>
          </div>
        </div>
      </div>`;
  }

  if (wsId === 'device') {
    const webSerialOk = isWebSerialAvailable();
    const compiler = getCompilerProvider();
    const proto = (board.targetMeta?.flashProtocol || 'none').toUpperCase();
    const baud = board.targetMeta?.defaultBaud || 115200;
    return `
      <div class="ws-stage-card">
        <div class="ws-stage-head">
          <div>
            <span class="ws-pill-tag">${escapeHtml(t('ws.roadmapTag', { ver: 'v0.4' }))}</span>
            <h2>${escapeHtml(t('ws.deviceHeading'))}</h2>
            <p>${escapeHtml(t('ws.deviceDesc'))}</p>
          </div>
          <div class="ws-stage-actions">${backBtn}</div>
        </div>
        <div class="ws-kpi-grid">
          <div class="ws-kpi"><span class="ws-kpi-lbl">Web Serial API</span><strong class="${webSerialOk ? 'is-ok' : 'is-warn'}">${escapeHtml(webSerialOk ? t('ws.statusSupported') : t('ws.statusBrowserNeeded'))}</strong></div>
          <div class="ws-kpi"><span class="ws-kpi-lbl">${escapeHtml(t('ws.kpiFlashProto'))}</span><strong>${escapeHtml(proto)} · ${baud} baud</strong></div>
          <div class="ws-kpi"><span class="ws-kpi-lbl">CompilerProvider</span><strong>${escapeHtml(compiler ? compiler.name : t('ws.compilerUnbound'))}</strong></div>
          <div class="ws-kpi"><span class="ws-kpi-lbl">${escapeHtml(t('ws.kpiUsbBudget'))}</span><strong>~${derived.usbCurrent.total} mA / ${board.electrical.usbMaxMa} mA</strong></div>
        </div>
        <div class="ws-feature-grid">
          <div class="ws-feature-box">
            <h3>${escapeHtml(t('ws.devFeat1Title'))}</h3>
            <p>${escapeHtml(t('ws.devFeat1Desc'))}</p>
          </div>
          <div class="ws-feature-box">
            <h3>${escapeHtml(t('ws.devFeat2Title'))}</h3>
            <p>${escapeHtml(t('ws.devFeat2Desc'))}</p>
          </div>
        </div>
      </div>`;
  }

  // 'shield' — Live mechanical + netlist preview for the future 2-Layer Shield PCB Editor!
  const mech = board.mechanical;
  const dimsText = mech ? `${mech.widthMm.toFixed(1)} × ${mech.heightMm.toFixed(1)} mm` : '—';
  const hdrText = mech ? `${mech.headers.length}× (${mech.headers.map((h) => `${h.pinCount}p @ ${h.pitchMm}mm`).join(', ')})` : '—';
  const holeText = mech ? `${mech.mountingHoles.length}×` : '0×';
  const keepOutText = mech?.keepOutZones?.length ? `${mech.keepOutZones.length}×` : '0×';

  return `
    <div class="ws-stage-card">
      <div class="ws-stage-head">
        <div>
          <span class="ws-pill-tag">${escapeHtml(t('ws.roadmapTag', { ver: 'v0.6' }))}</span>
          <h2>${escapeHtml(t('ws.shieldHeading'))}</h2>
          <p>${escapeHtml(t('ws.shieldDesc'))}</p>
        </div>
        <div class="ws-stage-actions">${backBtn}</div>
      </div>
      <div class="ws-kpi-grid">
        <div class="ws-kpi"><span class="ws-kpi-lbl">${escapeHtml(t('ws.kpiBoardDims'))}</span><strong>${escapeHtml(dimsText)}</strong></div>
        <div class="ws-kpi"><span class="ws-kpi-lbl">${escapeHtml(t('ws.kpiHeaders'))}</span><strong>${escapeHtml(hdrText)}</strong></div>
        <div class="ws-kpi"><span class="ws-kpi-lbl">${escapeHtml(t('ws.kpiNetlist'))}</span><strong>${net.stats.totalNets} Nets · ${net.stats.totalConnections} Wires</strong></div>
        <div class="ws-kpi"><span class="ws-kpi-lbl">${escapeHtml(t('ws.kpiHolesKeepout'))}</span><strong>${escapeHtml(holeText)} / ${escapeHtml(keepOutText)}</strong></div>
      </div>
      <div class="ws-feature-grid">
        <div class="ws-feature-box">
          <h3>${escapeHtml(t('ws.shieldFeat1Title'))}</h3>
          <p>${escapeHtml(t('ws.shieldFeat1Desc'))}</p>
        </div>
        <div class="ws-feature-box">
          <h3>${escapeHtml(t('ws.shieldFeat2Title'))}</h3>
          <p>${escapeHtml(t('ws.shieldFeat2Desc'))}</p>
        </div>
      </div>
    </div>`;
}

export function renderActiveWorkspaceStage(derived?: DerivedWorkspace): void {
  const hwMain = $('#workspace');
  const stage = $('#workspaceStage');
  if (!hwMain || !stage) return;

  const isHardware = activeWorkspaceId === 'hardware';
  hwMain.classList.toggle('hidden', !isHardware);
  stage.classList.toggle('hidden', isHardware);
  document.body.setAttribute('data-workspace', activeWorkspaceId);

  if (isHardware) return;

  const snapshot = derived || projectStore.getDerived();
  stage.innerHTML = buildPreviewPanelHtml(activeWorkspaceId, snapshot);

  stage.querySelectorAll('[data-ws-return]').forEach((btn: any) => {
    btn.addEventListener('click', () => setActiveWorkspace('hardware'));
  });
  stage.querySelectorAll('[data-ws-open-code]').forEach((btn: any) => {
    btn.addEventListener('click', () => {
      setActiveWorkspace('hardware');
      const codeTab = document.querySelector<any>('.itab[data-tab="tabCode"]');
      if (codeTab) codeTab.click();
    });
  });
}

export function setActiveWorkspace(nextId: string): WorkspaceId {
  activeWorkspaceId = isValidWorkspaceId(nextId) ? nextId : DEFAULT_WORKSPACE_ID;
  renderWorkspaceSwitcher();
  renderActiveWorkspaceStage();
  return activeWorkspaceId;
}

export function initWorkspaceShell(): WorkspaceId {
  activeWorkspaceId = detectInitialWorkspaceId();
  renderWorkspaceSwitcher();
  renderActiveWorkspaceStage();
  return activeWorkspaceId;
}
