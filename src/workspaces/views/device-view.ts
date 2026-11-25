// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Device Workspace View Module (Preview Shell -> v0.4.0 Web Serial Monitor, Plotter, Flasher & CompilerProvider)
import { escapeHtml } from '../../core/state';
import { getCompilerProvider, isWebSerialAvailable } from '../../services';
import type { DerivedWorkspace } from '../../store/bus';
import type { WorkspaceContext, WorkspaceModule } from '../types';

export function createDeviceWorkspaceModule(): WorkspaceModule {
  let host: HTMLElement | null = null;
  let context: WorkspaceContext | null = null;

  function render(derived: DerivedWorkspace): void {
    if (!host || !context) return;
    const { t } = context;
    const board = derived.board;
    const webSerialOk = isWebSerialAvailable();
    const compiler = getCompilerProvider();
    const proto = (board.targetMeta?.flashProtocol || 'none').toUpperCase();
    const baud = board.targetMeta?.defaultBaud || 115200;

    host.innerHTML = `
      <div class="ws-stage-card">
        <div class="ws-stage-head">
          <div>
            <span class="ws-pill-tag">${escapeHtml(t('ws.roadmapTag', { ver: 'v0.4' }))}</span>
            <h2>${escapeHtml(t('ws.deviceHeading'))}</h2>
            <p>${escapeHtml(t('ws.deviceDesc'))}</p>
          </div>
          <div class="ws-stage-actions">
            <button type="button" class="btn btn-primary btn-sm" data-ws-return="hardware">← ${escapeHtml(t('ws.backToHardware'))}</button>
          </div>
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

    host.querySelectorAll<HTMLElement>('[data-ws-return]').forEach((btn) => {
      btn.addEventListener('click', () => {
        void context?.switchWorkspace('hardware');
      });
    });
  }

  return {
    id: 'device',
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
