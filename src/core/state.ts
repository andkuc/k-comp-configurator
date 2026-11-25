// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Reactive Workbench State, Theme Engine, Electrical Net Classifier & Shared DOM Utilities
import { BASE_VB, resolveAssetUrl } from './constants';
import type { BoardOnboardPeripheral, WarningItem, WorkbenchState } from '../types';
import { appBus, type ToastOptions } from '../store/bus';
import { uiSessionStore } from '../store/ui-session';
import { t } from '../i18n/index';
import { DEFAULT_BOARD_ID, getActiveBoard } from '../boards';
import { createEmptyProposal } from './proposal';

const THEME_STORAGE_KEY = 'kcomp_theme';
const LAYOUT_STORAGE_KEY = 'kcomp_layout_v2';
const AUTOSAVE_PREF_KEY = 'kcomp_autosave_enabled';

export const state: WorkbenchState = {
  boardId: DEFAULT_BOARD_ID,
  codeProfile: 'kcomp-avr',
  carrierEnabled: false,
  catalog: null,
  boardSvgEl: null,
  projectName: '',
  proposal: createEmptyProposal(),
  printModalTab: 'labsheet',
  theme: 'dark',
  hoveredNet: null,
  svgCache: new Map(),
  onboard: {},
  oledPaged: false,
  active: [],
  placedEntries: [],
  breadboardRails: [],
  carrierFeeders: [],
  carrierWireMap: {},
  focusedId: null,
  search: '',
  groupMode: 'topic',
  category: 'All',
  wireMode: 'smart',
  powerRailMode: 'smart',
  snapToGrid: true,
  undoStack: [],
  redoStack: [],
  repoDocsMap: new Map(),
  repoDocsLoaded: false,
  nextInst: 1,
  vb: { ...BASE_VB },
  panning: null,
  touchPointers: new Map(),
  pinch: null,
  resizingSidebar: false,
  resizingInspector: false,
  resizingApi: false,
  sidebarCollapsed: false,
  inspectorCollapsed: false,
  pinFilter: 'all',
  wiringSubTab: 'modules',
  pinLegendCollapsed: false,
  hoveredHwId: null,
  collapsedPinGroups: new Set(),
  bootComplete: false,
  autoSaveEnabled: false,
  latestSketch: '',
  codeBlocks: [],
  nextBlockInst: 1,
  codeHints: true,
  blocksDrawerOpen: false,
  editingBlockId: null,
  openBlockInfo: null,
  apiDrawerOpen: false,
  apiShowAll: false,
  apiSearch: '',
  apiExpandedKey: null,
  repoDocsPromise: null,
  openInfoCompId: null,
  suppressClick: false,
  dragComp: null,
  rotateComp: null,
  dragWire: null,
  mobileView: 'board',
  needsMobileFit: false,
  toastTimer: null
};

export const $ = (sel: string): any => document.querySelector(sel);

