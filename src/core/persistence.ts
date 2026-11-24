// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Undo/Redo History, .kcomp.json Save/Load, Shareable #cfg= Links & Lab Presets
import { MAX_HISTORY, APP_VERSION, COPYRIGHT_AUTHOR, CONFIGURATOR_REPO_URL } from './constants';
import {
  state, hooks, $, getCleanProjectName, getProjectSlug, syncProjectNameUI,
  showToast, isMobileViewport, setMobileView, loadComponentSvg, syncWorkbenchToggles, syncAutoSaveUI, getActiveOnboardDefs
} from './state';
import { getCompDef, addComponent, rebalanceOverflowPowerPins } from './hardware';
import { t, tPreset } from '../i18n/index';
import { DEFAULT_BOARD_ID, getActiveBoard, getBoardById } from '../boards';
import { normalizeCodeProfile } from './code-profiles';

export function captureSnapshot() {
  return JSON.stringify({
    boardId: state.boardId || DEFAULT_BOARD_ID,
    codeProfile: state.codeProfile,
    carrierEnabled: !!state.carrierEnabled,
    powerRailMode: state.powerRailMode || 'smart',
    projectName: state.projectName,
    onboard: state.onboard,
    oledPaged: state.oledPaged,
    active: state.active,
    nextInst: state.nextInst,
    codeBlocks: state.codeBlocks,
    nextBlockInst: state.nextBlockInst,
    codeHints: state.codeHints
  });
}

export function pushUndoState() {
  const snap = captureSnapshot();
  if (state.undoStack.length && state.undoStack[state.undoStack.length - 1] === snap) return;
  state.undoStack.push(snap);
  if (state.undoStack.length > MAX_HISTORY) state.undoStack.shift();
  state.redoStack = [];
  updateHistoryButtons();
}

export function updateHistoryButtons() {
  const u = $('#btnUndo');
  const r = $('#btnRedo');
  if (u) u.disabled = state.undoStack.length === 0;
  if (r) r.disabled = state.redoStack.length === 0;
}

export async function restoreSnapshot(snapJson) {
  const data = JSON.parse(snapJson);
  const neededSvgs = new Set();
  for (const inst of (data.active || [])) {
    const def = getCompDef(inst.compId);
    if (def) neededSvgs.add(def.svgFile);
  }
  await Promise.all(Array.from(neededSvgs).map((f) => loadComponentSvg(f)));

  const snapBoard = data.boardId || DEFAULT_BOARD_ID;
  if (snapBoard !== state.boardId) {
    await hooks.switchBoard(snapBoard, { force: true, skipUndo: true, preserveState: true });
  }
  state.codeProfile = normalizeCodeProfile(data.codeProfile, getActiveBoard());
  if (typeof data.carrierEnabled === 'boolean') state.carrierEnabled = data.carrierEnabled;
  state.powerRailMode = data.powerRailMode === 'rail' ? 'rail' : 'smart';
  if (typeof data.projectName === 'string') state.projectName = data.projectName;
  syncProjectNameUI();
  state.onboard = { ...data.onboard };
  state.oledPaged = !!data.oledPaged;
  state.active = data.active || [];
  state.nextInst = Math.max(state.nextInst, data.nextInst || 1);
  state.codeBlocks = Array.isArray(data.codeBlocks) ? data.codeBlocks : [];
  state.nextBlockInst = Math.max(state.nextBlockInst, data.nextBlockInst || 1);
  if (typeof data.codeHints === 'boolean') state.codeHints = data.codeHints;
  state.editingBlockId = null;
  state.focusedId = null;
  updateHistoryButtons();
  hooks.recomputeAndRender();
}

export async function performUndo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(captureSnapshot());
  const prev = state.undoStack.pop();
  await restoreSnapshot(prev);
  showToast(t('toast.undo'));
}

export async function performRedo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(captureSnapshot());
  const next = state.redoStack.pop();
  await restoreSnapshot(next);
  showToast(t('toast.redo'));
}

export function serializeProjectPayload() {
  const board = getActiveBoard();
  const prof = normalizeCodeProfile(state.codeProfile, board);
  return {
    v: 24,
    b: board.id,
    cp: prof,
    ...(board.carrier ? { cr: !!state.carrierEnabled } : {}),
    ...(state.powerRailMode === 'rail' ? { prm: 'rail' } : {}),
    target: {
      boardId: board.id,
      codeProfile: prof,
      nodes: [{ id: 'node_0', boardId: board.id, codeProfile: prof }]
    },
    name: getCleanProjectName(),
    ob: { ...state.onboard },
    pg: !!state.oledPaged,
    rt: state.wireMode,
    gr: !!state.snapToGrid,
    ch: state.codeHints !== false,
    cb: (state.codeBlocks || []).map((b) => ({ t: b.type, c: { ...(b.config || {}) } })),
    act: state.active.map((i) => ({
      id: i.compId,
      h: i.i2cHeader || null,
      pm: { ...i.pinMap },
      ...(i.bbPins && Object.keys(i.bbPins).length ? { bb: { ...i.bbPins } } : {}),
      pos: i.customPos ? { x: Math.round(i.customPos.x), y: Math.round(i.customPos.y), w: Math.round(i.customPos.w), h: Math.round(i.customPos.h) } : null,
      rot: i.rotation || 0
    }))
  };
}

