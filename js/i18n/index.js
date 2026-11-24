// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Extensible Internationalization (i18n) Registry
// Default language: English (en)
// To add a future language (e.g., sl, hr, fr, it):
//   1. Create js/i18n/<lang>.js (plus optional <lang>-components.js)
//   2. Import it below and call registerLocale(<lang>)
import en from './en.js?v=0.1.0';
import de from './de.js?v=0.1.0';
import sq from './sq.js?v=0.1.0';

const STORAGE_KEY = 'kcomp_lang';
const FALLBACK_LOCALE = 'en';

const registry = new Map();
const listeners = new Set();
let currentCode = FALLBACK_LOCALE;
let outsideClickBound = false;

export function registerLocale(localeDef) {
  if (!localeDef || !localeDef.code) return;
  registry.set(localeDef.code.toLowerCase(), localeDef);
}

registerLocale(en);
registerLocale(de);
registerLocale(sq);

export function getAvailableLocales() {
  return Array.from(registry.values());
}

export function getLocale() {
  return currentCode;
}

export function getLocaleDef(code = currentCode) {
  return registry.get(code) || registry.get(FALLBACK_LOCALE);
}

export function detectInitialLocale() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = (params.get('lang') || '').toLowerCase();
    if (fromUrl && registry.has(fromUrl)) return fromUrl;
  } catch (_) {}

  try {
    const stored = (localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
    if (stored && registry.has(stored)) return stored;
  } catch (_) {}

  return FALLBACK_LOCALE;
}

export function initI18n() {
  currentCode = detectInitialLocale();
  syncDocumentLang();
  return currentCode;
}

function syncDocumentLang() {
  const def = getLocaleDef();
  document.documentElement.lang = def.code;
  document.documentElement.dir = def.dir || 'ltr';
}

export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLocale(code, notify = true) {
  const norm = String(code || '').toLowerCase();
  if (!registry.has(norm)) return false;
  if (norm === currentCode) return false;
  currentCode = norm;
  try { localStorage.setItem(STORAGE_KEY, norm); } catch (_) {}
  syncDocumentLang();
  applyI18nToDom();
  if (notify) {
    for (const fn of listeners) fn(currentCode, getLocaleDef());
  }
  return true;
}

export function t(key, params = null) {
  const active = getLocaleDef(currentCode);
  const fallback = registry.get(FALLBACK_LOCALE);
  let raw = (active && active.strings && active.strings[key] !== undefined)
    ? active.strings[key]
    : (fallback && fallback.strings && fallback.strings[key] !== undefined ? fallback.strings[key] : key);

  if (params && typeof raw === 'string') {
    for (const [k, v] of Object.entries(params)) {
      raw = raw.replaceAll(`{${k}}`, String(v ?? ''));
    }
  }
  return raw;
}

export function tComp(def, field) {
  if (!def) return '';
  if (def.i18n && def.i18n[currentCode] && def.i18n[currentCode][field] !== undefined) {
    return def.i18n[currentCode][field];
  }
  const active = getLocaleDef(currentCode);
  if (active && active.components && active.components[def.id] && active.components[def.id][field] !== undefined) {
    return active.components[def.id][field];
  }
  return def[field] || '';
}

export function tCompInfo(def) {
  if (!def) return {};
  const base = def.studentInfo || {};
  const inline = (def.i18n && def.i18n[currentCode] && def.i18n[currentCode].studentInfo) || {};
  const active = getLocaleDef(currentCode);
  const dictInfo = (active && active.components && active.components[def.id] && active.components[def.id].studentInfo) || {};
  return { ...base, ...dictInfo, ...inline };
}

export function tDipName(dip, shortMode = false) {
  if (!dip) return '';
  const active = getLocaleDef(currentCode);
  const entry = active && active.dipNames && active.dipNames[dip.id];
  if (entry) return shortMode ? (entry.short || entry.name) : entry.name;
  return shortMode ? String(dip.name || '').split(' ')[0] : (dip.name || '');
}

export function tBlockedPin(bpId, longMode = false) {
  const suffix = longMode ? 'Reason' : 'Short';
  const key = `pin.blocked${bpId}${suffix}`;
  const res = t(key);
  return res !== key ? res : (window.KCOMP_BOARD?.pins?.[bpId]?.reason || bpId);
}

