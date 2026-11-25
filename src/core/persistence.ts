// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Undo/Redo History, Multi-Node ProjectDocument v1 (.kcomp.json), Compressed #cfg= Links & Lab Presets
import type { ActiveComponentInstance, PresetDef, ProjectDocument, ProjectNode } from '../types';
import { MAX_HISTORY, APP_VERSION, COPYRIGHT_AUTHOR, CONFIGURATOR_REPO_URL } from './constants';
import {
  state, $, getCleanProjectName, getProjectSlug, syncProjectNameUI,
  isMobileViewport, setMobileView, loadComponentSvg, syncWorkbenchToggles, getActiveOnboardDefs
} from './state';
import { getCompDef, addComponent } from './hardware';
import { t, tPreset } from '../i18n/index';
import { DEFAULT_BOARD_ID, getActiveBoard, getBoardById, setActiveCarrierEnabled } from '../boards';
import { normalizeCodeProfile } from './code-profiles';
import { cloneProposal, createEmptyProposal, hasProposalContent, normalizeProposal } from './proposal';
import {
  PROJECT_SCHEMA_ID,
  decodeDocumentFromHashPayload,
  encodeDocumentToHashPayload,
  validateProjectDocument
} from './document';
import { appBus, type ToastOptions } from '../store/bus';
import { nodeGraphStore } from '../store/nodes';
import { DEFAULT_NODE_ID, uiSessionStore } from '../store/ui-session';

function notifyToast(msg: string, opts: ToastOptions | null = null): void {
  appBus.emit('ui:toast', { msg, opts });
}

export function captureSnapshot(): string {
  return JSON.stringify(serializeProjectDocument());
}

export function pushUndoState(): void {
  state.undoStack.push(captureSnapshot());
  if (state.undoStack.length > MAX_HISTORY) state.undoStack.shift();
  state.redoStack = [];
  updateHistoryButtons();
}

export function updateHistoryButtons(): void {
  const u = $('#btnUndo') as HTMLButtonElement | null;
  const r = $('#btnRedo') as HTMLButtonElement | null;
  if (u) u.disabled = state.undoStack.length === 0;
  if (r) r.disabled = state.redoStack.length === 0;
}

export async function restoreSnapshot(snapJson: string): Promise<void> {
  const doc = validateProjectDocument(JSON.parse(snapJson));
  await applyProjectDocument(doc, false);
  updateHistoryButtons();
}

export async function performUndo(): Promise<void> {
  if (!state.undoStack.length) return;
  state.redoStack.push(captureSnapshot());
  const prev = state.undoStack.pop();
  if (prev) await restoreSnapshot(prev);
  notifyToast(t('toast.undo'));
}

export async function performRedo(): Promise<void> {
  if (!state.redoStack.length) return;
  state.undoStack.push(captureSnapshot());
  const next = state.redoStack.pop();
  if (next) await restoreSnapshot(next);
  notifyToast(t('toast.redo'));
}

function buildActiveNodeSnapshot(): ProjectNode {
  const board = getActiveBoard();
  const profile = normalizeCodeProfile(state.codeProfile, board);
  const activeNodeId = uiSessionStore.getActiveNodeId() || DEFAULT_NODE_ID;

  return {
    id: activeNodeId,
    boardId: board.id,
    codeProfile: profile,
    carrierId: board.carrier && state.carrierEnabled ? board.carrier.id : null,
    powerDistribution: state.powerRailMode === 'rail' ? 'rail' : 'smart',
    onboard: { ...state.onboard },
    oledPaged: Boolean(state.oledPaged),
    modules: state.active.map((i) => ({
      compId: i.compId,
      i2cHeader: i.i2cHeader || null,
      ...(i.i2cAddrOverride ? { i2cAddrOverride: i.i2cAddrOverride } : {}),
      pinMap: { ...i.pinMap },
      ...(i.attachments && Object.keys(i.attachments).length ? { attachments: { ...i.attachments } } : {}),
      position: i.customPos
        ? {
            x: Math.round(i.customPos.x),
            y: Math.round(i.customPos.y),
            ...(i.customPos.w ? { w: Math.round(i.customPos.w) } : {}),
            ...(i.customPos.h ? { h: Math.round(i.customPos.h) } : {})
          }
        : null,
      rotation: i.rotation || 0
    })),
    codeBlocks: (state.codeBlocks || []).map((b) => ({
      type: b.type,
      config: { ...(b.config || {}) }
    }))
  };
}

export function serializeProjectDocument(): ProjectDocument {
  const prop = hasProposalContent(state.proposal) ? cloneProposal(state.proposal) : undefined;
  const activeNode = buildActiveNodeSnapshot();
  const allNodes = nodeGraphStore.mergeActiveNodeIntoList(activeNode);
  const links = nodeGraphStore.getLinks();

  return {
    schema: PROJECT_SCHEMA_ID,
    appVersion: APP_VERSION,
    name: getCleanProjectName(),
    nodes: allNodes,
    links,
    ...(prop ? { proposal: prop } : {}),
    uiPrefs: {
      wireMode: state.wireMode === 'curved' ? 'curved' : 'smart',
      snapToGrid: Boolean(state.snapToGrid),
      codeHints: state.codeHints !== false
    }
  };
}

