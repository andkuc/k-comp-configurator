// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Program Workspace View Module (Preview Shell -> v0.5.0 Blockly + CodeMirror 6 over ProgramIR)
import { state, escapeHtml } from '../../core/state';
import type { DerivedWorkspace } from '../../store/bus';
import type { WorkspaceContext, WorkspaceModule } from '../types';

export function createProgramWorkspaceModule(): WorkspaceModule {
  let host: HTMLElement | null = null;
  let context: WorkspaceContext | null = null;

  function render(derived: DerivedWorkspace): void {
    if (!host || !context) return;
    const { t } = context;
    const board = derived.board;
    const modCount = state.active.length;
    const blkCount = (state.codeBlocks || []).length;

    host.innerHTML = `
      <div class="ws-stage-card">
        <div class="ws-stage-head">
          <div>
            <span class="ws-pill-tag">${escapeHtml(t('ws.roadmapTag', { ver: 'v0.5' }))}</span>
            <h2>${escapeHtml(t('ws.programHeading'))}</h2>
            <p>${escapeHtml(t('ws.programDesc'))}</p>
          </div>
          <div class="ws-stage-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-ws-open-code="1">${escapeHtml(t('ws.openCodeNow'))}</button>
            <button type="button" class="btn btn-primary btn-sm" data-ws-return="hardware">← ${escapeHtml(t('ws.backToHardware'))}</button>
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

    host.querySelectorAll<HTMLElement>('[data-ws-return]').forEach((btn) => {
      btn.addEventListener('click', () => {
        void context?.switchWorkspace('hardware');
      });
    });
    host.querySelectorAll<HTMLElement>('[data-ws-open-code]').forEach((btn) => {
      btn.addEventListener('click', () => {
        context?.openHardwareCodeTab();
      });
    });
  }

  return {
    id: 'program',
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
