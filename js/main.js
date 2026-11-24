// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// K-Comp Configurator — ES Module Entrypoint (v0.1.0)
import { ASSET_VERSION } from './modules/constants.js?v=0.1.0';
import {
  state, hooks, $, getProjectSlug, syncProjectNameUI, showToast,
  setMobileView, updateMobileNavIndicators, syncWorkbenchToggles, initTheme, applyThemeToDom, toggleTheme, loadLayoutPrefs, saveLayoutPrefs, applyPinLegendState,
  detectInitialAutoSaveEnabled, syncAutoSaveUI, setAutoSaveEnabled
} from './modules/state.js?v=0.1.0';
import { discoverRepoDocumentationPdfs } from './modules/docs-discovery.js?v=0.1.0';
import {
  addComponent, removeComponent, computeDipStates, computeCriticalWarnings, computeSramBreakdown, computeUsbCurrent
} from './modules/hardware.js?v=0.1.0';
import {
  mountBoardSvg, applyViewBox, resetViewFit, zoomToBoard,
  quickRotateComponent, updateResetPositionsVisibility,
  bindViewportAndDragEvents, updateBoardSvgState,
  renderDockedComponentsAndWires, exportMasterSvg, setHoveredNet, setHwHover, flashTarget, panToComponent
} from './modules/workbench.js?v=0.1.0';
import {
  bindSidebarResizer, bindInspectorResizer, renderOnboardBar, renderDipStrip,
  renderCategoryTabs, renderCatalogList, renderSram, renderCurrent,
  renderWarnings, renderActiveComponentsInspector,
  showPinTooltip, showCustomTooltip, moveTooltip, hideTooltip
} from './modules/inspector.js?v=0.1.0';
import { renderSketchCode } from './modules/codegen.js?v=0.1.0';
import { renderCodeBlocksUI, bindCodeBlocksEvents } from './modules/code-blocks.js?v=0.1.0';
import { openBlockInfo, openBlocksOverview, closeBlockInfoModal, refreshOpenBlockInfo, bindBlockGuideEvents } from './modules/block-guide.js?v=0.1.0';
import { renderApiBrowserUI, bindApiBrowserEvents } from './modules/api-browser.js?v=0.1.0';
import { updateInfoModalDocLink, openComponentInfo, openPrintStopSheet, openSvgLibrary, openAboutModal } from './modules/modals.js?v=0.1.0';
import {
  captureSnapshot, pushUndoState, updateHistoryButtons, performUndo, performRedo,
  applyProjectPayload, saveProjectFile, shareConfigLink, tryLoadFromUrlHash,
  populatePresets, loadPreset, scheduleAutoSave, clearAutoSaveDraft, tryLoadFromAutoSave, resetToNewDesign
} from './modules/persistence.js?v=0.1.0';
import {
  initI18n, t, applyI18nToDom, renderLanguageSwitcher, onLocaleChange, closeLanguageMenu
} from './i18n/index.js?v=0.1.0';

function recomputeAndRender() {
  const dipStates = computeDipStates();
  const warnings = computeCriticalWarnings();
  const sramInfo = computeSramBreakdown();
  const usbCurrent = computeUsbCurrent();

  updateBoardSvgState(dipStates);
  renderDockedComponentsAndWires();
  renderOnboardBar(dipStates);
  renderDipStrip(dipStates);
  renderCatalogList();
  renderSram(sramInfo);
  renderCurrent(usbCurrent);
  renderWarnings(warnings);
  renderActiveComponentsInspector(dipStates);
  renderCodeBlocksUI();
  renderApiBrowserUI();
  renderSketchCode(dipStates);
  updateResetPositionsVisibility();
  updateMobileNavIndicators(warnings);
  scheduleAutoSave();
}

