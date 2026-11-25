// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Inkscape-Safe Master SVG Export (Zero <filter>, UI Handles Stripped, RDF Authorship Metadata)
import { COPYRIGHT_AUTHOR, COPYRIGHT_NOTICE, CONFIGURATOR_REPO_URL } from '../../core/constants';
import { state, $, escapeHtml, getCleanProjectName, getProjectSlug, showToast } from '../../core/state';
import { computeDipStates } from '../../core/hardware';
import { getActiveBoard } from '../../boards';
import { t } from '../../i18n/index';
import { applyViewBox, computeLayoutBounds } from './layout';
import { setHwHover, updateBoardSvgState } from './board-layer';
import { setHoveredNet } from './wire-layer';
import { renderDockedComponentsAndWires } from './component-cards';

export function exportMasterSvg() {
  const svg = $('#masterSvg');
  const prevFocused = state.focusedId;
  const prevVb = { ...state.vb };

  setHoveredNet(null);
  setHwHover(null);
  state.focusedId = null;
  const dipStates = computeDipStates();
  updateBoardSvgState(dipStates);
  renderDockedComponentsAndWires();

  const bounds = computeLayoutBounds();
  svg.setAttribute('viewBox', `${bounds.x.toFixed(1)} ${bounds.y.toFixed(1)} ${bounds.w.toFixed(1)} ${bounds.h.toFixed(1)}`);

  const clone = svg.cloneNode(true);
  clone.setAttribute('width', String(Math.round(bounds.w)));
  clone.setAttribute('height', String(Math.round(bounds.h)));
  clone.querySelectorAll('.kcomp-pin-hit, #kcomp-onboard-hit-layer, #dragOverlayLayer, #pinFlagsLayer, .hw-flash-group, .drag-hover-ring, .comp-rotate-handle, .comp-quick-rotate, .comp-quick-btn, .pin-needs-free, .opt-pin-pad, .wire-hit-path').forEach((n) => n.remove());

  // Inject Inkscape-safe Dublin Core / RDF authorship metadata (zero <filter> tags)
  const boardTitle = getActiveBoard().shortName;
  const titleText = escapeHtml(getCleanProjectName() ? `${getCleanProjectName()} — ${boardTitle} Wiring` : `${boardTitle} Wiring Diagram`);
  const metaDoc = new DOMParser().parseFromString(
    `<metadata xmlns="http://www.w3.org/2000/svg" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#">` +
    `<rdf:RDF><cc:Work rdf:about="">` +
    `<dc:format>image/svg+xml</dc:format>` +
    `<dc:title>${titleText}</dc:title>` +
    `<dc:creator><cc:Agent><dc:title>${escapeHtml(COPYRIGHT_AUTHOR)}</dc:title></cc:Agent></dc:creator>` +
    `<dc:rights><cc:Agent><dc:title>${escapeHtml(COPYRIGHT_NOTICE)}</dc:title></cc:Agent></dc:rights>` +
    `<dc:source>${escapeHtml(CONFIGURATOR_REPO_URL)}</dc:source>` +
    `<cc:license rdf:resource="https://polyformproject.org/licenses/noncommercial/1.0.0/" />` +
    `</cc:Work></rdf:RDF></metadata>`,
    'image/svg+xml'
  );
  if (metaDoc.documentElement && metaDoc.documentElement.localName === 'metadata') {
    clone.insertBefore(document.importNode(metaDoc.documentElement, true), clone.firstChild);
  }

  const serialized = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- SPDX-FileCopyrightText: 2025-2026 Andreas Kucher | SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->\n' + new XMLSerializer().serializeToString(clone);

  state.focusedId = prevFocused;
  state.vb = prevVb;
  applyViewBox();
  updateBoardSvgState(dipStates);
  renderDockedComponentsAndWires();

  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getProjectSlug(getActiveBoard().id)}-wiring.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
