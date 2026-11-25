// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Extensible Internationalization (i18n) Registry
// Default language: English (en)
// To add a future language (e.g., sl, hr, fr, it):
//   1. Create src/i18n/<lang>.ts (plus optional <lang>-components.ts)
//   2. Register a lazy loader in localeCatalog below
import en from './en';
import { getActiveBoard } from '../boards';
import type { BlockGuideEntry, DipSwitchSpec, LocaleDefinition } from '../types';

const STORAGE_KEY = 'kcomp_lang';
const FALLBACK_LOCALE = 'en';

export interface LocaleMeta {
  code: string;
  label: string;
  nativeName: string;
  dir?: 'ltr' | 'rtl';
  loader?: () => Promise<{ default: LocaleDefinition }>;
}

type LocaleChangeListener = (code: string, def: LocaleDefinition | LocaleMeta) => void;

const localeCatalog: LocaleMeta[] = [
  { code: 'en', label: 'EN', nativeName: 'English', dir: 'ltr' },
  { code: 'de', label: 'DE', nativeName: 'Deutsch', dir: 'ltr', loader: () => import('./de') },
  { code: 'sq', label: 'SQ', nativeName: 'Shqip',   dir: 'ltr', loader: () => import('./sq') }
];

const registry = new Map<string, LocaleDefinition>();
const pendingLoads = new Map<string, Promise<LocaleDefinition>>();
const listeners = new Set<LocaleChangeListener>();
let currentCode = FALLBACK_LOCALE;
let outsideClickBound = false;

