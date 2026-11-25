// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Left Sidebar & Right Inspector Resizable Splitters with Persisted Collapse State
import { state, $, applyPanelCollapseState, saveLayoutPrefs } from '../../core/state';
import { appBus } from '../../store/bus';

function getCssPxVar(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const val = parseFloat(raw);
  return Number.isFinite(val) ? val : fallback;
}

export function bindSidebarResizer(): void {
  const resizer = $('#sidebarResizer') as HTMLElement | null;
  if (!resizer) return;

  const colBtn = $('#btnCollapseSidebar') as HTMLElement | null;
  if (colBtn) {
    colBtn.addEventListener('pointerdown', (e: PointerEvent) => e.stopPropagation());
    colBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      state.sidebarCollapsed = !state.sidebarCollapsed;
      applyPanelCollapseState();
      saveLayoutPrefs();
      appBus.emit('viewport:applyViewBox');
    });
  }

  resizer.addEventListener('click', (e: MouseEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    if (state.sidebarCollapsed && !target?.closest('.resizer-collapse-btn')) {
      state.sidebarCollapsed = false;
      applyPanelCollapseState();
      saveLayoutPrefs();
      appBus.emit('viewport:applyViewBox');
    }
  });

  resizer.addEventListener('pointerdown', (e: PointerEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('.resizer-collapse-btn') || state.sidebarCollapsed) return;
    e.preventDefault();
    state.resizingSidebar = true;
    resizer.classList.add('dragging');
    document.body.classList.add('resizing-sidebar');
  });

  window.addEventListener('pointermove', (e: PointerEvent) => {
    if (!state.resizingSidebar) return;
    const inspW = state.inspectorCollapsed ? 16 : getCssPxVar('--inspector-w', 330);
    const minW = 192;
    const maxW = Math.max(minW, Math.min(440, window.innerWidth - inspW - 340));
    const newW = Math.max(minW, Math.min(maxW, e.clientX));
    document.documentElement.style.setProperty('--sidebar-w', `${Math.round(newW)}px`);
  });

  const endResize = (): void => {
    if (!state.resizingSidebar) return;
    state.resizingSidebar = false;
    resizer.classList.remove('dragging');
    document.body.classList.remove('resizing-sidebar');
    saveLayoutPrefs();
  };
  window.addEventListener('pointerup', endResize);
  window.addEventListener('pointercancel', endResize);
}

export function bindInspectorResizer(): void {
  const resizer = $('#inspectorResizer') as HTMLElement | null;
  if (!resizer) return;

  const colBtn = $('#btnCollapseInspector') as HTMLElement | null;
  if (colBtn) {
    colBtn.addEventListener('pointerdown', (e: PointerEvent) => e.stopPropagation());
    colBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      state.inspectorCollapsed = !state.inspectorCollapsed;
      applyPanelCollapseState();
      saveLayoutPrefs();
      appBus.emit('viewport:applyViewBox');
    });
  }

  resizer.addEventListener('click', (e: MouseEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    if (state.inspectorCollapsed && !target?.closest('.resizer-collapse-btn')) {
      state.inspectorCollapsed = false;
      applyPanelCollapseState();
      saveLayoutPrefs();
      appBus.emit('viewport:applyViewBox');
    }
  });

  resizer.addEventListener('pointerdown', (e: PointerEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('.resizer-collapse-btn') || state.inspectorCollapsed) return;
    e.preventDefault();
    state.resizingInspector = true;
    resizer.classList.add('dragging');
    document.body.classList.add('resizing-inspector');
  });

  window.addEventListener('pointermove', (e: PointerEvent) => {
    if (!state.resizingInspector) return;
    const sideW = state.sidebarCollapsed ? 16 : getCssPxVar('--sidebar-w', 236);
    const minW = 240;
    const maxW = Math.max(minW, Math.min(720, window.innerWidth - sideW - 340));
    const newW = Math.max(minW, Math.min(maxW, window.innerWidth - e.clientX));
    document.documentElement.style.setProperty('--inspector-w', `${Math.round(newW)}px`);
  });

  const endResize = (): void => {
    if (!state.resizingInspector) return;
    state.resizingInspector = false;
    resizer.classList.remove('dragging');
    document.body.classList.remove('resizing-inspector');
    saveLayoutPrefs();
  };
  window.addEventListener('pointerup', endResize);
  window.addEventListener('pointercancel', endResize);
}