export function escapeHtml(str: unknown): string {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function isLightTheme(): boolean {
  return state.theme === 'light';
}

export function detectInitialTheme(): 'dark' | 'light' {
  try {
    const params = new URLSearchParams(window.location.search);
    const p = (params.get('theme') || '').toLowerCase();
    if (p === 'light' || p === 'white') return 'light';
    if (p === 'dark') return 'dark';
  } catch (_) {}
  try {
    const stored = (localStorage.getItem(THEME_STORAGE_KEY) || '').toLowerCase();
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (_) {}
  return 'dark';
}

export function applyThemeToDom(theme: string = state.theme): void {
  state.theme = theme === 'light' ? 'light' : 'dark';
  uiSessionStore.patch({ theme: state.theme });
  document.documentElement.setAttribute('data-theme', state.theme);
  const bg = $('#canvasBackdropRect');
  const gridPath = $('#bgGridPath');
  if (bg) bg.setAttribute('fill', state.theme === 'light' ? '#f8fafc' : '#0b1120');
  if (gridPath) gridPath.setAttribute('stroke', state.theme === 'light' ? '#e2e8f0' : '#1e293b');

  const btn = $('#btnThemeToggle');
  if (btn) {
    btn.textContent = state.theme === 'light' ? '☾' : '☀';
    const title = state.theme === 'light' ? t('topbar.themeToDark') : t('topbar.themeToLight');
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.setAttribute('aria-pressed', String(state.theme === 'light'));
  }
}

export function initTheme(): void {
  applyThemeToDom(detectInitialTheme());
}

export function toggleTheme(): 'dark' | 'light' {
  const next: 'dark' | 'light' = state.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch (_) {}
  applyThemeToDom(next);
  return next;
}

// Electrical Net Classifier — groups electrically connected pins (5V, 3.3V, GND, I2C SDA/SCL, RESET, or signal pin)
export function getNetMeta(bpId: string | null | undefined): { id: string; label: string } {
  if (!bpId) return { id: 'NET_NONE', label: '' };
  const pinMeta = getActiveBoard()?.pins?.[bpId];
  const caps = pinMeta?.caps || [];
  if (caps.includes('5V')) return { id: 'NET_5V', label: t('net.5v') };
  if (caps.includes('3V3')) return { id: 'NET_3V3', label: t('net.3v3') };
  if (caps.includes('GND')) return { id: 'NET_GND', label: t('net.gnd') };
  if (caps.includes('I2C_SDA')) return { id: 'NET_I2C_SDA', label: t('net.sda') };
  if (caps.includes('I2C_SCL')) return { id: 'NET_I2C_SCL', label: t('net.scl') };
  if (caps.includes('RESET')) return { id: 'NET_RESET', label: t('net.reset') };
  const pinLabel = pinMeta?.label || bpId;
  return { id: `NET_${bpId}`, label: t('net.signal', { pin: pinLabel }) };
}

export function getCleanProjectName(): string {
  return (state.projectName || '').trim();
}

export function getProjectSlug(fallback: string = getActiveBoard().id): string {
  const clean = getCleanProjectName()
    .toLowerCase()
    .replace(/[ä]/g, 'ae').replace(/[ö]/g, 'oe').replace(/[ü]/g, 'ue').replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return clean || fallback;
}

export function syncProjectNameUI(): void {
  const inp = $('#projectNameInput');
  if (inp && inp.value !== state.projectName) {
    inp.value = state.projectName || '';
  }
  const clean = getCleanProjectName();
  document.title = clean ? t('app.titleProject', { name: clean }) : t('app.title');
}

export function showToast(msg: string, opts: ToastOptions | null = null): void {
  const el = $('#statusToast');
  if (!el) return;
  if (state.toastTimer !== null) clearTimeout(state.toastTimer);
  if (opts && opts.actionLabel && typeof opts.onAction === 'function') {
    const onAction = opts.onAction;
    el.innerHTML = `<span class="toast-msg">${escapeHtml(msg)}</span><button type="button" class="toast-action-btn">${escapeHtml(opts.actionLabel)}</button>`;
    el.classList.add('has-action');
    const btn = el.querySelector('.toast-action-btn');
    if (btn) {
      btn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        if (state.toastTimer !== null) clearTimeout(state.toastTimer);
        el.classList.add('hidden');
        onAction();
      });
    }
    el.classList.remove('hidden');
    state.toastTimer = setTimeout(() => el.classList.add('hidden'), opts.duration || 4800);
  } else {
    el.classList.remove('has-action');
    el.textContent = msg;
    el.classList.remove('hidden');
    state.toastTimer = setTimeout(() => el.classList.add('hidden'), (opts && opts.duration) || 2600);
  }
}

