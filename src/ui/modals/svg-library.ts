// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Standalone Inkscape-Safe SVG Library Gallery Modal
import { resolveAssetUrl } from '../../core/constants';
import { state, $, escapeHtml } from '../../core/state';
import { listBoards } from '../../boards';
import { t } from '../../i18n/index';

export function openSvgLibrary(): void {
  const boardItems = listBoards().map((b) => ({
    id: b.id,
    name: b.id === 'kcomp-v2' ? t('svgLib.boardName') : b.name,
    file: b.svgAsset
  }));
  const compItems = (state.catalog?.components || []).map((c) => ({
    id: c.id,
    name: c.name,
    file: c.svgFile
  }));
  const items = [...boardItems, ...compItems];
  const gallery = $('#svgGallery');
  if (gallery) {
    gallery.innerHTML = items.map((it) => `
      <div class="gallery-tile">
        <img src="${resolveAssetUrl(it.file)}" alt="${escapeHtml(it.name)}" loading="lazy" />
        <strong>${escapeHtml(it.name)}</strong>
        <a href="${resolveAssetUrl(it.file)}" download="${it.id}.svg">⬇ ${it.id}.svg</a>
      </div>`).join('');
  }
  $('#svgModal')?.classList.remove('hidden');
}
