// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Workbench Pointer, Wheel, Pinch-to-Zoom & Canvas HUD Event Bindings
import { BASE_VB } from '../../core/constants';
import { state, $ } from '../../core/state';
import {
  applyViewBox, clientToSvg, clientToSvgWithVb, zoomAt,
  resetViewFit, zoomToBoard, capturePointerSafe, releasePointerSafe,
  updateResetPositionsVisibility, autoLayoutComponents
} from './layout';
import {
  startCompDrag, onCompDragMove, onCompDragEnd,
  startCompRotate, onCompRotateMove, onCompRotateEnd,
  renderDockedComponentsAndWires
} from './component-cards';
import { setHoveredNet, onWireDragMove, onWireDragEnd } from './wire-layer';
import { appBus } from '../../store/bus';

export function startPinchZoom() {
  if (state.touchPointers.size < 2) return;
  const pts = Array.from(state.touchPointers.values());
  const p1 = pts[0];
  const p2 = pts[1];
  const startDist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
  const midX = (p1.clientX + p2.clientX) / 2;
  const midY = (p1.clientY + p2.clientY) / 2;
  const startVb = { ...state.vb };

  // Cancel any single-finger pan or card drag/rotate cleanly when entering two-finger pinch
  if (state.panning) {
    releasePointerSafe(state.panning.pointerId);
    state.panning = null;
    $('#masterSvg').classList.remove('panning');
  }
  if (state.dragComp) {
    releasePointerSafe(state.dragComp.pointerId);
    if (state.dragComp.entry.cardG) state.dragComp.entry.cardG.classList.remove('is-dragging');
    $('#masterSvg').classList.remove('comp-dragging');
    const hadMoved = state.dragComp.moved;
    state.dragComp = null;
    if (hadMoved) renderDockedComponentsAndWires();
  }
  if (state.rotateComp) {
    releasePointerSafe(state.rotateComp.pointerId);
    if (state.rotateComp.entry.cardG) state.rotateComp.entry.cardG.classList.remove('is-rotating');
    $('#masterSvg').classList.remove('comp-rotating');
    $('#dragOverlayLayer').innerHTML = '';
    const hadMoved = state.rotateComp.moved;
    state.rotateComp = null;
    if (hadMoved) renderDockedComponentsAndWires();
  }
  appBus.emit('tooltip:hide');

  state.pinch = {
    startDist: Math.max(startDist, 10),
    startVb,
    anchorSvg: clientToSvgWithVb(midX, midY, startVb)
  };
}

export function onPinchMove() {
  const pz = state.pinch;
  if (!pz || state.touchPointers.size < 2) return;
  const svg = $('#masterSvg');
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const pts = Array.from(state.touchPointers.values());
  const p1 = pts[0];
  const p2 = pts[1];
  const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
  if (dist < 4) return;

  const midX = (p1.clientX + p2.clientX) / 2;
  const midY = (p1.clientY + p2.clientY) / 2;
  const scaleFactor = pz.startDist / dist;
  const newW = Math.max(BASE_VB.w / 4.5, Math.min(BASE_VB.w / 0.4, pz.startVb.w * scaleFactor));
  const newH = newW * (BASE_VB.h / BASE_VB.w);

  const pxPerUnit = Math.min(rect.width / newW, rect.height / newH);
  const offX = (rect.width - newW * pxPerUnit) / 2;
  const offY = (rect.height - newH * pxPerUnit) / 2;

  state.vb = {
    x: pz.anchorSvg.x - (midX - rect.left - offX) / pxPerUnit,
    y: pz.anchorSvg.y - (midY - rect.top - offY) / pxPerUnit,
    w: newW,
    h: newH
  };
  applyViewBox();
}