export function applyPanelCollapseState(): void {
  uiSessionStore.patch({
    sidebarCollapsed: !!state.sidebarCollapsed,
    inspectorCollapsed: !!state.inspectorCollapsed
  });
  const ws = $('#workspace');
  if (ws) {
    ws.classList.toggle('sidebar-collapsed', !!state.sidebarCollapsed);
    ws.classList.toggle('inspector-collapsed', !!state.inspectorCollapsed);
  }
  const bL = $('#btnCollapseSidebar');
  if (bL) bL.textContent = state.sidebarCollapsed ? '▶' : '◀';
  const bR = $('#btnCollapseInspector');
  if (bR) bR.textContent = state.inspectorCollapsed ? '◀' : '▶';
}

export function applyPinLegendState(): void {
  const collapsed = !!state.pinLegendCollapsed;
  uiSessionStore.patch({ pinLegendCollapsed: collapsed });
  const leg = $('#pinLegend');
  const btn = $('#btnPinLegendToggle');
  if (!leg) return;
  leg.classList.toggle('is-collapsed', collapsed);
  if (btn) {
    btn.setAttribute('aria-expanded', String(!collapsed));
    btn.title = collapsed ? t('legend.expandTitle') : t('legend.collapseTitle');
  }
}

export function saveLayoutPrefs(): void {
  try {
    const cs = getComputedStyle(document.documentElement);
    const payload = {
      sw: parseInt(cs.getPropertyValue('--sidebar-w'), 10) || 236,
      iw: parseInt(cs.getPropertyValue('--inspector-w'), 10) || 330,
      ah: parseInt(cs.getPropertyValue('--api-drawer-h'), 10) || 260,
      sc: !!state.sidebarCollapsed,
      ic: !!state.inspectorCollapsed,
      pl: !!state.pinLegendCollapsed
    };
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}
}

export function loadLayoutPrefs(): void {
  let hasLegendPref = false;
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) {
      state.pinLegendCollapsed = window.innerWidth <= 1280;
      applyPanelCollapseState();
      applyPinLegendState();
      return;
    }
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (typeof p.sw === 'number' && Number.isFinite(p.sw) && p.sw >= 192 && p.sw <= 440) {
      document.documentElement.style.setProperty('--sidebar-w', `${p.sw}px`);
    }
    if (typeof p.iw === 'number' && Number.isFinite(p.iw) && p.iw >= 240 && p.iw <= 720) {
      document.documentElement.style.setProperty('--inspector-w', `${p.iw}px`);
    }
    if (typeof p.ah === 'number' && Number.isFinite(p.ah) && p.ah >= 110 && p.ah <= 600) {
      document.documentElement.style.setProperty('--api-drawer-h', `${p.ah}px`);
    }
    state.sidebarCollapsed = !!p.sc;
    state.inspectorCollapsed = !!p.ic;
    if (typeof p.pl === 'boolean') {
      state.pinLegendCollapsed = p.pl;
      hasLegendPref = true;
    }
  } catch (_) {}
  if (!hasLegendPref) state.pinLegendCollapsed = window.innerWidth <= 1280;
  applyPanelCollapseState();
  applyPinLegendState();
}

export function detectInitialAutoSaveEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const p = (params.get('autosave') || '').toLowerCase();
    if (p === '1' || p === 'true' || p === 'on') return true;
    if (p === '0' || p === 'false' || p === 'off') return false;
  } catch (_) {}
  try {
    const stored = localStorage.getItem(AUTOSAVE_PREF_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch (_) {}
  return false;
}

export function syncAutoSaveUI(): void {
  const btn = $('#btnAutoSaveToggle');
  const lbl = $('#autoSaveLabel');
  if (!btn) return;
  const on = !!state.autoSaveEnabled;
  btn.classList.toggle('is-on', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.title = on ? t('bottom.autoSaveOnTitle') : t('bottom.autoSaveOffTitle');
  if (lbl) lbl.textContent = on ? t('bottom.autoSaveOn') : t('bottom.autoSaveOff');
}

export function setAutoSaveEnabled(enabled: boolean): void {
  state.autoSaveEnabled = !!enabled;
  try { localStorage.setItem(AUTOSAVE_PREF_KEY, state.autoSaveEnabled ? '1' : '0'); } catch (_) {}
  syncAutoSaveUI();
}

export function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= 960;
}

export function setMobileView(view: string): void {
  state.mobileView = view;
  uiSessionStore.patch({ mobileView: view });
  document.body.setAttribute('data-mobile-view', view);
  document.querySelectorAll<HTMLElement>('.mnav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.mview === view);
  });
  const menu = $('#topbarActions');
  const menuBtn = $('#btnMobileMenu');
  if (menu) menu.classList.remove('open');
  if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');

  if (view === 'board') {
    if (state.needsMobileFit) {
      state.needsMobileFit = false;
      if (state.active.length) appBus.emit('viewport:resetFit');
      else appBus.emit('viewport:zoomToBoard');
    } else {
      appBus.emit('viewport:applyViewBox');
    }
  }
}

