// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Extensible Internationalization (i18n) Registry
// Default language: English (en)
// To add a future language (e.g., sl, hr, fr, it):
//   1. Create js/i18n/<lang>.js (plus optional <lang>-components.js)
//   2. Import it below and call registerLocale(<lang>)
import en from './en';
import { getActiveBoard } from '../boards';

const STORAGE_KEY = 'kcomp_lang';
const FALLBACK_LOCALE = 'en';

interface LocaleMeta {
  code: string;
  label: string;
  nativeName: string;
  dir?: 'ltr' | 'rtl';
  loader?: () => Promise<{ default: any }>;
}

const localeCatalog: LocaleMeta[] = [
  { code: 'en', label: 'EN', nativeName: 'English', dir: 'ltr' },
  { code: 'de', label: 'DE', nativeName: 'Deutsch', dir: 'ltr', loader: () => import('./de') },
  { code: 'sq', label: 'SQ', nativeName: 'Shqip',   dir: 'ltr', loader: () => import('./sq') }
];

const registry = new Map<string, any>();
const pendingLoads = new Map<string, Promise<any>>();
const listeners = new Set<any>();
let currentCode = FALLBACK_LOCALE;
let outsideClickBound = false;

export function registerLocale(localeDef) {
  if (!localeDef || !localeDef.code) return;
  const code = localeDef.code.toLowerCase();
  registry.set(code, localeDef);
  if (!localeCatalog.some((m) => m.code === code)) {
    localeCatalog.push({
      code,
      label: localeDef.label || code.toUpperCase(),
      nativeName: localeDef.nativeName || code,
      dir: localeDef.dir || 'ltr'
    });
  }
}

registerLocale(en);

export function isSupportedLocale(code: string): boolean {
  const norm = String(code || '').toLowerCase();
  return registry.has(norm) || localeCatalog.some((m) => m.code === norm);
}

export async function loadLocale(code: string) {
  const norm = String(code || '').toLowerCase();
  if (registry.has(norm)) return registry.get(norm);
  const meta = localeCatalog.find((m) => m.code === norm);
  if (!meta || !meta.loader) return registry.get(FALLBACK_LOCALE);

  if (!pendingLoads.has(norm)) {
    pendingLoads.set(
      norm,
      meta.loader().then((mod) => {
        const def = mod.default || mod;
        registerLocale(def);
        pendingLoads.delete(norm);
        return def;
      }).catch((err) => {
        pendingLoads.delete(norm);
        console.warn(`Failed to lazy-load locale "${norm}":`, err);
        return registry.get(FALLBACK_LOCALE);
      })
    );
  }
  return pendingLoads.get(norm);
}

export function getAvailableLocales() {
  return localeCatalog.map((m) => registry.get(m.code) || m);
}

export function getLocale() {
  return currentCode;
}

export function getLocaleDef(code = currentCode) {
  return registry.get(code) || localeCatalog.find((m) => m.code === code) || registry.get(FALLBACK_LOCALE);
}

export function detectInitialLocale() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = (params.get('lang') || '').toLowerCase();
    if (fromUrl && isSupportedLocale(fromUrl)) return fromUrl;
  } catch (_) {}

  try {
    const stored = (localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
    if (stored && isSupportedLocale(stored)) return stored;
  } catch (_) {}

  return FALLBACK_LOCALE;
}

export function initI18n() {
  const target = detectInitialLocale();
  currentCode = registry.has(target) ? target : FALLBACK_LOCALE;
  syncDocumentLang();
  return currentCode;
}

export async function initI18nAsync() {
  const target = detectInitialLocale();
  await loadLocale(target);
  currentCode = registry.has(target) ? target : FALLBACK_LOCALE;
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
  if (!isSupportedLocale(norm)) return false;
  if (norm === currentCode && registry.has(norm)) return false;
  if (!registry.has(norm)) {
    void setLocaleAsync(norm, notify);
    return true;
  }
  currentCode = norm;
  try { localStorage.setItem(STORAGE_KEY, norm); } catch (_) {}
  syncDocumentLang();
  applyI18nToDom();
  if (notify) {
    for (const fn of listeners) fn(currentCode, getLocaleDef());
  }
  return true;
}

export async function setLocaleAsync(code: string, notify = true): Promise<boolean> {
  const norm = String(code || '').toLowerCase();
  if (!isSupportedLocale(norm)) return false;
  await loadLocale(norm);
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

export function t(key: string, params: Record<string, any> | null = null): string {
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
  return res !== key ? res : (getActiveBoard()?.pins?.[bpId]?.reason || bpId);
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

export function applyI18nToDom(root: any = document) {
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
  const pop = document.querySelector<any>('#langMenuPopover');
  const btn = document.querySelector<any>('#btnLangMenu');
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
    item.addEventListener('click', async (e: any) => {
      e.stopPropagation();
      closeLanguageMenu();
      if (await setLocaleAsync(loc.code) && onSelected) onSelected(getLocaleDef(loc.code));
    });
    popover.appendChild(item);
  });

  trigger.addEventListener('click', (e: any) => {
    e.stopPropagation();
    // Close Project menu if open so topbar popovers never overlap
    const projPop = document.querySelector<any>('#projectMenuPopover');
    const projBtn = document.querySelector<any>('#btnProjectMenu');
    if (projPop) projPop.classList.remove('open');
    if (projBtn) projBtn.setAttribute('aria-expanded', 'false');

    const isOpen = popover.classList.toggle('open');
    trigger.setAttribute('aria-expanded', String(isOpen));
  });

  container.appendChild(trigger);
  container.appendChild(popover);

  if (!outsideClickBound) {
    outsideClickBound = true;
    document.addEventListener('click', (e: any) => {
      const wrap = document.querySelector<any>('#langSwitchSlot');
      if (wrap && !wrap.contains(e.target)) {
        closeLanguageMenu();
      }
    });
  }
}
