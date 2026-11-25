// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Shield PCB Workspace View Module (Live Mechanical & Netlist Hydration -> v0.6.0 2-Layer Shield Editor)
import { escapeHtml } from '../../core/state';
import type { DerivedWorkspace } from '../../store/bus';
import type { WorkspaceContext, WorkspaceModule } from '../types';

export function createShieldWorkspaceModule(): WorkspaceModule {
  let host: HTMLElement | null = null;
  let context: WorkspaceContext | null = null;

  function render(derived: DerivedWorkspace): void {
    if (!host || !context) return;
    const { t } = context;
    const board = derived.board;
    const net = derived.netlist;
    const mech = board.mechanical;
    const dimsText = mech ? `${mech.widthMm.toFixed(1)} × ${mech.heightMm.toFixed(1)} mm` : '—';
    const hdrText = mech ? `${mech.headers.length}× (${mech.headers.map((h) => `${h.pinCount}p @ ${h.pitchMm}mm`).join(', ')})` : '—';
    const holeText = mech ? `${mech.mountingHoles.length}×` : '0×';
    const keepOutText = mech?.keepOutZones?.length ? `${mech.keepOutZones.length}×` : '0×';

    host.innerHTML = `
      <div class="ws-stage-card">
        <div class="ws-stage-head">
          <div>
            <span class="ws-pill-tag">${escapeHtml(t('ws.roadmapTag', { ver: 'v0.6' }))}</span>
            <h2>${escapeHtml(t('ws.shieldHeading'))}</h2>
            <p>${escapeHtml(t('ws.shieldDesc'))}</p>
          </div>
          <div class="ws-stage-actions">
            <button type="button" class="btn btn-primary btn-sm" data-ws-return="hardware">← ${escapeHtml(t('ws.backToHardware'))}</button>
          </div>
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

    host.querySelectorAll<HTMLElement>('[data-ws-return]').forEach((btn) => {
      btn.addEventListener('click', () => {
        void context?.switchWorkspace('hardware');
      });
    });
  }

  return {
    id: 'shield',
    mount(container: HTMLElement, ctx: WorkspaceContext): void {
      host = container;
      context = ctx;
      render(ctx.getDerived());
    },
    unmount(): void {
      if (host) host.innerHTML = '';
      host = null;
      context = null;
    },
    onProjectChange(derived: DerivedWorkspace): void {
      render(derived);
    },
    onActiveNodeChange(): void {
      if (context) render(context.getDerived());
    }
  };
}