export function updateMobileNavIndicators(warnings: WarningItem[] | null | undefined): void {
  const badge = $('#mnavCountBadge');
  if (badge) {
    const cnt = state.active.length;
    badge.textContent = String(cnt);
    badge.classList.toggle('hidden', cnt === 0);
  }
  const warnDot = $('#mnavWarnDot');
  if (warnDot) {
    warnDot.classList.toggle('hidden', !warnings || warnings.length === 0);
  }
}

export async function loadComponentSvg(svgFile: string): Promise<SVGElement | undefined> {
  if (state.svgCache.has(svgFile)) return state.svgCache.get(svgFile);
  const res = await fetch(resolveAssetUrl(svgFile));
  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
  const el = doc.documentElement as unknown as SVGElement;
  state.svgCache.set(svgFile, el);
  return el;
}

export function syncWorkbenchToggles(): void {
  const wm = $('#btnWireMode');
  if (wm) {
    const val = wm.querySelector('.hud-opt-val');
    const lbl = state.wireMode === 'smart' ? t('hud.smart') : t('hud.curved');
    if (val) val.textContent = lbl;
    else wm.textContent = lbl;
    wm.classList.toggle('is-active', state.wireMode === 'smart');
  }
  const sg = $('#btnSnapGrid');
  if (sg) {
    const val = sg.querySelector('.hud-opt-val');
    const lbl = state.snapToGrid ? t('hud.grid') : t('hud.free');
    if (val) val.textContent = lbl;
    else sg.textContent = lbl;
    sg.classList.toggle('is-active', state.snapToGrid);
  }
  const prm = $('#btnPowerRailMode');
  if (prm) {
    const hasBb = !!getActiveBoard().breadboard;
    prm.classList.toggle('hidden', !hasBb);
    const val = prm.querySelector('.hud-opt-val');
    const isRail = state.powerRailMode === 'rail';
    const lbl = isRail ? t('hud.powerRailBb') : t('hud.powerRailSmart');
    if (val) val.textContent = lbl;
    else prm.textContent = lbl;
    prm.classList.toggle('is-active', isRail);
  }
  const dot = $('#hudOptDot');
  if (dot) {
    const hasMoved = state.active.some((i) => !!i.customPos || !!(i.rotation && i.rotation % 360 !== 0));
    const nonDefault = state.wireMode !== 'smart' || !state.snapToGrid || state.powerRailMode === 'rail' || hasMoved;
    dot.classList.toggle('hidden', !nonDefault);
  }
}

export function getActiveOnboardDefs(): BoardOnboardPeripheral[] {
  return getActiveBoard().onboardPeripherals || [];
}

export function formatRamAmount(bytes: number, totalBytes: number): { usedStr: string; totalStr: string } {
  if (totalBytes >= 16384) {
    return {
      usedStr: `${(bytes / 1024).toFixed(1)} KB`,
      totalStr: `${Math.round(totalBytes / 1024)} KB`
    };
  }
  return {
    usedStr: `${bytes} B`,
    totalStr: `${totalBytes} B`
  };
}