export function bindViewportAndDragEvents() {
  const svg = $('#masterSvg');

  svg.addEventListener('wheel', (e: any) => {
    e.preventDefault();
    const pt = clientToSvg(e.clientX, e.clientY);
    zoomAt(e.deltaY < 0 ? 0.87 : 1.15, pt.x, pt.y);
  }, { passive: false });

  // Prevent iOS Safari native gesture hijack on the SVG workbench
  svg.addEventListener('gesturestart', (e: any) => e.preventDefault(), { passive: false });
  svg.addEventListener('gesturechange', (e: any) => e.preventDefault(), { passive: false });

  // Unified delegated pointerdown on #masterSvg: handles two-finger pinch, wires, rotation, card drag, and canvas pan
  svg.addEventListener('pointerdown', (e: any) => {
    appBus.emit('tooltip:hide');
    if (e.pointerType === 'touch') {
      state.touchPointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      if (state.touchPointers.size === 2 && !state.dragWire && !(state.resizingInspector || state.resizingSidebar)) {
        e.preventDefault();
        startPinchZoom();
        return;
      }
      if (state.touchPointers.size > 2 || state.pinch) {
        e.preventDefault();
        return;
      }
    }

    if ((e.pointerType !== 'touch' && e.button !== 0) || state.pinch || state.dragWire || state.dragComp || state.rotateComp || (state.resizingInspector || state.resizingSidebar)) return;

    // 1. Wire drag handles take top priority (they have their own pointerdown listener that calls stopPropagation)
    if (e.target.closest('.wire-drag-handle') || e.target.closest('[data-dip]')) return;

    // 1a. Quick +90° rotate button on card header
    if (e.target.closest('.comp-quick-btn') || e.target.closest('.comp-quick-rotate')) return;

    // 1b. Component mouse/touch-rotation handle
    const rotEl = e.target.closest('.comp-rotate-handle');
    if (rotEl) {
      startCompRotate(e, rotEl.getAttribute('data-inst-id'));
      return;
    }

    // 2. External component card drag-to-position
    const cardEl = e.target.closest('.comp-card-svg');
    const instId = cardEl && cardEl.getAttribute('data-inst-id');
    if (instId) {
      startCompDrag(e, instId);
      return;
    }

    // 3. Otherwise pan the canvas
    e.preventDefault();
    state.panning = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startVb: { ...state.vb },
      moved: false
    };
    svg.classList.add('panning');
  });

  const handlePointerMove = (e) => {
    if (e.pointerType === 'touch' && state.touchPointers.has(e.pointerId)) {
      state.touchPointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }
    if (state.pinch) { onPinchMove(); return; }
    if (state.dragWire) { if (e.pointerId === state.dragWire.pointerId) onWireDragMove(e); return; }
    if (state.rotateComp) { if (e.pointerId === state.rotateComp.pointerId) onCompRotateMove(e); return; }
    if (state.dragComp) { if (e.pointerId === state.dragComp.pointerId) onCompDragMove(e); return; }
    if (!state.panning || e.pointerId !== state.panning.pointerId) return;

    if (!state.panning.moved && Math.hypot(e.clientX - state.panning.startClientX, e.clientY - state.panning.startClientY) > 4) {
      state.panning.moved = true;
      capturePointerSafe(state.panning.pointerId);
    }
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = Math.max(state.panning.startVb.w / rect.width, state.panning.startVb.h / rect.height);
    state.vb.x = state.panning.startVb.x - (e.clientX - state.panning.startClientX) * scale;
    state.vb.y = state.panning.startVb.y - (e.clientY - state.panning.startClientY) * scale;
    applyViewBox();
  };

  const handlePointerUp = (e) => {
    if (e && state.touchPointers.has(e.pointerId)) {
      state.touchPointers.delete(e.pointerId);
    }

    if (state.pinch) {
      if (state.touchPointers.size < 2) {
        state.pinch = null;
        state.suppressClick = true;
        setTimeout(() => { state.suppressClick = false; }, 100);
        // Smooth hand-off if one finger stays down after pinching
        if (state.touchPointers.size === 1) {
          const [remId, remPt] = state.touchPointers.entries().next().value as [number, { clientX: number; clientY: number }];
          state.panning = {
            pointerId: remId,
            startClientX: remPt.clientX,
            startClientY: remPt.clientY,
            startVb: { ...state.vb },
            moved: true
          };
          svg.classList.add('panning');
        }
      }
      return;
    }

    if (state.dragWire && (!e || e.pointerId === state.dragWire.pointerId)) { onWireDragEnd(); return; }
    if (state.rotateComp && (!e || e.pointerId === state.rotateComp.pointerId)) { onCompRotateEnd(); return; }
    if (state.dragComp && (!e || e.pointerId === state.dragComp.pointerId)) { onCompDragEnd(); return; }
    if (state.panning && (!e || e.pointerId === state.panning.pointerId)) {
      releasePointerSafe(state.panning.pointerId);
      if (state.panning.moved) { state.suppressClick = true; setTimeout(() => { state.suppressClick = false; }, 60); }
      state.panning = null;
      svg.classList.remove('panning');
    }
  };

  const handleWindowBlur = () => {
    state.touchPointers.clear();
    state.pinch = null;
    setHoveredNet(null);
    appBus.emit('tooltip:hide');
    handlePointerUp(null);
  };

  svg.addEventListener('mouseleave', () => {
    if (state.dragWire || state.dragComp || state.rotateComp) return;
    setHoveredNet(null);
    appBus.emit('tooltip:hide');
  });

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);
  window.addEventListener('blur', handleWindowBlur);

  $('#btnZoomIn').addEventListener('click', () => zoomAt(0.78, state.vb.x + state.vb.w / 2, state.vb.y + state.vb.h / 2));
  $('#btnZoomOut').addEventListener('click', () => zoomAt(1.28, state.vb.x + state.vb.w / 2, state.vb.y + state.vb.h / 2));
  $('#btnZoomPct').addEventListener('click', () => { state.vb = { ...BASE_VB }; applyViewBox(); });
  $('#btnZoomFit').addEventListener('click', resetViewFit);
  $('#btnZoomBoard').addEventListener('click', zoomToBoard);
  svg.addEventListener('dblclick', (e: any) => {
    if (e.target.closest('.comp-card-svg') || e.target.closest('.wire-drag-handle') || e.target.closest('[data-dip]') || e.target.closest('.ob-pcb-hit')) return;
    resetViewFit();
  });

  $('#btnAutoLayout')?.addEventListener('click', () => autoLayoutComponents());

  $('#btnResetPositions').addEventListener('click', () => {
    appBus.emit('history:push');
    state.active.forEach((i) => { i.customPos = null; i.rotation = 0; });
    updateResetPositionsVisibility();
    resetViewFit();
    renderDockedComponentsAndWires();
  });
}
