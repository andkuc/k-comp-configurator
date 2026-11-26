// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// K-Comp Configurator — TypeScript + Vite Entrypoint (v0.4.4)
import './styles/style.css';
import { resolveAssetUrl } from './core/constants';
import { CATALOG } from './catalog';
import { detectInitialBoardId, detectInitialCarrier, getActiveBoard, getBoardById, isBoardCarrierActive, listBoards, setActiveBoard, setActiveCarrierEnabled } from './boards';
import { getSupportedProfiles, normalizeCodeProfile } from './core/code-profiles';
import {
  state, $, getProjectSlug, syncProjectNameUI, showToast, getActiveOnboardDefs,
  setMobileView, updateMobileNavIndicators, syncWorkbenchToggles, initTheme, applyThemeToDom, toggleTheme, loadLayoutPrefs, saveLayoutPrefs, applyPinLegendState,
  detectInitialAutoSaveEnabled, syncAutoSaveUI, setAutoSaveEnabled
} from './core/state';
import { discoverRepoDocumentationPdfs } from './core/docs-discovery';
import { appBus, projectStore, settingsStore, type DerivedWorkspace } from './store';
import {
  addComponent, removeComponent, computeDipStates, setPowerRailMode
} from './core/hardware';
import {
  mountBoardSvg, syncCarrierVisuals, applyViewBox, resetViewFit, zoomToBoard,
  quickRotateComponent, updateResetPositionsVisibility,
  bindViewportAndDragEvents, updateBoardSvgState,
  renderDockedComponentsAndWires, exportMasterSvg, setHoveredNet, setHwHover, flashTarget, panToComponent
} from './ui/workbench';
import {
  bindSidebarResizer, bindInspectorResizer, renderOnboardBar, renderDipStrip,
  renderCategoryTabs, renderCatalogList, renderSram, renderCurrent,
  renderWarnings, renderActiveComponentsInspector,
  showPinTooltip, showCustomTooltip, moveTooltip, hideTooltip
} from './ui/inspector';
import { renderSketchCode } from './core/codegen';
import { renderCodeBlocksUI, bindCodeBlocksEvents, setSpotlightBlock } from './ui/code-blocks-panel';
// Lazy-loaded modules (block-guide & project charter are loaded on demand via dynamic import())
import { renderApiBrowserUI, bindApiBrowserEvents } from './ui/api-browser';
import { updateInfoModalDocLink, openComponentInfo, openPrintStopSheet, openSvgLibrary, openAboutModal, openSettingsModal, closeSettingsModal, renderSettingsModalBody } from './ui/modals';
import {
  captureSnapshot, pushUndoState, updateHistoryButtons, performUndo, performRedo,
  applyProjectDocument, saveProjectFile, shareConfigLink, tryLoadFromUrlHash,
  populatePresets, loadPreset, scheduleAutoSave, clearAutoSaveDraft, tryLoadFromAutoSave, resetToNewDesign
} from './core/persistence';
import {
  initI18nAsync, t, applyI18nToDom, renderLanguageSwitcher, onLocaleChange, closeLanguageMenu
} from './i18n/index';
import { initWorkspaceShell, renderActiveWorkspaceStage, renderWorkspaceSwitcher } from './workspaces';



let blockGuideModPromise: Promise<typeof import('./ui/block-guide')> | null = null;
let blockGuideEventsBound = false;
function loadBlockGuideMod() {
  if (!blockGuideModPromise) {
    blockGuideModPromise = import('./ui/block-guide').then((mod) => {
      if (!blockGuideEventsBound) {
        blockGuideEventsBound = true;
        mod.bindBlockGuideEvents();
      }
      return mod;
    });
  }
  return blockGuideModPromise;
}

async function openProjectCharterLazy() {
  const { openProjectCharter } = await import('./ui/charter');
  openProjectCharter();
}

function openBlockInfoLazy(type: string) {
  void loadBlockGuideMod().then((m) => m.openBlockInfo(type));
}

function openBlocksOverviewLazy() {
  void loadBlockGuideMod().then((m) => m.openBlocksOverview());
}

