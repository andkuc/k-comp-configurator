// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Reactive Workbench State, Theme Engine, Electrical Net Classifier & Shared DOM Utilities
import { BASE_VB, resolveAssetUrl } from './constants';
import type { WorkbenchState, HooksRegistry } from '../types';
import { t } from '../i18n/index';
import { DEFAULT_BOARD_ID, getActiveBoard } from '../boards';

const THEME_STORAGE_KEY = 'kcomp_theme';
const LAYOUT_STORAGE_KEY = 'kcomp_layout_v1';
const AUTOSAVE_PREF_KEY = 'kcomp_autosave_enabled';

export const state: WorkbenchState = (typeof window !== 'undefined' && window.__KCOMP_STATE) || (typeof window !== 'undefined' ? (window.__KCOMP_STATE = {
  boardId: DEFAULT_BOARD_ID,
  codeProfile: 'kcomp-avr',
  carrierEnabled: false,
  catalog: null,
  boardSvgEl: null,
  projectName: '',
  theme: 'dark',        // 'dark' | 'light' (White Mode)
  hoveredNet: null,     // Active electrical net ID on direct wire/rail hover
  svgCache: new Map(),
  onboard: {},
  oledPaged: false,
  active: [],
  placedEntries: [],
  breadboardRails: [],
  carrierFeeders: [],
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
}) : ({
  boardId: DEFAULT_BOARD_ID,
  codeProfile: 'kcomp-avr',
  carrierEnabled: false,
  catalog: null,
  boardSvgEl: null,
  projectName: '',
  theme: 'dark',
  hoveredNet: null,
  svgCache: new Map(),
  onboard: {},
  oledPaged: false,
  active: [],
  placedEntries: [],
  breadboardRails: [],
  carrierFeeders: [],
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
}));

// Registered once in js/main.js to keep the ES module dependency graph strictly acyclic
const defaultHooks: HooksRegistry = {
  recomputeAndRender: () => {},
  pushUndoState: () => {},
  performUndo: () => {},
  captureSnapshot: () => '{}',
  updateHistoryButtons: () => {},
  openComponentInfo: () => {},
  openBlockInfo: () => {},
  openBlocksOverview: () => {},
  updateInfoModalDocLink: () => {},
  showPinTooltip: () => {},
  showCustomTooltip: () => {},
  moveTooltip: () => {},
  hideTooltip: () => {},
  setHoveredNet: () => {},
  applyViewBox: () => {},
  resetViewFit: () => {},
  zoomToBoard: () => {},
  loadPreset: () => {},
  setHwHover: () => {},
  flashTarget: () => {},
  panToComponent: () => {},
  switchBoard: () => {}
};

export const hooks: HooksRegistry = (typeof window !== 'undefined' && window.__KCOMP_HOOKS) || (typeof window !== 'undefined' ? (window.__KCOMP_HOOKS = defaultHooks) : defaultHooks);

export const $ = (sel: string): any => document.querySelector(sel);