export function registerLocale(localeDef: LocaleDefinition | null | undefined): void {
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

export async function loadLocale(code: string): Promise<LocaleDefinition> {
  const norm = String(code || '').toLowerCase();
  const cached = registry.get(norm);
  if (cached) return cached;
  const fallback = registry.get(FALLBACK_LOCALE) || en;
  const meta = localeCatalog.find((m) => m.code === norm);
  if (!meta || !meta.loader) return fallback;

  const existing = pendingLoads.get(norm);
  if (existing) return existing;

  const promise = meta.loader().then((mod) => {
    const def = (mod && mod.default ? mod.default : mod) as LocaleDefinition;
    registerLocale(def);
    pendingLoads.delete(norm);
    return def;
  }).catch((err: unknown) => {
    pendingLoads.delete(norm);
    console.warn(`Failed to lazy-load locale "${norm}":`, err);
    return fallback;
  });

  pendingLoads.set(norm, promise);
  return promise;
}

export function getAvailableLocales(): Array<LocaleDefinition | LocaleMeta> {
  return localeCatalog.map((m) => registry.get(m.code) || m);
}

export function getLocale(): string {
  return currentCode;
}

export function getLocaleDef(code: string = currentCode): LocaleDefinition {
  return registry.get(code) || registry.get(FALLBACK_LOCALE) || en;
}

export function detectInitialLocale(): string {
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

export function initI18n(): string {
  const target = detectInitialLocale();
  currentCode = registry.has(target) ? target : FALLBACK_LOCALE;
  syncDocumentLang();
  return currentCode;
}

export async function initI18nAsync(): Promise<string> {
  const target = detectInitialLocale();
  await loadLocale(target);
  currentCode = registry.has(target) ? target : FALLBACK_LOCALE;
  syncDocumentLang();
  return currentCode;
}

function syncDocumentLang(): void {
  const def = getLocaleDef();
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = def.code;
    document.documentElement.dir = def.dir || 'ltr';
  }
}

export function onLocaleChange(fn: LocaleChangeListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setLocale(code: string, notify = true): boolean {
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

export function t(key: string, params: Record<string, unknown> | null = null): string {
  const active = getLocaleDef(currentCode);
  const fallback = registry.get(FALLBACK_LOCALE) || en;
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

export function tComp(def: Record<string, any> | null | undefined, field: string): string {
  if (!def) return '';
  if (def.i18n && def.i18n[currentCode] && def.i18n[currentCode][field] !== undefined) {
    return String(def.i18n[currentCode][field]);
  }
  const active = getLocaleDef(currentCode);
  if (active && active.components && active.components[def.id] && active.components[def.id][field] !== undefined) {
    return String(active.components[def.id][field]);
  }
  return def[field] ? String(def[field]) : '';
}

export function tCompInfo(def: Record<string, any> | null | undefined): Record<string, any> {
  if (!def) return {};
  const base = def.studentInfo || {};
  const inline = (def.i18n && def.i18n[currentCode] && def.i18n[currentCode].studentInfo) || {};
  const active = getLocaleDef(currentCode);
  const dictInfo = (active && active.components && active.components[def.id] && active.components[def.id].studentInfo) || {};
  return { ...base, ...dictInfo, ...inline };
}

export function tDipName(dip: Pick<DipSwitchSpec, 'id' | 'name'> | null | undefined, shortMode = false): string {
  if (!dip) return '';
  const active = getLocaleDef(currentCode);
  const dipMap = (active as Record<string, any>).dipNames as Record<number, { name: string; short?: string }> | undefined;
  const entry = dipMap ? dipMap[dip.id] : undefined;
  if (entry) return shortMode ? (entry.short || entry.name) : entry.name;
  return shortMode ? String(dip.name || '').split(' ')[0] : (dip.name || '');
}

export function tBlockedPin(bpId: string, longMode = false): string {
  const suffix = longMode ? 'Reason' : 'Short';
  const key = `pin.blocked${bpId}${suffix}`;
  const res = t(key);
  return res !== key ? res : (getActiveBoard()?.pins?.[bpId]?.reason || bpId);
}

export function tOnboard(ob: Record<string, any> | null | undefined, field: string): string {
  if (!ob) return '';
  const active = getLocaleDef(currentCode);
  if (active && active.onboard && active.onboard[ob.id] && active.onboard[ob.id][field] !== undefined) {
    return active.onboard[ob.id][field];
  }
  return String(ob[field] || ob.name || '');
}

export function tPreset(preset: Record<string, any> | null | undefined, field = 'name'): string {
  if (!preset) return '';
  const active = getLocaleDef(currentCode);
  const entry = active?.presets?.[preset.id] as Record<string, string | undefined> | undefined;
  if (entry && entry[field] !== undefined) {
    return entry[field] as string;
  }
  return String(preset[field] || '');
}

export function tBlockGuide(type: string): BlockGuideEntry {
  const active = getLocaleDef(currentCode);
  const fallback = registry.get(FALLBACK_LOCALE) || en;
  const base = (fallback && fallback.blockGuides && fallback.blockGuides[type]) || {};
  const loc = (active && active.blockGuides && active.blockGuides[type]) || {};
  return { ...base, ...loc };
}

export function tCategory(rawName: string): string {
  const active = getLocaleDef(currentCode);
  if (active && active.categories && active.categories[rawName] !== undefined) {
    return active.categories[rawName];
  }
  const fallback = registry.get(FALLBACK_LOCALE) || en;
  if (fallback && fallback.categories && fallback.categories[rawName] !== undefined) {
    return fallback.categories[rawName];
  }
  return rawName;
}

export function applyI18nToDom(root: Document | Element = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    const key = el.dataset.i18nHtml;
    if (key) el.innerHTML = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (key) el.setAttribute('title', t(key));
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.setAttribute('placeholder', t(key));
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset.i18nAria;
    if (key) el.setAttribute('aria-label', t(key));
  });
}

export function closeLanguageMenu(): void {
  const pop = document.querySelector<HTMLElement>('#langMenuPopover');
  const btn = document.querySelector<HTMLElement>('#btnLangMenu');
  if (pop) pop.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

// Top-right Language Dropdown Menu (matches Project popover on desktop; flattens cleanly on mobile)
export function renderLanguageSwitcher(
  container: HTMLElement | null,
  onSelected: ((loc: LocaleDefinition) => void) | null = null
): void {
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
    item.addEventListener('click', async (e: MouseEvent) => {
      e.stopPropagation();
      closeLanguageMenu();
      if (await setLocaleAsync(loc.code) && onSelected) onSelected(getLocaleDef(loc.code));
    });
    popover.appendChild(item);
  });

  trigger.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    const projPop = document.querySelector<HTMLElement>('#projectMenuPopover');
    const projBtn = document.querySelector<HTMLElement>('#btnProjectMenu');
    if (projPop) projPop.classList.remove('open');
    if (projBtn) projBtn.setAttribute('aria-expanded', 'false');

    const isOpen = popover.classList.toggle('open');
    trigger.setAttribute('aria-expanded', String(isOpen));
  });

  container.appendChild(trigger);
  container.appendChild(popover);

  if (!outsideClickBound) {
    outsideClickBound = true;
    document.addEventListener('click', (e: MouseEvent) => {
      const wrap = document.querySelector<HTMLElement>('#langSwitchSlot');
      if (wrap && e.target instanceof Node && !wrap.contains(e.target)) {
        closeLanguageMenu();
      }
    });
  }
}