export async function applyProjectPayload(payload, pushHistory = true) {
  if (!payload || !Array.isArray(payload.act)) throw new Error('Invalid K-Comp project file');
  if (pushHistory) pushUndoState();

  // Backward-compatible target board resolution (v0.1.x payloads without b/target default to kcomp-v2)
  const reqBoardId = payload.target?.boardId || payload.b || DEFAULT_BOARD_ID;
  const resolvedBoard = getBoardById(reqBoardId) ? reqBoardId : DEFAULT_BOARD_ID;
  if (resolvedBoard !== state.boardId) {
    await hooks.switchBoard(resolvedBoard, { force: true, skipUndo: true, preserveState: true });
  }
  const board = getActiveBoard();
  state.codeProfile = normalizeCodeProfile(payload.target?.codeProfile || payload.cp, board);
  if (board.carrier && typeof payload.cr === 'boolean') state.carrierEnabled = payload.cr;
  state.powerRailMode = payload.prm === 'rail' ? 'rail' : 'smart';

  const validAct = [];
  for (const item of payload.act) {
    const def = getCompDef(item.id);
    if (!def) continue;
    await loadComponentSvg(def.svgFile);
    validAct.push({
      instanceId: 'inst_' + state.nextInst++,
      compId: item.id,
      i2cHeader: item.h || null,
      pinMap: item.pm && typeof item.pm === 'object' ? { ...item.pm } : {},
      bbPins: item.bb && typeof item.bb === 'object' ? { ...item.bb } : {},
      customPos: item.pos && typeof item.pos === 'object' ? { ...item.pos } : null,
      rotation: Number(item.rot) || 0
    });
  }

  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) {
    state.onboard[ob.id] = payload.ob && payload.ob[ob.id] !== undefined ? !!payload.ob[ob.id] : false;
  }
  if (board.capabilities.hasWirelessSlot) {
    state.onboard.onboard_wireless = payload.ob && payload.ob.onboard_wireless !== undefined ? !!payload.ob.onboard_wireless : false;
  }
  if (typeof payload.name === 'string') state.projectName = payload.name;
  syncProjectNameUI();
  state.oledPaged = !!payload.pg;
  if (payload.rt === 'smart' || payload.rt === 'curved') state.wireMode = payload.rt;
  if (typeof payload.gr === 'boolean') state.snapToGrid = payload.gr;
  state.active = validAct;
  if (Array.isArray(payload.cb)) {
    state.codeBlocks = payload.cb.filter((x) => x && x.t).map((x) => ({
      blockId: 'blk_' + state.nextBlockInst++,
      type: x.t,
      config: x.c && typeof x.c === 'object' ? { ...x.c } : {}
    }));
  } else {
    state.codeBlocks = [];
  }
  if (typeof payload.ch === 'boolean') state.codeHints = payload.ch;
  state.editingBlockId = null;
  state.focusedId = null;
  syncWorkbenchToggles();
  hooks.resetViewFit();
  hooks.recomputeAndRender();
}