export function escapeHtml(str: any): string {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function isLightTheme() {
  return state.theme === 'light';
}

export function detectInitialTheme() {
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

export function applyThemeToDom(theme: string = state.theme) {
  state.theme = theme === 'light' ? 'light' : 'dark';
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

export function initTheme() {
  applyThemeToDom(detectInitialTheme());
}

export function toggleTheme() {
  const next = state.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch (_) {}
  applyThemeToDom(next);
  return next;
}

// Electrical Net Classifier — groups electrically connected pins (5V, 3.3V, GND, I²C SDA/SCL, RESET, or signal pin)
export function getNetMeta(bpId) {
  if (!bpId) return { id: 'NET_NONE', label: '' };
  const pinMeta = getActiveBoard()?.pins?.[bpId];
  const caps = pinMeta?.caps || [];
  if (bpId === 'PWR_5V' || bpId === 'H1_VCC' || bpId === 'H2_VCC' || bpId === 'H3_VCC' || caps.includes('5V')) {
    return { id: 'NET_5V', label: t('net.5v') };
  }
  if (bpId === 'PWR_3V3' || caps.includes('3V3')) {
    return { id: 'NET_3V3', label: t('net.3v3') };
  }
  if (bpId === 'PWR_GND1' || bpId === 'PWR_GND2' || bpId === 'TOP_GND' || bpId === 'EXT_GND' ||
      bpId === 'H1_GND' || bpId === 'H2_GND' || bpId === 'H3_GND' || caps.includes('GND')) {
    return { id: 'NET_GND', label: t('net.gnd') };
  }
  if (bpId === 'TOP_SDA' || bpId === 'A4' || bpId === 'H1_SDA' || bpId === 'H2_SDA' || bpId === 'H3_SDA' || caps.includes('I2C_SDA')) {
    return { id: 'NET_I2C_SDA', label: t('net.sda') };
  }
  if (bpId === 'TOP_SCL' || bpId === 'A5' || bpId === 'H1_SCL' || bpId === 'H2_SCL' || bpId === 'H3_SCL' || caps.includes('I2C_SCL')) {
    return { id: 'NET_I2C_SCL', label: t('net.scl') };
  }
  if (bpId === 'PWR_RESET' || caps.includes('RESET')) {
    return { id: 'NET_RESET', label: t('net.reset') };
  }
  const pinLabel = pinMeta?.label || bpId;
  return { id: `NET_${bpId}`, label: t('net.signal', { pin: pinLabel }) };
}

export function getCleanProjectName() {
  return (state.projectName || '').trim();
}

export function getProjectSlug(fallback = 'kcomp-v2') {
  const clean = getCleanProjectName()
    .toLowerCase()
    .replace(/[ä]/g, 'ae').replace(/[ö]/g, 'oe').replace(/[ü]/g, 'ue').replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return clean || fallback;
}

export function syncProjectNameUI() {
  const inp = $('#projectNameInput');
  if (inp && inp.value !== state.projectName) {
    inp.value = state.projectName || '';
  }
  const clean = getCleanProjectName();
  document.title = clean ? t('app.titleProject', { name: clean }) : t('app.title');
}

export function showToast(msg: string, opts: any = null) {
  const el = $('#statusToast');
  if (!el) return;
  clearTimeout(state.toastTimer);
  if (opts && opts.actionLabel && typeof opts.onAction === 'function') {
    el.innerHTML = `<span class="toast-msg">${escapeHtml(msg)}</span><button type="button" class="toast-action-btn">${escapeHtml(opts.actionLabel)}</button>`;
    el.classList.add('has-action');
    const btn = el.querySelector('.toast-action-btn');
    if (btn) {
      btn.addEventListener('click', (e: any) => {
        e.stopPropagation();
        clearTimeout(state.toastTimer);
        el.classList.add('hidden');
        opts.onAction();
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

export function applyPanelCollapseState() {
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

export function applyPinLegendState() {
  const leg = $('#pinLegend');
  const btn = $('#btnPinLegendToggle');
  if (!leg) return;
  const collapsed = !!state.pinLegendCollapsed;
  leg.classList.toggle('is-collapsed', collapsed);
  if (btn) {
    btn.setAttribute('aria-expanded', String(!collapsed));
    btn.title = collapsed ? t('legend.expandTitle') : t('legend.collapseTitle');
  }
}

export function saveLayoutPrefs() {
  try {
    const cs = getComputedStyle(document.documentElement);
    const payload = {
      sw: parseInt(cs.getPropertyValue('--sidebar-w'), 10) || 326,
      iw: parseInt(cs.getPropertyValue('--inspector-w'), 10) || 330,
      ah: parseInt(cs.getPropertyValue('--api-drawer-h'), 10) || 260,
      sc: !!state.sidebarCollapsed,
      ic: !!state.inspectorCollapsed,
      pl: !!state.pinLegendCollapsed
    };
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}
}

export function loadLayoutPrefs() {
  let hasLegendPref = false;
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) {
      state.pinLegendCollapsed = window.innerWidth <= 1280;
      applyPanelCollapseState();
      applyPinLegendState();
      return;
    }
    const p = JSON.parse(raw);
    if (Number.isFinite(p.sw) && p.sw >= 240 && p.sw <= 560) {
      document.documentElement.style.setProperty('--sidebar-w', `${p.sw}px`);
    }
    if (Number.isFinite(p.iw) && p.iw >= 240 && p.iw <= 720) {
      document.documentElement.style.setProperty('--inspector-w', `${p.iw}px`);
    }
    if (Number.isFinite(p.ah) && p.ah >= 110 && p.ah <= 600) {
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

export function detectInitialAutoSaveEnabled() {
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

export function syncAutoSaveUI() {
  const btn = $('#btnAutoSaveToggle');
  const lbl = $('#autoSaveLabel');
  if (!btn) return;
  const on = !!state.autoSaveEnabled;
  btn.classList.toggle('is-on', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.title = on ? t('bottom.autoSaveOnTitle') : t('bottom.autoSaveOffTitle');
  if (lbl) lbl.textContent = on ? t('bottom.autoSaveOn') : t('bottom.autoSaveOff');
}

export function setAutoSaveEnabled(enabled) {
  state.autoSaveEnabled = !!enabled;
  try { localStorage.setItem(AUTOSAVE_PREF_KEY, state.autoSaveEnabled ? '1' : '0'); } catch (_) {}
  syncAutoSaveUI();
}

export function isMobileViewport() {
  return window.innerWidth <= 960;
}

export function setMobileView(view) {
  state.mobileView = view;
  document.body.setAttribute('data-mobile-view', view);
  document.querySelectorAll<any>('.mnav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.mview === view);
  });
  const menu = $('#topbarActions');
  const menuBtn = $('#btnMobileMenu');
  if (menu) menu.classList.remove('open');
  if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');

  if (view === 'board') {
    if (state.needsMobileFit) {
      state.needsMobileFit = false;
      if (state.active.length) hooks.resetViewFit();
      else hooks.zoomToBoard();
    } else {
      hooks.applyViewBox();
    }
  }
}

export function updateMobileNavIndicators(warnings) {
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

export async function loadComponentSvg(svgFile) {
  if (state.svgCache.has(svgFile)) return state.svgCache.get(svgFile);
  const res = await fetch(resolveAssetUrl(svgFile));
  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
  state.svgCache.set(svgFile, doc.documentElement as unknown as SVGElement);
  return doc.documentElement;
}

export function syncWorkbenchToggles() {
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

export function getActiveOnboardDefs() {
  const board = getActiveBoard();
  if (board.onboardPeripherals) return board.onboardPeripherals;
  if (board.id === 'kcomp-v2') return state.catalog?.onboard || [];
  return [];
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