export async function applyProjectDocument(rawDoc: unknown, pushHistory = true): Promise<void> {
  const doc = validateProjectDocument(rawDoc);
  const primaryNode = doc.nodes[0];
  if (pushHistory) pushUndoState();

  // Preserve entire multi-node graph (secondary nodes & inter-node links) in central store
  nodeGraphStore.syncFromDocument(doc);
  uiSessionStore.setActiveNodeId(primaryNode.id || DEFAULT_NODE_ID);

  const resolvedBoardId = getBoardById(primaryNode.boardId) ? primaryNode.boardId : DEFAULT_BOARD_ID;
  if (resolvedBoardId !== state.boardId) {
    await appBus.invoke('board:switch', { boardId: resolvedBoardId, opts: { force: true, skipUndo: true, preserveState: true } });
  }

  const board = getActiveBoard();
  state.codeProfile = normalizeCodeProfile(primaryNode.codeProfile, board);
  state.carrierEnabled = Boolean(board.carrier && primaryNode.carrierId === board.carrier.id);
  setActiveCarrierEnabled(state.carrierEnabled);
  state.powerRailMode = primaryNode.powerDistribution === 'rail' ? 'rail' : 'smart';

  const validActive: ActiveComponentInstance[] = [];
  for (const m of primaryNode.modules) {
    const def = getCompDef(m.compId);
    if (!def) continue;
    await loadComponentSvg(def.svgFile);
    validActive.push({
      instanceId: 'inst_' + state.nextInst++,
      compId: m.compId,
      i2cHeader: m.i2cHeader || null,
      i2cAddrOverride: m.i2cAddrOverride || null,
      pinMap: { ...m.pinMap },
      attachments: m.attachments ? { ...m.attachments } : {},
      customPos: m.position ? { ...m.position } : null,
      rotation: Number(m.rotation) || 0
    });
  }

  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) {
    state.onboard[ob.id] = Boolean(primaryNode.onboard[ob.id]);
  }
  if (board.capabilities.hasWirelessSlot) {
    state.onboard.onboard_wireless = Boolean(primaryNode.onboard.onboard_wireless);
  }

  state.projectName = doc.name || '';
  state.proposal = normalizeProposal(doc.proposal);
  syncProjectNameUI();
  state.oledPaged = board.onboardPeripherals.some((o) => o.modeToggle) ? Boolean(primaryNode.oledPaged) : false;
  state.wireMode = doc.uiPrefs.wireMode;
  state.snapToGrid = doc.uiPrefs.snapToGrid;
  state.codeHints = doc.uiPrefs.codeHints;
  state.active = validActive;
  state.codeBlocks = primaryNode.codeBlocks.map((b) => ({
    blockId: 'blk_' + state.nextBlockInst++,
    type: b.type,
    config: { ...b.config }
  }));
  state.editingBlockId = null;
  state.focusedId = null;
  syncWorkbenchToggles();
  appBus.emit('viewport:resetFit');
  appBus.emit('workspace:recompute');
}

export function saveProjectFile(): void {
  const doc: ProjectDocument = {
    ...serializeProjectDocument(),
    meta: {
      generator: 'K-Comp Configurator',
      author: COPYRIGHT_AUTHOR,
      source: CONFIGURATOR_REPO_URL
    }
  };
  const jsonStr = JSON.stringify(doc, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fname = `${getProjectSlug(`${getActiveBoard().id}-project`)}.kcomp.json`;
  a.download = fname;
  a.click();
  URL.revokeObjectURL(url);
  notifyToast(t('toast.saved', { file: fname }));
}

export async function shareConfigLink(): Promise<void> {
  try {
    const encoded = await encodeDocumentToHashPayload(serializeProjectDocument());
    const base = window.location.href.split('#')[0];
    const fullUrl = `${base}#cfg=${encoded}`;
    try { window.history.replaceState(null, '', `#cfg=${encoded}`); } catch (_) {}
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(fullUrl);
      notifyToast(t('toast.shareCopied'));
    } else {
      window.prompt(t('toast.sharePrompt'), fullUrl);
    }
  } catch (err) {
    console.error(err);
    notifyToast(t('toast.shareError'));
  }
}

export async function tryLoadFromUrlHash(): Promise<boolean> {
  const hash = window.location.hash || '';
  if (!hash.startsWith('#cfg=')) return false;
  try {
    const doc = await decodeDocumentFromHashPayload(hash.slice(5));
    await applyProjectDocument(doc, false);
    notifyToast(t('toast.loadedShare'));
    return true;
  } catch (err) {
    console.warn('Invalid #cfg hash ignored:', err);
    return false;
  }
}

const AUTOSAVE_KEY = 'kcomp_autosave_v1';
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function clearAutoSaveDraft(): void {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch (_) {}
}