// Register acyclic cross-module hooks once before bootstrapping
Object.assign(hooks, {
  recomputeAndRender,
  pushUndoState,
  performUndo,
  captureSnapshot,
  updateHistoryButtons,
  openComponentInfo,
  openBlockInfo,
  openBlocksOverview,
  updateInfoModalDocLink,
  showPinTooltip,
  showCustomTooltip,
  moveTooltip,
  hideTooltip,
  setHoveredNet,
  applyViewBox,
  resetViewFit,
  zoomToBoard,
  loadPreset,
  setHwHover,
  flashTarget,
  panToComponent
});

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
    openPrintStopSheet();
  }
  if (!$('#svgModal')?.classList.contains('hidden')) {
    openSvgLibrary();
  }
  if (!$('#aboutModal')?.classList.contains('hidden')) {
    openAboutModal();
  }
  refreshOpenBlockInfo();
}

function bindUIEvents() {
  $('#searchInput').addEventListener('input', (e) => { state.search = e.target.value; renderCatalogList(); });
  $('#searchInput').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = $('#catalogList .cat-item:not(.maxed)');
    if (first && first.dataset.add) {
      e.preventDefault();
      addComponent(first.dataset.add);
    }
  });

  const projInp = $('#projectNameInput');
  if (projInp) {
    projInp.addEventListener('input', (e) => {
      state.projectName = e.target.value;
      syncProjectNameUI();
      renderSketchCode(computeDipStates());
    });
  }

  $('#presetSelect').addEventListener('change', (e) => { if (e.target.value) loadPreset(e.target.value); e.target.value = ''; });

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
    refreshOpenBlockInfo();
  });

  $('#btnUndo').addEventListener('click', performUndo);
  $('#btnRedo').addEventListener('click', performRedo);
  $('#btnShareLink').addEventListener('click', () => { closeProjectMenu(); shareConfigLink(); });
  $('#btnSaveProject').addEventListener('click', () => { closeProjectMenu(); saveProjectFile(); });
  $('#btnLoadProject').addEventListener('click', () => { closeProjectMenu(); $('#projectFileInput').click(); });

  $('#projectFileInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      await applyProjectPayload(JSON.parse(text), true);
      showToast(t('toast.loadedFile', { file: file.name }));
    } catch (err) {
      console.error(err);
      showToast(t('toast.loadError'));
    }
  });

  $('#btnPrintStop').addEventListener('click', () => { closeProjectMenu(); openPrintStopSheet(); });
  $('#btnDoPrint').addEventListener('click', () => window.print());
  $('#btnClosePrintModal').addEventListener('click', () => $('#printModal').classList.add('hidden'));
  $('#printModal').addEventListener('click', (e) => { if (e.target === $('#printModal')) $('#printModal').classList.add('hidden'); });

  const hudOptBtn = $('#btnHudOptions');
  const hudOptPop = $('#hudOptionsPopover');
  if (hudOptBtn && hudOptPop) {
    hudOptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = hudOptPop.classList.contains('hidden');
      hudOptPop.classList.toggle('hidden', !willOpen);
      hudOptBtn.setAttribute('aria-expanded', String(willOpen));
    });
    document.addEventListener('click', (e) => {
      if (!hudOptPop.contains(e.target) && e.target !== hudOptBtn) closeHudOptions();
    });
  }

  $('#btnPinLegendToggle')?.addEventListener('click', (e) => {
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
    codeOut.addEventListener('mouseover', (e) => {
      const line = e.target.closest('.code-line[data-hw-id]');
      setHwHover(line ? line.dataset.hwId : null);
    });
    codeOut.addEventListener('mouseleave', () => setHwHover(null));
    codeOut.addEventListener('click', (e) => {
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
    helpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = helpPop.classList.contains('hidden');
      helpPop.classList.toggle('hidden', !willOpen);
      helpBtn.setAttribute('aria-expanded', String(willOpen));
    });
    document.addEventListener('click', (e) => {
      if (!helpPop.contains(e.target) && e.target !== helpBtn) {
        helpPop.classList.add('hidden');
        helpBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.querySelectorAll('#codeJumpBar [data-jump-target]').forEach((btn) => {
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

  document.querySelectorAll('.grp-mode-btn').forEach((btn) => {
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
  $('#compInfoModal').addEventListener('click', (e) => { if (e.target === $('#compInfoModal')) { state.openInfoCompId = null; $('#compInfoModal').classList.add('hidden'); } });
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
    projMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeLanguageMenu();
      const isOpen = projMenuPop.classList.toggle('open');
      projMenuBtn.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', (e) => {
      if (!projMenuPop.contains(e.target) && e.target !== projMenuBtn) {
        closeProjectMenu();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
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
      closeBlockInfoModal();
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
  $('#svgModal').addEventListener('click', (e) => { if (e.target === $('#svgModal')) $('#svgModal').classList.add('hidden'); });
  $('#btnOpenAbout')?.addEventListener('click', () => { closeProjectMenu(); openAboutModal(); });
  $('#btnFooterAbout')?.addEventListener('click', () => openAboutModal());
  $('#btnCloseAboutModal')?.addEventListener('click', () => $('#aboutModal')?.classList.add('hidden'));
  $('#aboutModal')?.addEventListener('click', (e) => { if (e.target === $('#aboutModal')) $('#aboutModal').classList.add('hidden'); });

  $('#btnCopyCode').addEventListener('click', async () => {
    await navigator.clipboard.writeText(state.latestSketch || $('#codeOutput code').textContent);
    $('#btnCopyCode').textContent = t('inspector.copied');
    setTimeout(() => { $('#btnCopyCode').textContent = t('inspector.copyCode'); }, 1300);
  });
  $('#btnDownloadIno').addEventListener('click', () => {
    const blob = new Blob([state.latestSketch || $('#codeOutput code').textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${getProjectSlug('kcomp_v2_init').replace(/-/g, '_')}.ino`; a.click();
    URL.revokeObjectURL(url);
  });

  document.querySelectorAll('.itab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.itab').forEach((tb) => tb.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      $('#' + tab.dataset.tab).classList.add('active');
    });
  });

  $('#masterSvg').addEventListener('click', (e) => {
    if (state.suppressClick || e.target.closest('.comp-card-svg') || e.target.closest('.wire-drag-handle') || e.target.closest('[data-dip]') || e.target.closest('.ob-pcb-hit')) return;
    if (state.focusedId) { state.focusedId = null; recomputeAndRender(); }
  });

  document.querySelectorAll('.mnav-btn').forEach((btn) => {
    btn.addEventListener('click', () => setMobileView(btn.dataset.mview));
  });

  const menuBtn = $('#btnMobileMenu');
  const menuBox = $('#topbarActions');
  if (menuBtn && menuBox) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menuBox.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(isOpen));
    });
    menuBox.addEventListener('click', (e) => {
      if (e.target.closest('.lang-menu-wrap') || e.target.closest('#btnProjectMenu')) return;
      closeMobileMenu();
    });
    document.addEventListener('click', (e) => {
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
    initI18n();
    initTheme();
    applyI18nToDom();
    applyThemeToDom();
    renderLanguageSwitcher($('#langSwitchSlot'), (loc) => {
      showToast(t('toast.langSwitched', { name: loc.nativeName }));
    });
    onLocaleChange(() => refreshLanguageUI());

    const [catRes, boardRes] = await Promise.all([
      fetch(`data/components.json?v=${ASSET_VERSION}`),
      fetch(`assets/kcomp-v2.svg?v=${ASSET_VERSION}`)
    ]);
    if (!catRes.ok || !boardRes.ok) throw new Error('HTTP load failed');
    state.catalog = await catRes.json();
    mountBoardSvg(await boardRes.text());

    for (const ob of state.catalog.onboard) {
      state.onboard[ob.id] = false;
    }
    state.onboard.onboard_wireless = false;

    populatePresets();
    renderCategoryTabs();
    bindUIEvents();
    bindCodeBlocksEvents();
    bindBlockGuideEvents();
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
    recomputeAndRender();

    state.repoDocsPromise = discoverRepoDocumentationPdfs();
  } catch (err) {
    console.error('K-Comp V2 init failed:', err);
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