export function tOnboard(ob, field) {
  if (!ob) return '';
  const active = getLocaleDef(currentCode);
  if (active && active.onboard && active.onboard[ob.id] && active.onboard[ob.id][field] !== undefined) {
    return active.onboard[ob.id][field];
  }
  return ob[field] || ob.name || '';
}

export function tPreset(preset, field = 'name') {
  if (!preset) return '';
  const active = getLocaleDef(currentCode);
  if (active && active.presets && active.presets[preset.id] && active.presets[preset.id][field] !== undefined) {
    return active.presets[preset.id][field];
  }
  return preset[field] || '';
}

export function tBlockGuide(type) {
  const active = getLocaleDef(currentCode);
  const fallback = registry.get(FALLBACK_LOCALE);
  const base = (fallback && fallback.blockGuides && fallback.blockGuides[type]) || {};
  const loc = (active && active.blockGuides && active.blockGuides[type]) || {};
  return { ...base, ...loc };
}

export function tCategory(rawName) {
  const active = getLocaleDef(currentCode);
  if (active && active.categories && active.categories[rawName] !== undefined) {
    return active.categories[rawName];
  }
  const fallback = registry.get(FALLBACK_LOCALE);
  if (fallback && fallback.categories && fallback.categories[rawName] !== undefined) {
    return fallback.categories[rawName];
  }
  return rawName;
}

export function applyI18nToDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.dataset.i18nTitle));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
}

export function closeLanguageMenu() {
  const pop = document.querySelector('#langMenuPopover');
  const btn = document.querySelector('#btnLangMenu');
  if (pop) pop.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

// Top-right Language Dropdown Menu (matches Project ▾ popover on desktop; flattens cleanly on mobile)
export function renderLanguageSwitcher(container, onSelected = null) {
  if (!container) return;
  const locales = getAvailableLocales();
  const activeDef = getLocaleDef();

  container.innerHTML = '';
  container.className = 'lang-menu-wrap';
  container.removeAttribute('role');
  container.removeAttribute('aria-label');
  container.removeAttribute('title');

  const trigger = document.createElement('button');
  trigger.id = 'btnLangMenu';
  trigger.type = 'button';
  trigger.className = 'btn btn-ghost lang-menu-trigger';
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('title', `${t('topbar.langTitle')} (${activeDef.nativeName})`);
  trigger.setAttribute('aria-label', `${t('topbar.langTitle')}: ${activeDef.nativeName}`);
  trigger.innerHTML = `<span class="lang-globe" aria-hidden="true">🌐</span><span class="lang-code">${activeDef.label}</span><span class="caret" aria-hidden="true">▾</span>`;

  const popover = document.createElement('div');
  popover.id = 'langMenuPopover';
  popover.className = 'project-menu-popover lang-menu-popover';
  popover.setAttribute('role', 'menu');
  popover.setAttribute('aria-label', t('topbar.langTitle'));

  locales.forEach((loc) => {
    const isActive = loc.code === currentCode;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'pm-item lang-item' + (isActive ? ' active' : '');
    item.dataset.lang = loc.code;
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', String(isActive));
    item.innerHTML = `<span class="lang-tag">${loc.label}</span><span class="lang-native">${loc.nativeName}</span><span class="lang-check" aria-hidden="true">${isActive ? '✓' : ''}</span>`;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      closeLanguageMenu();
      if (setLocale(loc.code) && onSelected) onSelected(loc);
    });
    popover.appendChild(item);
  });

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close Project menu if open so topbar popovers never overlap
    const projPop = document.querySelector('#projectMenuPopover');
    const projBtn = document.querySelector('#btnProjectMenu');
    if (projPop) projPop.classList.remove('open');
    if (projBtn) projBtn.setAttribute('aria-expanded', 'false');

    const isOpen = popover.classList.toggle('open');
    trigger.setAttribute('aria-expanded', String(isOpen));
  });

  container.appendChild(trigger);
  container.appendChild(popover);

  if (!outsideClickBound) {
    outsideClickBound = true;
    document.addEventListener('click', (e) => {
      const wrap = document.querySelector('#langSwitchSlot');
      if (wrap && !wrap.contains(e.target)) {
        closeLanguageMenu();
      }
    });
  }
}