function closeBlockInfoModalSafe() {
  if (blockGuideModPromise) {
    void blockGuideModPromise.then((m) => m.closeBlockInfoModal());
  } else {
    $('#blockInfoModal')?.classList.add('hidden');
    state.openBlockInfo = null;
  }
}

function refreshOpenBlockInfoSafe() {
  if (blockGuideModPromise && state.openBlockInfo) {
    void blockGuideModPromise.then((m) => m.refreshOpenBlockInfo());
  }
}

function syncBoardHeaderUI() {
  const board = getActiveBoard();
  const badgeEl = $('#brandBadge');
  const titleEl = $('#brandBoardTitle');
  const sel = $('#boardSelect');
  if (badgeEl) badgeEl.textContent = board.badge;
  if (titleEl) titleEl.textContent = board.shortName;
  if (sel) {
    sel.innerHTML = listBoards().map((b) =>
      `<option value="${b.id}"${b.id === board.id ? ' selected' : ''}>${b.shortName}</option>`
    ).join('');
    sel.value = board.id;
  }
  syncCodeProfileUI();
  syncCarrierToggleUI();
}

function syncCarrierToggleUI() {
  const board = getActiveBoard();
  const btn = $('#btnCarrierToggle');
  if (!btn) return;
  const hasCarrier = !!board.carrier;
  btn.classList.toggle('hidden', !hasCarrier);
  if (!hasCarrier) return;
  const on = isBoardCarrierActive(board, state.carrierEnabled);
  btn.classList.toggle('is-active', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? `⊞ ${t('hud.carrierOn')}` : `⊞ ${t('hud.carrierOff')}`;
}

function syncCodeProfileUI() {
  const board = getActiveBoard();
  const sel = $('#codeProfileSelect');
  if (!sel) return;
  const profiles = getSupportedProfiles(board);
  state.codeProfile = normalizeCodeProfile(state.codeProfile, board);
  if (profiles.length <= 1 || !settingsStore.getFeature('codeProfiles')) {
    sel.classList.add('hidden');
    return;
  }
  sel.classList.remove('hidden');
  sel.innerHTML = profiles.map((p) =>
    `<option value="${p.id}"${p.id === state.codeProfile ? ' selected' : ''}>${t(p.labelKey)}</option>`
  ).join('');
  sel.value = state.codeProfile;
}


function applyFeatureSettingsToDom() {
  const { preset, features } = settingsStore.get();

  // Level badge inside Project menu
  const lvlBadge = $('#menuSettingsBadge');
  if (lvlBadge) {
    const key = preset === 'beginner'
      ? 'settings.badgeBeginner'
      : (preset === 'intermediate'
          ? 'settings.badgeIntermediate'
          : (preset === 'professional' ? 'settings.badgePro' : 'settings.badgeCustom'));
    lvlBadge.textContent = t(key);
  }

  // Advanced canvas wire/grid/breadboard HUD popover button
  const hudBtn = $('#btnHudOptions');
  if (hudBtn) {
    hudBtn.classList.toggle('hidden', !features.advancedWireTools);
    if (!features.advancedWireTools) closeHudOptions();
  }

  // Code Structure Blocks drawer & active chips bar
  const blocksBtn = $('#btnToggleBlocksDrawer');
  const blocksActive = $('#codeBlocksActive');
  const blocksDrawer = $('#codeBlocksDrawer');
  const blockEditor = $('#codeBlockEditor');
  if (blocksBtn) blocksBtn.classList.toggle('hidden', !features.codeBlocks);
  if (!features.codeBlocks) {
    state.blocksDrawerOpen = false;
    blocksActive?.classList.add('hidden');
    blocksDrawer?.classList.add('hidden');
    blockEditor?.classList.add('hidden');
  } else {
    blocksActive?.classList.remove('hidden');
  }

  // Library API Reference drawer
  const apiBtn = $('#btnToggleApiDrawer');
  const apiDrawer = $('#apiRefDrawer');
  const apiResizer = $('#apiCodeResizer');
  if (apiBtn) apiBtn.classList.toggle('hidden', !features.apiBrowser);
  if (!features.apiBrowser) {
    state.apiDrawerOpen = false;
    apiDrawer?.classList.add('hidden');
    apiResizer?.classList.add('hidden');
  }

  // Code Profile selector
  syncCodeProfileUI();
}

async function switchBoard(targetBoardId: string, opts: any = {}) {
  const target = getBoardById(targetBoardId);
  if (!target) return;
  const current = getActiveBoard();
  if (target.id === current.id && state.boardSvgEl) {
    syncBoardHeaderUI();
    return;
  }

  if (!opts.force && state.active.length > 0) {
    const ok = window.confirm(t('board.switchConfirm', { board: target.name }));
    if (!ok) {
      syncBoardHeaderUI();
      return;
    }
  }

  if (!opts.skipUndo && state.bootComplete) pushUndoState();

  const boardRes = await fetch(resolveAssetUrl(target.svgAsset));
  if (!boardRes.ok) throw new Error('Board SVG load failed');
  const svgText = await boardRes.text();

  setActiveBoard(target.id);
  state.boardId = target.id;
  state.codeProfile = normalizeCodeProfile(opts.codeProfile, target);
  state.carrierEnabled = typeof opts.carrierEnabled === 'boolean' ? opts.carrierEnabled : Boolean(target.carrier?.defaultEnabled);
  setActiveCarrierEnabled(state.carrierEnabled);

  if (!opts.preserveState) {
    state.active = [];
    state.placedEntries = [];
    state.breadboardRails = [];
    state.focusedId = null;
    state.onboard = {};
    for (const ob of getActiveOnboardDefs()) {
      state.onboard[ob.id] = false;
    }
    if (target.capabilities.hasWirelessSlot) {
      state.onboard.onboard_wireless = false;
    }
    state.oledPaged = false;
  }

  mountBoardSvg(svgText);
  syncBoardHeaderUI();
  renderWorkspaceSwitcher();
  renderActiveWorkspaceStage();
  populatePresets();

  if (!opts.preserveState) {
    if (window.innerWidth <= 960) zoomToBoard();
    else resetViewFit();
    recomputeAndRender();
    if (state.bootComplete && !opts.silent) {
      showToast(t('toast.boardSwitched', { board: target.name }));
    }
  }
}

function renderWorkspaceViews(derived: DerivedWorkspace) {
  const { dipStates, warnings, sram, usbCurrent } = derived;

  syncCarrierVisuals();
  syncCarrierToggleUI();
  updateBoardSvgState(dipStates);
  renderDockedComponentsAndWires();
  renderOnboardBar(dipStates);
  renderDipStrip(dipStates);
  renderCatalogList();
  renderSram(sram);
  renderCurrent(usbCurrent);
  renderWarnings(warnings);
  renderActiveComponentsInspector(dipStates);
  renderCodeBlocksUI();
  renderApiBrowserUI();
  renderSketchCode(dipStates);
  updateResetPositionsVisibility();
  updateMobileNavIndicators(warnings);
  renderActiveWorkspaceStage(derived);
  scheduleAutoSave();
}

function recomputeAndRender() {
  projectStore.recompute();
}

// Wire central ProjectStore & Typed Application Event/Command Bus once before bootstrapping
projectStore.subscribe(renderWorkspaceViews);
settingsStore.subscribe(() => {
  applyFeatureSettingsToDom();
  if (state.bootComplete) recomputeAndRender();
});
appBus.on('ui:toast', ({ msg, opts }) => showToast(msg, opts ?? null));
appBus.on('codeblock:spotlight', ({ blockId }) => setSpotlightBlock(blockId));
appBus.on('history:push', () => pushUndoState());
appBus.on('history:undo', () => { void performUndo(); });
appBus.on('history:updateButtons', () => updateHistoryButtons());
appBus.on('modal:openComponentInfo', ({ compId }) => openComponentInfo(compId));
appBus.on('modal:openBlockInfo', ({ type }) => openBlockInfoLazy(type));
appBus.on('modal:openBlocksOverview', () => openBlocksOverviewLazy());
appBus.on('modal:updateInfoDocLink', ({ def }) => {
  if (!$('#compInfoModal')?.classList.contains('hidden')) updateInfoModalDocLink(def);
});
appBus.on('tooltip:showPin', ({ pinId, ev }) => showPinTooltip(pinId, ev));
appBus.on('tooltip:showCustom', ({ html, ev }) => showCustomTooltip(html, ev));
appBus.on('tooltip:move', ({ ev }) => moveTooltip(ev));
appBus.on('tooltip:hide', () => hideTooltip());
appBus.on('hover:net', ({ netId }) => setHoveredNet(netId));
appBus.on('hover:hw', ({ hwId }) => setHwHover(hwId));
appBus.on('viewport:applyViewBox', () => applyViewBox());
appBus.on('viewport:resetFit', () => resetViewFit());
appBus.on('viewport:zoomToBoard', () => zoomToBoard());
appBus.on('viewport:panToComponent', ({ instanceId }) => panToComponent(instanceId));
appBus.on('target:flash', (opts) => flashTarget(opts));
appBus.on('preset:load', ({ presetId }) => { void loadPreset(presetId); });
appBus.handle('history:captureSnapshot', () => captureSnapshot());
appBus.handle('board:switch', ({ boardId, opts }) => switchBoard(boardId, opts));

function closeProjectMenu() {
  const menu = $('#projectMenuPopover');
  const btn = $('#btnProjectMenu');
  if (menu) menu.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function closeMobileMenu() {
  const menuBox = $('#topbarActions');
  const menuBtn = $('#btnMobileMenu');
  if (menuBox) menuBox.classList.remove('open');
  if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
}

function closeHudOptions() {
  const pop = $('#hudOptionsPopover');
  const btn = $('#btnHudOptions');
  if (pop) pop.classList.add('hidden');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function refreshLanguageUI() {
  applyI18nToDom();
  syncProjectNameUI();
  syncWorkbenchToggles();
  syncAutoSaveUI();
  applyPinLegendState();
  applyThemeToDom();
  syncBoardHeaderUI();
  populatePresets();
  renderCategoryTabs();
  renderLanguageSwitcher($('#langSwitchSlot'), (loc) => {
    showToast(t('toast.langSwitched', { name: loc.nativeName }));
  });
  recomputeAndRender();

  if (state.openInfoCompId && !$('#compInfoModal')?.classList.contains('hidden')) {
    openComponentInfo(state.openInfoCompId);
  }
  if (!$('#printModal')?.classList.contains('hidden')) {
    if (state.printModalTab === 'charter') void openProjectCharterLazy();
    else openPrintStopSheet();
  }
  if (!$('#svgModal')?.classList.contains('hidden')) {
    openSvgLibrary();
  }
  applyFeatureSettingsToDom();
  if (!$('#aboutModal')?.classList.contains('hidden')) {
    openAboutModal();
  }
  if (!$('#settingsModal')?.classList.contains('hidden')) {
    renderSettingsModalBody();
  }
  refreshOpenBlockInfoSafe();
}

function bindUIEvents() {
  $('#searchInput').addEventListener('input', (e: any) => { state.search = e.target.value; renderCatalogList(); });
  $('#searchInput').addEventListener('keydown', (e: any) => {
    if (e.key !== 'Enter') return;
    const first = $('#catalogList .cat-item:not(.maxed)');
    if (first && first.dataset.add) {
      e.preventDefault();
      addComponent(first.dataset.add);
    }
  });

  const projInp = $('#projectNameInput');
  if (projInp) {
    projInp.addEventListener('input', (e: any) => {
      state.projectName = e.target.value;
      syncProjectNameUI();
      renderSketchCode(computeDipStates());
    });
  }

  $('#presetSelect').addEventListener('change', (e: any) => { if (e.target.value) loadPreset(e.target.value); e.target.value = ''; });
  $('#boardSelect')?.addEventListener('change', (e: any) => {
    if (e.target.value) switchBoard(e.target.value);
  });
  $('#codeProfileSelect')?.addEventListener('change', (e: any) => {
    state.codeProfile = normalizeCodeProfile(e.target.value, getActiveBoard());
    renderSketchCode(computeDipStates());
    scheduleAutoSave();
  });
  $('#btnCarrierToggle')?.addEventListener('click', () => {
    const board = getActiveBoard();
    if (!board.carrier) return;
    pushUndoState();
    state.carrierEnabled = !state.carrierEnabled;
    setActiveCarrierEnabled(state.carrierEnabled);
    syncCarrierVisuals();
    syncCarrierToggleUI();
    resetViewFit();
    recomputeAndRender();
    showToast(state.carrierEnabled ? t('toast.carrierOn') : t('toast.carrierOff'));
  });

  $('#btnNewDesign')?.addEventListener('click', () => {
    closeProjectMenu();
    resetToNewDesign();
  });

  $('#btnAutoSaveToggle')?.addEventListener('click', () => {
    const next = !state.autoSaveEnabled;
    setAutoSaveEnabled(next);
    if (next) {
      scheduleAutoSave(true);
      showToast(t('toast.autoSaveEnabled'));
    } else {
      clearAutoSaveDraft();
      showToast(t('toast.autoSaveDisabled'));
    }
  });

  $('#btnClearAll').addEventListener('click', () => {
    closeProjectMenu();
    if (!state.active.length && !state.codeBlocks.length) return;
    pushUndoState();
    state.active = [];
    state.codeBlocks = [];
    state.editingBlockId = null;
    state.focusedId = null;
    recomputeAndRender();
    showToast(t('toast.clearedBoard'), { actionLabel: t('toast.undoBtn'), onAction: () => performUndo() });
  });

  $('#btnThemeToggle')?.addEventListener('click', () => {
    const next = toggleTheme();
    showToast(next === 'light' ? t('toast.themeLight') : t('toast.themeDark'));
    renderDockedComponentsAndWires();
    refreshOpenBlockInfoSafe();
  });

  $('#btnUndo').addEventListener('click', performUndo);
  $('#btnRedo').addEventListener('click', performRedo);
  $('#btnShareLink').addEventListener('click', () => { closeProjectMenu(); shareConfigLink(); });
  $('#btnSaveProject').addEventListener('click', () => { closeProjectMenu(); saveProjectFile(); });
  $('#btnLoadProject').addEventListener('click', () => { closeProjectMenu(); $('#projectFileInput').click(); });

  $('#projectFileInput').addEventListener('change', async (e: any) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      await applyProjectDocument(JSON.parse(text), true);
      showToast(t('toast.loadedFile', { file: file.name }));
    } catch (err) {
      console.error(err);
      showToast(t('toast.loadError'));
    }
  });

  $('#btnPrintStop').addEventListener('click', () => { closeProjectMenu(); openPrintStopSheet(); });
  $('#btnProjectCharter')?.addEventListener('click', () => { closeProjectMenu(); void openProjectCharterLazy(); });
  $('#btnPrintTabLab')?.addEventListener('click', () => openPrintStopSheet());
  $('#btnPrintTabCharter')?.addEventListener('click', () => { void openProjectCharterLazy(); });
  $('#btnPrintShareLink')?.addEventListener('click', () => shareConfigLink());
  $('#btnDoPrint').addEventListener('click', () => window.print());
  $('#btnClosePrintModal').addEventListener('click', () => $('#printModal').classList.add('hidden'));
  $('#printModal').addEventListener('click', (e: any) => { if (e.target === $('#printModal')) $('#printModal').classList.add('hidden'); });

  const hudOptBtn = $('#btnHudOptions');
  const hudOptPop = $('#hudOptionsPopover');
  if (hudOptBtn && hudOptPop) {
    hudOptBtn.addEventListener('click', (e: any) => {
      e.stopPropagation();
      const willOpen = hudOptPop.classList.contains('hidden');
      hudOptPop.classList.toggle('hidden', !willOpen);
      hudOptBtn.setAttribute('aria-expanded', String(willOpen));
    });
    document.addEventListener('click', (e: any) => {
      if (!hudOptPop.contains(e.target) && e.target !== hudOptBtn) closeHudOptions();
    });
  }

  $('#btnPinLegendToggle')?.addEventListener('click', (e: any) => {
    e.stopPropagation();
    state.pinLegendCollapsed = !state.pinLegendCollapsed;
    applyPinLegendState();
    saveLayoutPrefs();
  });

  $('#btnWireMode').addEventListener('click', () => {
    state.wireMode = state.wireMode === 'smart' ? 'curved' : 'smart';
    syncWorkbenchToggles();
    showToast(state.wireMode === 'smart' ? t('toast.wireSmart') : t('toast.wireCurved'));
    renderDockedComponentsAndWires();
  });
  $('#btnSnapGrid').addEventListener('click', () => {
    state.snapToGrid = !state.snapToGrid;
    syncWorkbenchToggles();
    showToast(state.snapToGrid ? t('toast.gridOn') : t('toast.gridOff'));
  });
  $('#btnAutoLayout')?.addEventListener('click', () => closeHudOptions());
  $('#btnResetPositions')?.addEventListener('click', () => closeHudOptions());

  // Bidirectional Code (.ino) <-> PCB Hardware Hover Highlighting
  const codeOut = $('#codeOutput');
  if (codeOut) {
    codeOut.addEventListener('mouseover', (e: any) => {
      const line = e.target.closest('.code-line[data-hw-id]');
      setHwHover(line ? line.dataset.hwId : null);
    });
    codeOut.addEventListener('mouseleave', () => setHwHover(null));
    codeOut.addEventListener('click', (e: any) => {
      const line = e.target.closest('.code-line[data-hw-id]');
      if (!line) return;
      const hwId = line.dataset.hwId;
      if (hwId.startsWith('onboard_')) {
        flashTarget({ onboardId: hwId });
      } else {
        state.focusedId = hwId;
        recomputeAndRender();
        flashTarget({ instanceId: hwId, panIfOffscreen: true });
      }
    });
  }

  const helpBtn = $('#btnShortcutsHelp');
  const helpPop = $('#shortcutsPopover');
  if (helpBtn && helpPop) {
    helpBtn.addEventListener('click', (e: any) => {
      e.stopPropagation();
      const willOpen = helpPop.classList.contains('hidden');
      helpPop.classList.toggle('hidden', !willOpen);
      helpBtn.setAttribute('aria-expanded', String(willOpen));
    });
    document.addEventListener('click', (e: any) => {
      if (!helpPop.contains(e.target) && e.target !== helpBtn) {
        helpPop.classList.add('hidden');
        helpBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.querySelectorAll<any>('#codeJumpBar [data-jump-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.jumpTarget;
      const lineEl = $(`#codeOutput .code-line[data-jump="${target}"]`);
      if (lineEl) {
        lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        lineEl.classList.add('is-jump-flash');
        setTimeout(() => lineEl.classList.remove('is-jump-flash'), 1100);
      }
    });
  });

  document.querySelectorAll<any>('.grp-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.groupMode = btn.dataset.groupMode;
      state.category = 'All';
      renderCategoryTabs();
      renderCatalogList();
    });
  });

  $('#btnOledMode').addEventListener('click', () => {
    pushUndoState();
    state.oledPaged = !state.oledPaged;
    showToast(state.oledPaged ? t('toast.oledPaged') : t('toast.oledFull'));
    recomputeAndRender();
  });

  $('#btnCloseInfoModal').addEventListener('click', () => { state.openInfoCompId = null; $('#compInfoModal').classList.add('hidden'); });
  $('#compInfoModal').addEventListener('click', (e: any) => { if (e.target === $('#compInfoModal')) { state.openInfoCompId = null; $('#compInfoModal').classList.add('hidden'); } });
  $('#btnInfoAddComp').addEventListener('click', async () => {
    const cid = $('#btnInfoAddComp').dataset.compId;
    if (!cid) return;
    state.openInfoCompId = null;
    $('#compInfoModal').classList.add('hidden');
    await addComponent(cid);
  });


  const projMenuBtn = $('#btnProjectMenu');
  const projMenuPop = $('#projectMenuPopover');
  if (projMenuBtn && projMenuPop) {
    projMenuBtn.addEventListener('click', (e: any) => {
      e.stopPropagation();
      closeLanguageMenu();
      const isOpen = projMenuPop.classList.toggle('open');
      projMenuBtn.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', (e: any) => {
      if (!projMenuPop.contains(e.target) && e.target !== projMenuBtn) {
        closeProjectMenu();
      }
    });
  }

  document.addEventListener('keydown', (e: any) => {
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    const inInput = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (e.key === 'Escape') {
      closeProjectMenu();
      closeLanguageMenu();
      closeMobileMenu();
      closeHudOptions();
      state.openInfoCompId = null;
      $('#compInfoModal').classList.add('hidden');
      $('#svgModal').classList.add('hidden');
      $('#printModal').classList.add('hidden');
      $('#aboutModal')?.classList.add('hidden');
      closeSettingsModal();
      closeBlockInfoModalSafe();
      $('#shortcutsPopover')?.classList.add('hidden');
      $('#btnShortcutsHelp')?.setAttribute('aria-expanded', 'false');
      setHoveredNet(null);
      setHwHover(null);
      hideTooltip();
      if (state.focusedId) {
        state.focusedId = null;
        recomputeAndRender();
      }
      return;
    }
    if (inInput) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) performRedo();
      else performUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      performRedo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveProjectFile();
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'Delete' || e.key === 'Backspace') && state.focusedId) {
      e.preventDefault();
      removeComponent(state.focusedId);
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'r' && state.focusedId) {
      e.preventDefault();
      quickRotateComponent(state.focusedId, e.shiftKey ? -90 : 90);
    }
  });

  $('#btnExportDiagram').addEventListener('click', () => { closeProjectMenu(); exportMasterSvg(); });
  $('#btnSvgLibrary').addEventListener('click', () => { closeProjectMenu(); openSvgLibrary(); });
  $('#btnCloseModal').addEventListener('click', () => $('#svgModal').classList.add('hidden'));
  $('#svgModal').addEventListener('click', (e: any) => { if (e.target === $('#svgModal')) $('#svgModal').classList.add('hidden'); });
  $('#btnOpenSettings')?.addEventListener('click', () => { closeProjectMenu(); openSettingsModal(); });
  $('#btnCloseSettingsModal')?.addEventListener('click', () => closeSettingsModal());
  $('#settingsModal')?.addEventListener('click', (e: any) => { if (e.target === $('#settingsModal')) closeSettingsModal(); });
  $('#btnOpenAbout')?.addEventListener('click', () => { closeProjectMenu(); openAboutModal(); });
  $('#btnFooterAbout')?.addEventListener('click', () => openAboutModal());
  $('#btnCloseAboutModal')?.addEventListener('click', () => $('#aboutModal')?.classList.add('hidden'));
  $('#aboutModal')?.addEventListener('click', (e: any) => { if (e.target === $('#aboutModal')) $('#aboutModal').classList.add('hidden'); });

  $('#btnCopyCode').addEventListener('click', async () => {
    await navigator.clipboard.writeText(state.latestSketch || $('#codeOutput code').textContent);
    $('#btnCopyCode').textContent = t('inspector.copied');
    setTimeout(() => { $('#btnCopyCode').textContent = t('inspector.copyCode'); }, 1300);
  });
  $('#btnDownloadIno').addEventListener('click', () => {
    const blob = new Blob([state.latestSketch || $('#codeOutput code').textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${getProjectSlug(`${getActiveBoard().id}_init`).replace(/-/g, '_')}.ino`; a.click();
    URL.revokeObjectURL(url);
  });

  document.querySelectorAll<any>('.itab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll<any>('.itab').forEach((tb) => tb.classList.remove('active'));
      document.querySelectorAll<any>('.tab-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      $('#' + tab.dataset.tab).classList.add('active');
    });
  });

  $('#masterSvg').addEventListener('click', (e: any) => {
    if (state.suppressClick || e.target.closest('.comp-card-svg') || e.target.closest('.wire-drag-handle') || e.target.closest('[data-dip]') || e.target.closest('.ob-pcb-hit')) return;
    if (state.focusedId) { state.focusedId = null; recomputeAndRender(); }
  });

  document.querySelectorAll<any>('.mnav-btn').forEach((btn) => {
    btn.addEventListener('click', () => setMobileView(btn.dataset.mview));
  });

  const menuBtn = $('#btnMobileMenu');
  const menuBox = $('#topbarActions');
  if (menuBtn && menuBox) {
    menuBtn.addEventListener('click', (e: any) => {
      e.stopPropagation();
      const isOpen = menuBox.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(isOpen));
    });
    menuBox.addEventListener('click', (e: any) => {
      if (e.target.closest('.lang-menu-wrap') || e.target.closest('#btnProjectMenu')) return;
      closeMobileMenu();
    });
    document.addEventListener('click', (e: any) => {
      if (!menuBox.contains(e.target) && e.target !== menuBtn) {
        closeMobileMenu();
      }
    });
  }

  window.addEventListener('resize', () => {
    applyViewBox();
  });
}

async function init() {
  try {
    await initI18nAsync();
    settingsStore.init();
    initTheme();
    applyI18nToDom();
    applyThemeToDom();
    renderLanguageSwitcher($('#langSwitchSlot'), (loc) => {
      showToast(t('toast.langSwitched', { name: loc.nativeName }));
    });
    onLocaleChange(() => refreshLanguageUI());

    const initialBoardId = detectInitialBoardId();
    const boardProfile = setActiveBoard(initialBoardId);
    state.boardId = boardProfile.id;
    state.codeProfile = boardProfile.defaultCodeProfile;
    state.carrierEnabled = detectInitialCarrier(boardProfile);
    setActiveCarrierEnabled(state.carrierEnabled);
    const boardRes = await fetch(resolveAssetUrl(boardProfile.svgAsset));
    if (!boardRes.ok) throw new Error('HTTP load failed');
    state.catalog = CATALOG;
    mountBoardSvg(await boardRes.text());

    state.onboard = {};
    for (const ob of getActiveOnboardDefs()) {
      state.onboard[ob.id] = false;
    }
    if (boardProfile.capabilities.hasWirelessSlot) {
      state.onboard.onboard_wireless = false;
    }
    syncBoardHeaderUI();

    populatePresets();
    renderCategoryTabs();
    bindUIEvents();
    bindCodeBlocksEvents();
    bindApiBrowserEvents();
    bindViewportAndDragEvents();
    bindSidebarResizer();
    bindInspectorResizer();
    syncProjectNameUI();

    loadLayoutPrefs();
    state.autoSaveEnabled = detectInitialAutoSaveEnabled();
    syncAutoSaveUI();
    const loadedFromHash = await tryLoadFromUrlHash();
    const loadedFromAuto = !loadedFromHash ? await tryLoadFromAutoSave() : false;
    if (!loadedFromHash && !loadedFromAuto) {
      if (window.innerWidth <= 960) zoomToBoard();
      else applyViewBox();
    } else if (loadedFromAuto) {
      showToast(t('toast.restoredAutoSave'), {
        actionLabel: t('toast.newDesignBtn'),
        duration: 5000,
        onAction: () => resetToNewDesign()
      });
    }
    state.bootComplete = true;
    updateHistoryButtons();
    syncWorkbenchToggles();
    syncAutoSaveUI();
    applyThemeToDom();
    applyFeatureSettingsToDom();
    initWorkspaceShell();
    recomputeAndRender();

    state.repoDocsPromise = discoverRepoDocumentationPdfs();
  } catch (err) {
    console.error('K-Comp Configurator init failed:', err);
    const banner = $('#corsBanner');
    if (banner) {
      const isFileOrFetch = window.location.protocol === 'file:' ||
        (err && (err.message === 'HTTP load failed' || err.name === 'TypeError' && /fetch/i.test(err.message)));
      if (!isFileOrFetch) {
        banner.innerHTML = `<strong>Startup error:</strong> <code>${String(err && err.message ? err.message : err).replaceAll('<', '&lt;')}</code> (see browser DevTools Console for details).`;
      }
      banner.classList.remove('hidden');
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