export function saveProjectFile() {
  const payload = {
    ...serializeProjectPayload(),
    meta: {
      generator: 'K-Comp Configurator',
      version: APP_VERSION,
      author: COPYRIGHT_AUTHOR,
      source: CONFIGURATOR_REPO_URL
    }
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fname = `${getProjectSlug(`${getActiveBoard().id}-project`)}.kcomp.json`;
  a.download = fname;
  a.click();
  URL.revokeObjectURL(url);
  showToast(t('toast.saved', { file: fname }));
}

function encodeBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(b64) {
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function shareConfigLink() {
  try {
    const encoded = encodeBase64Url(JSON.stringify(serializeProjectPayload()));
    const base = window.location.href.split('#')[0];
    const fullUrl = `${base}#cfg=${encoded}`;
    try { window.history.replaceState(null, '', `#cfg=${encoded}`); } catch (_) {}
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(fullUrl);
      showToast(t('toast.shareCopied'));
    } else {
      window.prompt(t('toast.sharePrompt'), fullUrl);
    }
  } catch (err) {
    console.error(err);
    showToast(t('toast.shareError'));
  }
}

export async function tryLoadFromUrlHash() {
  const hash = window.location.hash || '';
  if (!hash.startsWith('#cfg=')) return false;
  try {
    const raw = decodeBase64Url(hash.slice(5));
    const payload = JSON.parse(raw);
    await applyProjectPayload(payload, false);
    showToast(t('toast.loadedShare'));
    return true;
  } catch (err) {
    console.warn('Invalid #cfg hash ignored:', err);
    return false;
  }
}

const AUTOSAVE_KEY = 'kcomp_autosave_v1';
let autoSaveTimer = null;

export function clearAutoSaveDraft() {
  clearTimeout(autoSaveTimer);
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch (_) {}
}

export function scheduleAutoSave(immediate = false) {
  if (!state.bootComplete || !state.catalog || !state.autoSaveEnabled) return;
  clearTimeout(autoSaveTimer);
  const doSave = () => {
    if (!state.autoSaveEnabled) return;
    try {
      const payload = serializeProjectPayload();
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
      const btn = $('#btnAutoSaveToggle');
      if (btn) {
        btn.classList.add('is-saved');
        setTimeout(() => btn.classList.remove('is-saved'), 850);
      }
    } catch (_) {}
  };
  if (immediate) doSave();
  else autoSaveTimer = setTimeout(doSave, 220);
}

export async function tryLoadFromAutoSave() {
  if (!state.autoSaveEnabled) return false;
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (!payload || !Array.isArray(payload.act)) return false;
    const hasActiveOnboard = payload.ob && Object.values(payload.ob).some((v) => v === true);
    const hasContent = payload.act.length > 0 || (Array.isArray(payload.cb) && payload.cb.length > 0) || !!payload.name || !!payload.pg || hasActiveOnboard;
    if (!hasContent) return false;
    await applyProjectPayload(payload, false);
    rebalanceOverflowPowerPins();
    return true;
  } catch (err) {
    console.warn('Auto-save restore skipped:', err);
    return false;
  }
}

export function resetToNewDesign(opts: any = {}) {
  const { skipUndo = false, silent = false } = opts;
  const anyOnboardOn = Object.values(state.onboard || {}).some((v) => v === true);
  const hasAnything = state.active.length > 0 || (state.codeBlocks && state.codeBlocks.length > 0) || !!getCleanProjectName() || !!state.oledPaged || anyOnboardOn;

  if (!skipUndo && hasAnything) pushUndoState();

  state.projectName = '';
  syncProjectNameUI();
  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) {
    state.onboard[ob.id] = false;
  }
  if (getActiveBoard().capabilities.hasWirelessSlot) {
    state.onboard.onboard_wireless = false;
  }
  state.oledPaged = false;
  state.powerRailMode = 'smart';
  state.active = [];
  state.codeBlocks = [];
  state.editingBlockId = null;
  state.focusedId = null;
  clearAutoSaveDraft();

  // Clear #cfg= URL hash so refreshing truly stays on the blank design
  if ((window.location.hash || '').startsWith('#cfg=')) {
    try { window.history.replaceState(null, '', window.location.href.split('#')[0]); } catch (_) {}
  }

  if (isMobileViewport()) hooks.zoomToBoard();
  else hooks.resetViewFit();
  syncAutoSaveUI();
  hooks.recomputeAndRender();

  if (!silent) {
    showToast(
      t('toast.newDesign'),
      hasAnything && !skipUndo ? { actionLabel: t('toast.undoBtn'), onAction: () => hooks.performUndo() } : null
    );
  }
}

export function populatePresets() {
  const sel = $('#presetSelect');
  if (!sel || !state.catalog) return;
  sel.innerHTML = `<option value="">${t('topbar.loadPreset')}</option>`;
  for (const p of state.catalog.presets) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = tPreset(p, 'name');
    sel.appendChild(opt);
  }
}

export async function loadPreset(presetId) {
  const p = state.catalog.presets.find((x) => x.id === presetId);
  if (!p) return;
  pushUndoState();
  state.active = [];
  state.focusedId = null;
  for (const ob of state.catalog.onboard) {
    state.onboard[ob.id] = !!(p.onboard && p.onboard[ob.id]);
  }
  state.onboard.onboard_wireless = false;
  state.oledPaged = !!p.oledPaged;
  state.projectName = tPreset(p, 'name').split('(')[0].trim();
  syncProjectNameUI();
  for (const ext of p.external) await addComponent(ext.id, { ...ext, skipUndo: true });
  state.focusedId = null;
  state.needsMobileFit = false;
  if (isMobileViewport()) setMobileView('board');
  hooks.resetViewFit();
  hooks.recomputeAndRender();
  showToast(t('toast.presetLoaded', { name: state.projectName }), {
    actionLabel: t('toast.undoBtn'),
    onAction: () => performUndo()
  });
}