export function scheduleAutoSave(immediate = false): void {
  if (!state.bootComplete || !state.autoSaveEnabled) return;
  if (autoSaveTimer !== null) clearTimeout(autoSaveTimer);
  const write = (): void => {
    try {
      const doc = serializeProjectDocument();
      const node = doc.nodes[0];
      const hasAnyOnboard = Object.values(node.onboard).some((v) => v === true);
      const isEmpty = doc.nodes.length <= 1 && !node.modules.length && !node.codeBlocks.length && !doc.name && !hasAnyOnboard && !doc.proposal;
      if (isEmpty) localStorage.removeItem(AUTOSAVE_KEY);
      else localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(doc));
    } catch (_) {}
  };
  if (immediate) write();
  else autoSaveTimer = setTimeout(write, 380);
}

export async function tryLoadFromAutoSave(): Promise<boolean> {
  if (!state.autoSaveEnabled) return false;
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return false;
    const doc = validateProjectDocument(JSON.parse(raw));
    const node = doc.nodes[0];
    const hasAnyOnboard = Object.values(node.onboard).some((v) => v === true);
    if (doc.nodes.length <= 1 && !node.modules.length && !node.codeBlocks.length && !doc.name && !hasAnyOnboard && !doc.proposal) {
      return false;
    }
    await applyProjectDocument(doc, false);
    return true;
  } catch (_) {
    return false;
  }
}

export interface ResetDesignOptions {
  skipUndo?: boolean;
  silent?: boolean;
}

export function resetToNewDesign(opts: ResetDesignOptions = {}): void {
  const anyOnboardOn = Object.values(state.onboard || {}).some((v) => v === true);
  const hasAnything = Boolean(
    state.active.length ||
    state.codeBlocks.length ||
    state.projectName.trim() ||
    anyOnboardOn ||
    hasProposalContent(state.proposal)
  );
  if (!opts.skipUndo && hasAnything) pushUndoState();

  nodeGraphStore.reset();
  uiSessionStore.setActiveNodeId(DEFAULT_NODE_ID);
  state.active = [];
  state.codeBlocks = [];
  state.editingBlockId = null;
  state.focusedId = null;
  state.projectName = '';
  state.proposal = createEmptyProposal();
  state.oledPaged = false;
  state.powerRailMode = 'smart';
  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) state.onboard[ob.id] = false;
  if (getActiveBoard().capabilities.hasWirelessSlot) {
    state.onboard.onboard_wireless = false;
  }
  syncProjectNameUI();
  clearAutoSaveDraft();
  try {
    if (window.location.hash.startsWith('#cfg=')) {
      window.history.replaceState(null, '', window.location.href.split('#')[0]);
    }
  } catch (_) {}
  appBus.emit('viewport:resetFit');
  appBus.emit('workspace:recompute');
  if (!opts.silent) {
    notifyToast(t('toast.newDesign'), hasAnything ? { actionLabel: t('toast.undoBtn'), onAction: () => { void performUndo(); } } : null);
  }
}

export function getPresetsForBoard(boardId: string = getActiveBoard().id): PresetDef[] {
  return (state.catalog?.presets || []).filter((p) => (p.boardId || DEFAULT_BOARD_ID) === boardId);
}

export function populatePresets(): void {
  const sel = $('#presetSelect') as HTMLSelectElement | null;
  if (!sel || !state.catalog) return;
  const presets = getPresetsForBoard(getActiveBoard().id);
  sel.innerHTML = `<option value="">${t('topbar.loadPreset')}</option>`;
  for (const p of presets) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = tPreset(p, 'name');
    sel.appendChild(opt);
  }
}

export async function loadPreset(presetId: string): Promise<void> {
  const p = state.catalog?.presets.find((x) => x.id === presetId);
  if (!p) return;
  pushUndoState();

  const targetBoardId = p.boardId || DEFAULT_BOARD_ID;
  if (targetBoardId !== state.boardId) {
    await appBus.invoke('board:switch', { boardId: targetBoardId, opts: { force: true, skipUndo: true, silent: true } });
  }

  const board = getActiveBoard();
  nodeGraphStore.reset();
  uiSessionStore.setActiveNodeId(DEFAULT_NODE_ID);
  state.active = [];
  state.focusedId = null;
  state.powerRailMode = 'smart';
  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) {
    state.onboard[ob.id] = Boolean(p.onboard && p.onboard[ob.id]);
  }
  if (board.capabilities.hasWirelessSlot) {
    state.onboard.onboard_wireless = false;
  }
  state.oledPaged = board.onboardPeripherals.some((o) => o.modeToggle) ? Boolean(p.oledPaged) : false;
  state.projectName = tPreset(p, 'name').split('(')[0].trim();
  syncProjectNameUI();
  for (const ext of p.external) await addComponent(ext.id, { ...ext, skipUndo: true });
  state.focusedId = null;
  state.needsMobileFit = false;
  if (isMobileViewport()) setMobileView('board');
  appBus.emit('viewport:resetFit');
  appBus.emit('workspace:recompute');
  notifyToast(t('toast.presetLoaded', { name: state.projectName }), {
    actionLabel: t('toast.undoBtn'),
    onAction: () => { void performUndo(); }
  });
}
