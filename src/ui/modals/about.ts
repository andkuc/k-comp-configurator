// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// About, Authorship & PolyForm-Noncommercial-1.0.0 License Modal
import {
  APP_VERSION, COPYRIGHT_AUTHOR, COPYRIGHT_YEARS, SPDX_LICENSE,
  LICENSE_URL, CONFIGURATOR_REPO_URL, HARDWARE_REPO_URL, resolveAssetUrl
} from '../../core/constants';
import { $, escapeHtml } from '../../core/state';
import { getActiveBoard } from '../../boards';
import { t } from '../../i18n/index';

export function openAboutModal(): void {
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
