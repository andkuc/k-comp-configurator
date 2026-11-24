// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Live GitHub docs/ModuleDocumentation PDF Auto-Discovery (andkuc/k-comp)
import { state, hooks, $ } from './state';

const ONBOARD_DOC_SPECS = [
  { id: 'onboard_oled',     keywords: ['oleddisplayssd1306', 'ssd1306'], fallback: 'OLEDDisplay_SSD1306.pdf' },
  { id: 'oled_grid',        keywords: ['oleddisplaygridextension', 'gridextension'], fallback: 'OLEDDisplay_GridExtension.pdf' },
  { id: 'onboard_joystick', keywords: ['joystickky023', 'ky023'], fallback: 'Joystick_KY-023.pdf' },
  { id: 'onboard_led',      keywords: ['led'], exactStem: 'led', fallback: 'LED.pdf' },
  { id: 'onboard_pot',      keywords: ['potentiometer'], fallback: 'Potentiometer.pdf' },
  { id: 'onboard_start',    keywords: ['buttons'], fallback: 'Buttons.pdf' },
  { id: 'onboard_select',   keywords: ['buttons'], fallback: 'Buttons.pdf' },
  { id: 'onboard_buzzer',   keywords: ['buzzer'], fallback: 'Buzzer.pdf' },
  { id: 'onboard_distance', keywords: ['distancesensorhcsr04', 'hcsr04'], fallback: 'DistanceSensor_HC-SR04.pdf' }
];

export function matchComponentDocs(pdfEntries) {
  state.repoDocsMap.clear();
  const blobBase = state.catalog.docsRepoBlobBase || 'https://github.com/andkuc/k-comp/blob/main/';
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const c of state.catalog.components) {
    const keywords = (c.docKeywords || [c.id]).map(norm).filter((k) => k.length >= 2);
    const excludes = (c.docExclude || []).map(norm).filter((k) => k.length >= 2);
    let bestEntry = null;
    let bestScore = 0;

    for (const entry of (pdfEntries || [])) {
      const fname = entry.name || entry.path.split('/').pop() || '';
      const stem = fname.replace(/\.pdf$/i, '');
      const nName = norm(stem);

      if (excludes.some((ex) => nName.includes(ex))) continue;

      let score = 0;
      for (let idx = 0; idx < keywords.length; idx++) {
        const kw = keywords[idx];
        if (!nName.includes(kw)) continue;
        const pos = nName.indexOf(kw);
        const nextCh = nName[pos + kw.length] || '';
        if (/\d$/.test(kw) && /\d/.test(nextCh)) continue;
        score = Math.max(score, (keywords.length - idx) * 20 + kw.length * 2);
      }
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }

    if (bestEntry) {
      const url = bestEntry.html_url || (blobBase + bestEntry.path.split('/').map(encodeURIComponent).join('/'));
      state.repoDocsMap.set(c.id, {
        url,
        filename: bestEntry.name || bestEntry.path.split('/').pop()
      });
    } else if ((!pdfEntries || !pdfEntries.length) && c.knownDocPdf) {
      state.repoDocsMap.set(c.id, {
        url: blobBase + 'docs/ModuleDocumentation/' + encodeURIComponent(c.knownDocPdf),
        filename: c.knownDocPdf
      });
    }
  }

  for (const spec of ONBOARD_DOC_SPECS) {
    let hit = null;
    for (const entry of (pdfEntries || [])) {
      const fname = entry.name || entry.path.split('/').pop() || '';
      const nName = norm(fname.replace(/\.pdf$/i, ''));
      if (spec.exactStem ? nName === spec.exactStem : spec.keywords.some((kw) => nName.includes(kw))) {
        hit = entry;
        break;
      }
    }
    if (hit) {
      const url = hit.html_url || (blobBase + hit.path.split('/').map(encodeURIComponent).join('/'));
      state.repoDocsMap.set(spec.id, { url, filename: hit.name || hit.path.split('/').pop() });
    } else if (spec.fallback) {
      state.repoDocsMap.set(spec.id, {
        url: blobBase + 'docs/ModuleDocumentation/' + encodeURIComponent(spec.fallback),
        filename: spec.fallback
      });
    }
  }
}

export async function discoverRepoDocumentationPdfs() {
  if (!state.catalog || !state.catalog.docsRepoApi) return;
  const cacheKey = 'kcomp_repo_pdfs_v17';
  let pdfEntries = null;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed.entries) && (Date.now() - parsed.ts) < 12 * 3600 * 1000) {
        pdfEntries = parsed.entries;
      }
    }
  } catch (_) {}

  if (!pdfEntries) {
    try {
      const res = await fetch(state.catalog.docsRepoApi, { headers: { Accept: 'application/vnd.github+json' } });
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items)) {
          pdfEntries = items
            .filter((it) => it.type === 'file' && /\.pdf$/i.test(it.name))
            .map((it) => ({ name: it.name, path: it.path, html_url: it.html_url }));
        }
      }
    } catch (_) {}

    if ((!pdfEntries || !pdfEntries.length) && state.catalog.docsRepoTreeApi) {
      try {
        const res = await fetch(state.catalog.docsRepoTreeApi, { headers: { Accept: 'application/vnd.github+json' } });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.tree)) {
            pdfEntries = data.tree
              .filter((n) => n.type === 'blob' && /^docs\/ModuleDocumentation\/.*\.pdf$/i.test(n.path))
              .map((n) => ({ name: n.path.split('/').pop(), path: n.path }));
          }
        }
      } catch (_) {}
    }

    if (pdfEntries && pdfEntries.length) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), entries: pdfEntries }));
      } catch (_) {}
    } else {
      pdfEntries = [];
    }
  }

  matchComponentDocs(pdfEntries);
  state.repoDocsLoaded = true;

  if (state.openInfoCompId && !$('#compInfoModal')?.classList.contains('hidden')) {
    const def = state.catalog.components.find((c) => c.id === state.openInfoCompId);
    if (def) hooks.updateInfoModalDocLink(def);
  }
  if (state.apiDrawerOpen) hooks.recomputeAndRender();
}
