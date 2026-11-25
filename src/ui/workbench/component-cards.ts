// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Draggable/Rotatable External Component Cards & Onboard-Mounted Wireless Slot Modules
import { SVG_NS, GRID_SNAP, MAX_HISTORY } from '../../core/constants';
import { state, $, escapeHtml, isLightTheme, showToast, isMobileViewport } from '../../core/state';
import { getCompDef, getDisplayLabel, getInstanceAddress, removeComponent } from '../../core/hardware';
import { boardToMaster } from '../../core/routing';
import { getBoardGeometry } from '../../boards';
import { shortInterfaceLabel } from '../inspector';
import { t, tComp } from '../../i18n/index';
import { createSvgEl } from './shared';
import {
  clientToSvg, capturePointerSafe, releasePointerSafe,
  prepareCardFlipTexts, updateCardTextOrientations,
  computePlacedBoxes, renderRotationBadge, updateResetPositionsVisibility
} from './layout';
import { setHoveredNet, renderWiresAndHandles } from './wire-layer';
import { appBus } from '../../store/bus';

export function startCompDrag(ev, instId) {
  const entry = state.placedEntries.find((e) => e.box.inst.instanceId === instId);
  if (!entry) return;

  ev.preventDefault();
  ev.stopPropagation();
  appBus.emit('tooltip:hide');
  setHoveredNet(null);
  const pf = $('#pinFlagsLayer'); if (pf) pf.innerHTML = '';

  state.dragComp = {
    instanceId: instId,
    pointerId: ev.pointerId,
    startClientX: ev.clientX,
    startClientY: ev.clientY,
    startSvg: clientToSvg(ev.clientX, ev.clientY),
    origX: entry.box.x,
    origY: entry.box.y,
    w: entry.box.w,
    h: entry.box.h,
    dx: 0,
    dy: 0,
    moved: false,
    preSnap: (appBus.invoke('history:captureSnapshot') || '{}'),
    entry
  };
}

export function onCompDragMove(ev) {
  const dc = state.dragComp;
  if (!dc) return;

  if (!dc.moved) {
    if (Math.hypot(ev.clientX - dc.startClientX, ev.clientY - dc.startClientY) <= 3) return;
    dc.moved = true;
    capturePointerSafe(dc.pointerId);
    $('#masterSvg').classList.add('comp-dragging');
    appBus.emit('tooltip:hide');
    // Raise dragged card to top of #componentsLayer WITHOUT destroying it!
    if (dc.entry.cardG && dc.entry.cardG.parentNode) {
      dc.entry.cardG.classList.add('is-dragging');
      dc.entry.cardG.setAttribute('opacity', '1');
      dc.entry.cardG.parentNode.appendChild(dc.entry.cardG);
    }
  }

  const cur = clientToSvg(ev.clientX, ev.clientY);
  let targetX = Math.round(dc.origX + (cur.x - dc.startSvg.x));
  let targetY = Math.round(dc.origY + (cur.y - dc.startSvg.y));
  if (state.snapToGrid && !ev.altKey) {
    targetX = Math.round(targetX / GRID_SNAP) * GRID_SNAP;
    targetY = Math.round(targetY / GRID_SNAP) * GRID_SNAP;
  }
  dc.dx = targetX - dc.origX;
  dc.dy = targetY - dc.origY;

  const inst = state.active.find((i) => i.instanceId === dc.instanceId);
  if (!inst) return;
  inst.customPos = {
    x: targetX,
    y: targetY,
    w: dc.w,
    h: dc.h
  };

  // Smooth 60fps in-place SVG translation (preserving any active rotation) — zero DOM thrashing!
  const rot = inst.rotation || 0;
  const cx = dc.origX + dc.w / 2;
  const cy = dc.origY + dc.h / 2;
  if (dc.entry.cardG) {
    dc.entry.cardG.setAttribute(
      'transform',
      rot
        ? `translate(${dc.dx}, ${dc.dy}) rotate(${rot}, ${cx.toFixed(1)}, ${cy.toFixed(1)})`
        : `translate(${dc.dx}, ${dc.dy})`
    );
  }
  updateResetPositionsVisibility();
  // Re-route only wires & pin handles live with shifted coordinates
  renderWiresAndHandles(dc.instanceId, dc.dx, dc.dy, rot);
}

export function onCompDragEnd() {
  const dc = state.dragComp;
  if (!dc) return;
  releasePointerSafe(dc.pointerId);
  $('#masterSvg').classList.remove('comp-dragging');
  const wasMoved = dc.moved;
  state.dragComp = null;

  if (wasMoved) {
    if (dc.preSnap) {
      state.undoStack.push(dc.preSnap);
      if (state.undoStack.length > MAX_HISTORY) state.undoStack.shift();
      state.redoStack = [];
      appBus.emit('history:updateButtons');
    }
    state.suppressClick = true;
    setTimeout(() => { state.suppressClick = false; }, 80);
    renderDockedComponentsAndWires();
  }
}

export function startCompRotate(ev, instId) {
  const entry = state.placedEntries.find((e) => e.box.inst.instanceId === instId);
  if (!entry) return;

  ev.preventDefault();
  ev.stopPropagation();
  appBus.emit('tooltip:hide');
  setHoveredNet(null);
  const pf = $('#pinFlagsLayer'); if (pf) pf.innerHTML = '';
  capturePointerSafe(ev.pointerId);

  const cx = entry.box.x + entry.box.w / 2;
  const cy = entry.box.y + entry.box.h / 2;
  const pt = clientToSvg(ev.clientX, ev.clientY);
  const startAngle = (Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI;
  const origRot = entry.box.inst.rotation || 0;

  if (entry.cardG && entry.cardG.parentNode) {
    entry.cardG.classList.add('is-rotating');
    entry.cardG.setAttribute('opacity', '1');
    entry.cardG.parentNode.appendChild(entry.cardG);
  }
  $('#masterSvg').classList.add('comp-rotating');

  state.rotateComp = {
    instanceId: instId,
    pointerId: ev.pointerId,
    cx,
    cy,
    startAngle,
    origRot,
    currentRot: origRot,
    moved: false,
    preSnap: (appBus.invoke('history:captureSnapshot') || '{}'),
    entry
  };
  renderRotationBadge(cx, cy, origRot);
}

export function onCompRotateMove(ev) {
  const rc = state.rotateComp;
  if (!rc) return;

  const pt = clientToSvg(ev.clientX, ev.clientY);
  const curAngle = (Math.atan2(pt.y - rc.cy, pt.x - rc.cx) * 180) / Math.PI;
  let deg = rc.origRot + (curAngle - rc.startAngle);
  deg = ((deg % 360) + 360) % 360;

  if (ev.shiftKey) {
    deg = Math.round(deg / 15) * 15;
  } else {
    deg = Math.round(deg);
    // Subtle magnetic snap to cardinal angles (0, 90, 180, 270) within ±2°
    for (const snap of [0, 90, 180, 270, 360]) {
      if (Math.abs(deg - snap) <= 2) { deg = snap; break; }
    }
  }
  if (deg >= 360) deg = 0;

  if (deg !== rc.origRot) rc.moved = true;
  rc.currentRot = deg;

  const inst = state.active.find((i) => i.instanceId === rc.instanceId);
  if (!inst) return;
  inst.rotation = deg;

  if (rc.entry.cardG) {
    rc.entry.cardG.setAttribute('transform', `rotate(${deg}, ${rc.cx.toFixed(1)}, ${rc.cy.toFixed(1)})`);
    updateCardTextOrientations(rc.entry.cardG, deg);
  }
  renderRotationBadge(rc.cx, rc.cy, deg);
  updateResetPositionsVisibility();
  renderWiresAndHandles(rc.instanceId, 0, 0, deg);
}

export function onCompRotateEnd() {
  const rc = state.rotateComp;
  if (!rc) return;
  releasePointerSafe(rc.pointerId);
  $('#masterSvg').classList.remove('comp-rotating');
  $('#dragOverlayLayer').innerHTML = '';
  if (rc.entry.cardG) rc.entry.cardG.classList.remove('is-rotating');
  const wasMoved = rc.moved;
  state.rotateComp = null;

  if (wasMoved) {
    if (rc.preSnap) {
      state.undoStack.push(rc.preSnap);
      if (state.undoStack.length > MAX_HISTORY) state.undoStack.shift();
      state.redoStack = [];
      appBus.emit('history:updateButtons');
    }
    state.suppressClick = true;
    setTimeout(() => { state.suppressClick = false; }, 80);
    renderDockedComponentsAndWires();
  }
}

export function quickRotateComponent(instId, deltaDeg = 90) {
  const inst = state.active.find((i) => i.instanceId === instId);
  if (!inst || getCompDef(inst.compId)?.onboardWirelessSlot) return;
  appBus.emit('history:push');
  const cur = inst.rotation || 0;
  let next = Math.round((cur + deltaDeg) / 90) * 90;
  next = ((next % 360) + 360) % 360;
  inst.rotation = next;
  state.focusedId = instId;
  updateResetPositionsVisibility();
  renderDockedComponentsAndWires();
}

function buildMountedHc05Art(g, rx, ry, rw, rh, isFocused, isConflict) {
  // Subtle shadow onto K-Comp PCB (pure vector, zero <filter>)
  g.appendChild(createSvgEl('rect', { x: rx + 2, y: ry + 2.2, width: rw, height: rh, rx: 3, fill: '#1e0338', opacity: 0.6 }));
  // Blue HC-05 carrier PCB
  g.appendChild(createSvgEl('rect', {
    class: 'comp-card-frame',
    x: rx, y: ry, width: rw, height: rh, rx: 3,
    fill: '#1d4ed8',
    stroke: isConflict ? '#ef4444' : (isFocused ? '#38bdf8' : '#60a5fa'),
    'stroke-width': isFocused || isConflict ? 1.8 : 1.0,
    ...(isConflict ? { 'stroke-dasharray': '3,2' } : {})
  }));
  // Left 4-pin soldered header bar aligned 1:1 with PCB HC05_VCC/GND/TX/RX (x=200, y=209/221/233/245)
  g.appendChild(createSvgEl('rect', { x: rx + 2, y: ry + 4, width: 8, height: 52, rx: 1, fill: '#0f172a', stroke: '#475569', 'stroke-width': 0.6 }));
  const pinColors = ['#ef4444', '#94a3b8', '#38bdf8', '#10b981'];
  const yOff = ry - 198;
  [209, 221, 233, 245].forEach((py, idx) => {
    g.appendChild(createSvgEl('circle', { cx: rx + 6, cy: py + yOff, r: 2.1, fill: '#eab308', stroke: '#92400e', 'stroke-width': 0.5 }));
    g.appendChild(createSvgEl('circle', { cx: rx + 6, cy: py + yOff, r: 1.0, fill: pinColors[idx] }));
  });
  // Tiny SMD red status LED
  g.appendChild(createSvgEl('circle', { cx: rx + 6, cy: ry + 59.5, r: 1.7, fill: '#ef4444', stroke: '#fecaca', 'stroke-width': 0.4 }));
  // Green Bluetooth core daughterboard
  g.appendChild(createSvgEl('rect', { x: rx + 14, y: ry + 5, width: 80, height: 54, rx: 2, fill: '#15803d', stroke: '#14532d', 'stroke-width': 0.9 }));
  // BC417 dark IC chip with silver leads
  const icX = rx + 20, icY = ry + 13, icW = 28, icH = 30;
  for (let i = 0; i < 5; i++) {
    const px = icX + 3.5 + i * 5.2;
    g.appendChild(createSvgEl('rect', { x: px, y: icY - 2, width: 1.6, height: 2.2, fill: '#cbd5e1' }));
    g.appendChild(createSvgEl('rect', { x: px, y: icY + icH - 0.2, width: 1.6, height: 2.2, fill: '#cbd5e1' }));
  }
  g.appendChild(createSvgEl('rect', { x: icX, y: icY, width: icW, height: icH, rx: 1.5, fill: '#0f172a', stroke: '#475569', 'stroke-width': 0.7 }));
  g.appendChild(createSvgEl('circle', { cx: icX + 3.5, cy: icY + 3.5, r: 1.1, fill: '#64748b' }));
  g.appendChild(createSvgEl('text', {
    x: icX + icW / 2, y: icY + 13.5, fill: '#f8fafc',
    'font-family': 'Consolas, monospace', 'font-size': 5.8, 'font-weight': 'bold', 'text-anchor': 'middle'
  }, 'HC-05'));
  g.appendChild(createSvgEl('text', {
    x: icX + icW / 2, y: icY + 21.5, fill: '#93c5fd',
    'font-family': 'Consolas, monospace', 'font-size': 4.8, 'font-weight': 'bold', 'text-anchor': 'middle'
  }, 'BT 2.0'));
  // Silver crystal oscillator can
  g.appendChild(createSvgEl('rect', { x: rx + 52, y: ry + 26, width: 10, height: 14, rx: 1.2, fill: '#cbd5e1', stroke: '#64748b', 'stroke-width': 0.6 }));
  // Iconic gold 2.4 GHz meander PCB antenna on the right edge
  const ax = rx + 68;
  g.appendChild(createSvgEl('path', {
    d: `M ${ax} ${ry + 51} L ${ax} ${ry + 11} L ${ax + 6.5} ${ry + 11} L ${ax + 6.5} ${ry + 47} L ${ax + 13} ${ry + 47} L ${ax + 13} ${ry + 11} L ${ax + 19.5} ${ry + 11} L ${ax + 19.5} ${ry + 47}`,
    fill: 'none', stroke: '#fde047', 'stroke-width': 1.8, 'stroke-linecap': 'square'
  }));
  // Crisp silkscreen label at bottom of daughterboard
  g.appendChild(createSvgEl('text', {
    x: rx + 40, y: ry + 55.2, fill: '#bbf7d0',
    'font-family': 'Consolas, monospace', 'font-size': 4.6, 'font-weight': 'bold', 'text-anchor': 'middle'
  }, 'BLUETOOTH'));
}

function buildMountedEsp01Art(g, rx, ry, rw, rh, isFocused, isConflict) {
  // Subtle shadow onto K-Comp PCB (pure vector, zero <filter>)
  g.appendChild(createSvgEl('rect', { x: rx + 1.8, y: ry + 2.0, width: rw, height: rh, rx: 2.5, fill: '#1e0338', opacity: 0.6 }));
  // Matte-black ESP-01S PCB
  g.appendChild(createSvgEl('rect', {
    class: 'comp-card-frame',
    x: rx, y: ry, width: rw, height: rh, rx: 2.5,
    fill: '#0f172a',
    stroke: isConflict ? '#ef4444' : (isFocused ? '#38bdf8' : '#64748b'),
    'stroke-width': isFocused || isConflict ? 1.8 : 1.0,
    ...(isConflict ? { 'stroke-dasharray': '3,2' } : {})
  }));
  // Left 2x4 header footprint aligned 1:1 with PCB ESP_GND..ESP_RX (x=226/234, y=214/224/234/244)
  g.appendChild(createSvgEl('rect', { x: rx + 2, y: ry + 4, width: 16, height: 44, rx: 1, fill: '#1e293b', stroke: '#475569', 'stroke-width': 0.6 }));
  const yOff = ry - 204;
  [214, 224, 234, 244].forEach((py) => {
    [226, 234].forEach((px) => {
      g.appendChild(createSvgEl('circle', { cx: px, cy: py + yOff, r: 1.9, fill: '#eab308', stroke: '#92400e', 'stroke-width': 0.45 }));
      g.appendChild(createSvgEl('circle', { cx: px, cy: py + yOff, r: 0.9, fill: '#0f172a' }));
    });
  });
  // ESP8266EX QFN chip
  g.appendChild(createSvgEl('rect', { x: rx + 21, y: ry + 5, width: 21, height: 20, rx: 1.2, fill: '#1e293b', stroke: '#475569', 'stroke-width': 0.7 }));
  g.appendChild(createSvgEl('text', {
    x: rx + 31.5, y: ry + 14, fill: '#e2e8f0',
    'font-family': 'Consolas, monospace', 'font-size': 4.8, 'font-weight': 'bold', 'text-anchor': 'middle'
  }, 'ESP'));
  g.appendChild(createSvgEl('text', {
    x: rx + 31.5, y: ry + 20.5, fill: '#7dd3fc',
    'font-family': 'Consolas, monospace', 'font-size': 4.8, 'font-weight': 'bold', 'text-anchor': 'middle'
  }, '8266'));
  // 1MB Flash IC
  g.appendChild(createSvgEl('rect', { x: rx + 21, y: ry + 28, width: 21, height: 14, rx: 1.2, fill: '#1e293b', stroke: '#475569', 'stroke-width': 0.7 }));
  g.appendChild(createSvgEl('text', {
    x: rx + 31.5, y: ry + 36.8, fill: '#cbd5e1',
    'font-family': 'Consolas, monospace', 'font-size': 4.4, 'font-weight': 'bold', 'text-anchor': 'middle'
  }, 'FLASH'));
  // Blue Wi-Fi status LED & silver crystal
  g.appendChild(createSvgEl('circle', { cx: rx + 46.5, cy: ry + 8.5, r: 1.8, fill: '#38bdf8', stroke: '#bae6fd', 'stroke-width': 0.4 }));
  g.appendChild(createSvgEl('rect', { x: rx + 44, y: ry + 33, width: 6.5, height: 9, rx: 1, fill: '#cbd5e1', stroke: '#64748b', 'stroke-width': 0.5 }));
  // Iconic gold 2.4 GHz meander Wi-Fi PCB antenna along right edge
  const ax = rx + 53.5;
  g.appendChild(createSvgEl('path', {
    d: `M ${ax} ${ry + 45} L ${ax} ${ry + 7} L ${ax + 5} ${ry + 7} L ${ax + 5} ${ry + 43} L ${ax + 10} ${ry + 43} L ${ax + 10} ${ry + 7} L ${ax + 15} ${ry + 7} L ${ax + 15} ${ry + 43}`,
    fill: 'none', stroke: '#eab308', 'stroke-width': 1.7, 'stroke-linecap': 'square'
  }));
  // Crisp silkscreen label
  g.appendChild(createSvgEl('text', {
    x: rx + 35, y: ry + 48.8, fill: '#cbd5e1',
    'font-family': 'Consolas, monospace', 'font-size': 4.4, 'font-weight': 'bold', 'text-anchor': 'middle'
  }, 'ESP-01 · 3.3V'));
}

function renderMountedWirelessModules(compLayer) {
  const mounted = state.active.filter((i) => getCompDef(i.compId)?.onboardWirelessSlot);
  if (!mounted.length) return;
  const isConflict = mounted.length > 1;
  const light = isLightTheme();

  mounted.forEach((inst, idx) => {
    const def = getCompDef(inst.compId);
    const isHc05 = inst.compId === 'hc05';
    const rx = isHc05 ? 194 : 220;
    const ry = (isHc05 ? 198 : 204) + (isConflict && idx > 0 ? 7 : 0);
    const rw = isHc05 ? 99 : 73;
    const rh = isHc05 ? 64 : 52;

    const tl = boardToMaster(rx, ry);
    const br = boardToMaster(rx + rw, ry + rh);
    const box = { inst, side: 'board', x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
    const isFocused = !state.focusedId || state.focusedId === inst.instanceId;
    const cardOpacity = state.focusedId && !isFocused ? 0.45 : 1;

    const cardG = createSvgEl('g', {
      class: `comp-card-svg onboard-mounted-module${state.focusedId === inst.instanceId ? ' is-focused' : ''}`,
      'data-inst-id': inst.instanceId,
      opacity: cardOpacity
    });

    const pcbG = createSvgEl('g', {
      transform: `translate(${getBoardGeometry().tx}, ${getBoardGeometry().ty}) scale(${getBoardGeometry().scale})`
    });
    if (isHc05) buildMountedHc05Art(pcbG, rx, ry, rw, rh, state.focusedId === inst.instanceId, isConflict);
    else buildMountedEsp01Art(pcbG, rx, ry, rw, rh, state.focusedId === inst.instanceId, isConflict);
    cardG.appendChild(pcbG);

    // Compact quick-action buttons [i] & [✕] at top-right (stripped cleanly on SVG export!)
    const btnY = box.y - 16;
    const infoBtnG = createSvgEl('g', { class: 'comp-quick-btn mounted-quick-btn' });
    infoBtnG.appendChild(createSvgEl('rect', {
      x: (box.x + box.w - 34).toFixed(1), y: btnY.toFixed(1), width: 15, height: 14, rx: 4,
      fill: light ? '#e0f2fe' : '#0f172a', stroke: '#38bdf8', 'stroke-width': 1.1
    }));
    infoBtnG.appendChild(createSvgEl('text', {
      x: (box.x + box.w - 26.5).toFixed(1), y: (btnY + 10.2).toFixed(1),
      fill: light ? '#0369a1' : '#7dd3fc', 'font-family': 'Georgia, serif', 'font-style': 'italic',
      'font-size': 9.5, 'font-weight': 700, 'text-anchor': 'middle'
    }, 'i'));
    infoBtnG.addEventListener('click', (e: any) => { e.stopPropagation(); appBus.emit('modal:openComponentInfo', { compId: def.id }); });
    cardG.appendChild(infoBtnG);

    const rmBtnG = createSvgEl('g', { class: 'comp-quick-btn mounted-quick-btn' });
    rmBtnG.appendChild(createSvgEl('rect', {
      x: (box.x + box.w - 16).toFixed(1), y: btnY.toFixed(1), width: 15, height: 14, rx: 4,
      fill: light ? '#fee2e2' : '#450a0a', stroke: '#ef4444', 'stroke-width': 1.1
    }));
    rmBtnG.appendChild(createSvgEl('text', {
      x: (box.x + box.w - 8.5).toFixed(1), y: (btnY + 10.2).toFixed(1),
      fill: light ? '#b91c1c' : '#fca5a5', 'font-family': 'sans-serif',
      'font-size': 9.5, 'font-weight': 800, 'text-anchor': 'middle'
    }, '✕'));
    rmBtnG.addEventListener('click', (e: any) => { e.stopPropagation(); removeComponent(inst.instanceId); });
    cardG.appendChild(rmBtnG);

    cardG.addEventListener('click', (e: any) => {
      e.stopPropagation();
      if (state.suppressClick || e.target.closest('.comp-quick-btn')) return;
      state.focusedId = state.focusedId === inst.instanceId ? null : inst.instanceId;
      appBus.emit('workspace:recompute');
    });
    cardG.addEventListener('mouseenter', (e: any) => {
      if (state.dragWire || state.dragComp || state.rotateComp) return;
      appBus.emit('tooltip:showCustom', { html: `<strong>${escapeHtml(getDisplayLabel(def))}</strong> (${escapeHtml(def.voltage)})<br><span class="tip-accent">${escapeHtml(t('tip.mountedSlot'))}</span>`, ev: e });
    });
    cardG.addEventListener('mousemove', (e: any) => {
      if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:move', { ev: e });
    });
    cardG.addEventListener('mouseleave', () => appBus.emit('tooltip:hide'));

    compLayer.appendChild(cardG);
    state.placedEntries.push({ box, def, cardG, drawX: box.x, drawY: box.y, scale: 1, isBoardMounted: true });
  });
}

export function renderDockedComponentsAndWires() {
  const compLayer = $('#componentsLayer');
  compLayer.innerHTML = '';
  state.placedEntries = [];

  const placed = computePlacedBoxes();

  for (const box of placed) {
    const def = getCompDef(box.inst.compId);
    const addr = getInstanceAddress(box.inst);
    const isFocused = !state.focusedId || state.focusedId === box.inst.instanceId;
    const cardOpacity = state.focusedId && !isFocused ? 0.42 : 1;

    const rot = box.inst.rotation || 0;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;

    const cardG = document.createElementNS(SVG_NS, 'g');
    cardG.setAttribute('class', 'comp-card-svg');
    cardG.setAttribute('data-inst-id', box.inst.instanceId);
    cardG.setAttribute('opacity', String(cardOpacity));
    if (rot) {
      cardG.setAttribute('transform', `rotate(${rot}, ${cx.toFixed(1)}, ${cy.toFixed(1)})`);
    }

    cardG.addEventListener('click', (e: any) => {
      e.stopPropagation();
      if (state.suppressClick || e.target.closest('.comp-rotate-handle') || e.target.closest('.comp-quick-btn')) return;
      state.focusedId = state.focusedId === box.inst.instanceId ? null : box.inst.instanceId;
      appBus.emit('workspace:recompute');
    });
    cardG.addEventListener('dblclick', (e: any) => {
      e.stopPropagation();
      if (e.target.closest('.comp-rotate-handle') || e.target.closest('.comp-quick-btn')) return;
      if (box.inst.customPos || (box.inst.rotation && box.inst.rotation % 360 !== 0)) {
        box.inst.customPos = null;
        box.inst.rotation = 0;
        updateResetPositionsVisibility();
        showToast(t('toast.resetCardPos', { name: def.name }));
        renderDockedComponentsAndWires();
      }
    });

    const light = isLightTheme();
    // Vector shadow (Inkscape-safe, no <filter>)
    const shadow = document.createElementNS(SVG_NS, 'rect');
    shadow.setAttribute('x', String(box.x + 3));
    shadow.setAttribute('y', String(box.y + 4));
    shadow.setAttribute('width', String(box.w));
    shadow.setAttribute('height', String(box.h));
    shadow.setAttribute('rx', '10');
    shadow.setAttribute('fill', light ? '#94a3b8' : '#020617');
    shadow.setAttribute('opacity', light ? '0.28' : '0.55');
    cardG.appendChild(shadow);

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('class', 'comp-card-frame');
    rect.setAttribute('x', String(box.x));
    rect.setAttribute('y', String(box.y));
    rect.setAttribute('width', String(box.w));
    rect.setAttribute('height', String(box.h));
    rect.setAttribute('rx', '10');
    rect.setAttribute('fill', light ? '#ffffff' : '#111827');
    rect.setAttribute('stroke', state.focusedId === box.inst.instanceId ? (light ? '#0284c7' : '#38bdf8') : (light ? '#cbd5e1' : '#263244'));
    rect.setAttribute('stroke-width', state.focusedId === box.inst.instanceId ? '2.2' : '1.3');
    cardG.appendChild(rect);

    const hdr = document.createElementNS(SVG_NS, 'rect');
    hdr.setAttribute('x', String(box.x));
    hdr.setAttribute('y', String(box.y));
    hdr.setAttribute('width', String(box.w));
    hdr.setAttribute('height', '23');
    hdr.setAttribute('rx', '9');
    hdr.setAttribute('fill', light ? '#f1f5f9' : '#1e293b');
    cardG.appendChild(hdr);

    // Header text & grip group (auto-flips 180° when card is rotated upside-down)
    const hdrContent = document.createElementNS(SVG_NS, 'g');
    hdrContent.setAttribute('class', 'card-hdr-content');

    // Subtle 6-dot drag grip icon on left of card header
    for (let gx = 0; gx < 2; gx++) {
      for (let gy = 0; gy < 3; gy++) {
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', String(box.x + 8 + gx * 3.5));
        dot.setAttribute('cy', String(box.y + 7.5 + gy * 4));
        dot.setAttribute('r', '1.1');
        dot.setAttribute('fill', '#64748b');
        hdrContent.appendChild(dot);
      }
    }

    const rawTitle = `${def.name}${addr ? ' (' + addr + ')' : ''}`;
    const badgeLabel = def.protoArea ? 'PROTO' : shortInterfaceLabel(def.interface);
    const maxTitleChars = Math.max(12, Math.floor((box.w - 122) / 6.2));
    const cleanTitle = rawTitle.length > maxTitleChars ? rawTitle.slice(0, maxTitleChars - 1) + '…' : rawTitle;

    const title = document.createElementNS(SVG_NS, 'text');
    title.setAttribute('x', String(box.x + 17));
    title.setAttribute('y', String(box.y + 15));
    title.setAttribute('fill', light ? '#0f172a' : '#f8fafc');
    title.setAttribute('font-family', 'system-ui, sans-serif');
    title.setAttribute('font-size', '10.2');
    title.setAttribute('font-weight', '700');
    title.textContent = cleanTitle;
    hdrContent.appendChild(title);

    const badgeTxt = document.createElementNS(SVG_NS, 'text');
    badgeTxt.setAttribute('x', String(box.x + box.w - 63));
    badgeTxt.setAttribute('y', String(box.y + 14.8));
    badgeTxt.setAttribute('fill', def.protoArea ? (light ? '#be123c' : '#fda4af') : (light ? '#0369a1' : '#38bdf8'));
    badgeTxt.setAttribute('font-family', 'Consolas, monospace');
    badgeTxt.setAttribute('font-size', '8.2');
    badgeTxt.setAttribute('font-weight', '700');
    badgeTxt.setAttribute('text-anchor', 'end');
    badgeTxt.textContent = badgeLabel;
    hdrContent.appendChild(badgeTxt);
    cardG.appendChild(hdrContent);

    // Helper for compact top-right card action buttons ([i] Info, [↻] Rotate, [×] Remove — stripped on SVG export)
    const qy = box.y + 3.5;
    const makeCardActionBtn = (cls, bx, label, fontFam, fontStyle, fontSize, strokeCol, fillCol, txtCol, onClick, tipHtml) => {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', `comp-quick-btn ${cls}`);
      const r = document.createElementNS(SVG_NS, 'rect');
      r.setAttribute('x', bx.toFixed(1));
      r.setAttribute('y', qy.toFixed(1));
      r.setAttribute('width', '16');
      r.setAttribute('height', '16');
      r.setAttribute('rx', '4');
      r.setAttribute('fill', fillCol);
      r.setAttribute('stroke', strokeCol);
      r.setAttribute('stroke-width', '1');
      g.appendChild(r);

      const txt = document.createElementNS(SVG_NS, 'text');
      txt.setAttribute('x', (bx + 8).toFixed(1));
      txt.setAttribute('y', (qy + 11.7).toFixed(1));
      txt.setAttribute('fill', txtCol);
      txt.setAttribute('font-family', fontFam);
      if (fontStyle) txt.setAttribute('font-style', fontStyle);
      txt.setAttribute('font-size', fontSize);
      txt.setAttribute('font-weight', '700');
      txt.setAttribute('text-anchor', 'middle');
      txt.textContent = label;
      g.appendChild(txt);

      g.addEventListener('click', (e: any) => {
        e.stopPropagation();
        onClick(e);
      });
      g.addEventListener('mouseenter', (ev: any) => {
        if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:showCustom', { html: tipHtml, ev: ev });
      });
      g.addEventListener('mouseleave', () => appBus.emit('tooltip:hide'));
      return g;
    };

    // 1. [i] Info button
    hdrContent.appendChild(makeCardActionBtn(
      'comp-quick-info',
      box.x + box.w - 58,
      'i',
      "Georgia, 'Times New Roman', serif",
      'italic',
      '11',
      light ? '#cbd5e1' : '#384a63',
      light ? '#ffffff' : '#0f172a',
      light ? '#0369a1' : '#38bdf8',
      () => appBus.emit('modal:openComponentInfo', { compId: def.id }),
      t('card.infoTip', { name: escapeHtml(getDisplayLabel(def)) })
    ));

    // 2. [↻] Quick +90° Rotate button
    hdrContent.appendChild(makeCardActionBtn(
      'comp-quick-rotate',
      box.x + box.w - 39,
      '↻',
      'system-ui, sans-serif',
      '',
      '11',
      light ? '#cbd5e1' : '#384a63',
      light ? '#ffffff' : '#0f172a',
      light ? '#0f172a' : '#e0f2fe',
      (e) => quickRotateComponent(box.inst.instanceId, e.shiftKey ? -90 : 90),
      t('card.rotTip')
    ));

    // 3. [✕] Remove button
    hdrContent.appendChild(makeCardActionBtn(
      'comp-quick-remove',
      box.x + box.w - 20,
      '✕',
      'system-ui, sans-serif',
      '',
      '9.5',
      light ? '#fca5a5' : '#7f1d1d',
      light ? '#fef2f2' : '#1f0d12',
      light ? '#b91c1c' : '#fca5a5',
      () => removeComponent(box.inst.instanceId),
      t('card.delTip', { name: escapeHtml(getDisplayLabel(def)) })
    ));

    // Upright (0°) standalone component SVG fit inside card
    const [vw, vh] = def.viewBox;
    const innerW = box.w - 20;
    const innerH = box.h - 32;
    const scale = Math.min(innerW / vw, innerH / vh, 1.05);
    const drawW = vw * scale;
    const drawH = vh * scale;
    const drawX = box.x + (box.w - drawW) / 2;
    const drawY = box.y + 27 + (innerH - drawH) / 2;

    const svgDocEl = state.svgCache.get(def.svgFile);
    if (svgDocEl) {
      const innerG = document.createElementNS(SVG_NS, 'g');
      innerG.setAttribute('class', 'comp-svg-inner');
      innerG.setAttribute('transform', `translate(${drawX.toFixed(1)}, ${drawY.toFixed(1)}) scale(${scale.toFixed(4)})`);
      const uid = box.inst.instanceId + '_';
      const clone = document.importNode(svgDocEl, true);
      clone.querySelectorAll('[id]').forEach((el) => el.setAttribute('id', uid + el.getAttribute('id')));
      clone.querySelectorAll('[fill^="url(#"]').forEach((el) => {
        el.setAttribute('fill', el.getAttribute('fill').replace('url(#', `url(#${uid}`));
      });
      while (clone.firstChild) innerG.appendChild(clone.firstChild);
      cardG.appendChild(innerG);
    }

    // Highlight unassigned pins requiring student action (freeing an onboard pin)
    const missingPins = def.pins.filter((p) => p.selectable && !box.inst.pinMap[p.id]);
    if (missingPins.length) {
      rect.setAttribute('stroke', '#f59e0b');
      rect.setAttribute('stroke-width', '2.4');
      const warnPill = document.createElementNS(SVG_NS, 'rect');
      warnPill.setAttribute('x', (box.x + 8).toFixed(1));
      warnPill.setAttribute('y', (box.y + box.h - 22).toFixed(1));
      warnPill.setAttribute('width', (box.w - 16).toFixed(1));
      warnPill.setAttribute('height', '17');
      warnPill.setAttribute('rx', '4');
      warnPill.setAttribute('fill', light ? '#fef3c7' : '#78350f');
      warnPill.setAttribute('stroke', '#f59e0b');
      warnPill.setAttribute('stroke-width', '1.2');
      cardG.appendChild(warnPill);

      const warnLbl = document.createElementNS(SVG_NS, 'text');
      warnLbl.setAttribute('x', (box.x + box.w / 2).toFixed(1));
      warnLbl.setAttribute('y', (box.y + box.h - 10.5).toFixed(1));
      warnLbl.setAttribute('fill', light ? '#92400e' : '#fef3c7');
      warnLbl.setAttribute('font-family', 'Consolas, monospace');
      warnLbl.setAttribute('font-size', '9.2');
      warnLbl.setAttribute('font-weight', '800');
      warnLbl.setAttribute('text-anchor', 'middle');
      warnLbl.textContent = t('card.freePinWarn', { caps: (missingPins[0].allowedTypes || ['IO']).join('/'), pins: missingPins.map((p) => p.id).join(',') });
      cardG.appendChild(warnLbl);

      for (const mp of missingPins) {
        const anc = def.pinAnchors[mp.id];
        if (!anc) continue;
        const px = drawX + anc[0] * scale;
        const py = drawY + anc[1] * scale;
        const ring = document.createElementNS(SVG_NS, 'circle');
        ring.setAttribute('cx', px.toFixed(1));
        ring.setAttribute('cy', py.toFixed(1));
        ring.setAttribute('r', '8.5');
        ring.setAttribute('fill', 'rgba(245, 158, 11, 0.25)');
        ring.setAttribute('stroke', '#f59e0b');
        ring.setAttribute('class', 'pin-needs-free');
        cardG.appendChild(ring);
      }
    }

    // Interactive mouse rotation handle (stripped automatically during SVG export)
    const rotG = document.createElementNS(SVG_NS, 'g');
    rotG.setAttribute('class', 'comp-rotate-handle');
    rotG.setAttribute('data-inst-id', box.inst.instanceId);

    const rotStem = document.createElementNS(SVG_NS, 'line');
    rotStem.setAttribute('x1', cx.toFixed(1));
    rotStem.setAttribute('y1', box.y.toFixed(1));
    rotStem.setAttribute('x2', cx.toFixed(1));
    rotStem.setAttribute('y2', (box.y - 12).toFixed(1));
    rotStem.setAttribute('stroke', '#38bdf8');
    rotStem.setAttribute('stroke-width', '1.4');
    rotStem.setAttribute('stroke-dasharray', '2,2');
    rotG.appendChild(rotStem);

    const rotHit = document.createElementNS(SVG_NS, 'circle');
    rotHit.setAttribute('cx', cx.toFixed(1));
    rotHit.setAttribute('cy', (box.y - 18).toFixed(1));
    rotHit.setAttribute('r', isMobileViewport() ? '18' : '12');
    rotHit.setAttribute('fill', 'transparent');
    rotG.appendChild(rotHit);

    const rotKnob = document.createElementNS(SVG_NS, 'circle');
    rotKnob.setAttribute('class', 'rot-knob');
    rotKnob.setAttribute('cx', cx.toFixed(1));
    rotKnob.setAttribute('cy', (box.y - 18).toFixed(1));
    rotKnob.setAttribute('r', '7.5');
    rotKnob.setAttribute('fill', light ? '#ffffff' : '#1e293b');
    rotKnob.setAttribute('stroke', light ? '#0284c7' : '#38bdf8');
    rotKnob.setAttribute('stroke-width', '1.5');
    rotG.appendChild(rotKnob);

    const rotArc = document.createElementNS(SVG_NS, 'path');
    rotArc.setAttribute('d', `M ${(cx - 3.3).toFixed(1)} ${(box.y - 18.6).toFixed(1)} A 3.4 3.4 0 1 1 ${(cx + 2.5).toFixed(1)} ${(box.y - 15.6).toFixed(1)}`);
    rotArc.setAttribute('fill', 'none');
    rotArc.setAttribute('stroke', light ? '#0369a1' : '#e0f2fe');
    rotArc.setAttribute('stroke-width', '1.3');
    rotArc.setAttribute('stroke-linecap', 'round');
    rotArc.setAttribute('pointer-events', 'none');
    rotG.appendChild(rotArc);

    const rotArrow = document.createElementNS(SVG_NS, 'polygon');
    rotArrow.setAttribute('points', `${(cx - 5.1).toFixed(1)},${(box.y - 18.0).toFixed(1)} ${(cx - 1.5).toFixed(1)},${(box.y - 18.0).toFixed(1)} ${(cx - 3.3).toFixed(1)},${(box.y - 21.0).toFixed(1)}`);
    rotArrow.setAttribute('fill', light ? '#0369a1' : '#e0f2fe');
    rotArrow.setAttribute('pointer-events', 'none');
    rotG.appendChild(rotArrow);

    rotG.addEventListener('mouseenter', (ev: any) => {
      if (state.dragWire || state.dragComp || state.rotateComp) return;
      const curRot = box.inst.rotation || 0;
      appBus.emit('tooltip:showCustom', { html: t('card.rotHandleTip', { name: escapeHtml(def.name), deg: curRot }), ev: ev });
    });
    rotG.addEventListener('mousemove', (ev: any) => {
      if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:move', { ev: ev });
    });
    rotG.addEventListener('mouseleave', () => appBus.emit('tooltip:hide'));
    rotG.addEventListener('dblclick', (e: any) => {
      e.stopPropagation();
      if (box.inst.rotation && box.inst.rotation % 360 !== 0) {
        box.inst.rotation = 0;
        updateResetPositionsVisibility();
        showToast(t('toast.resetCardRot', { name: def.name }));
        renderDockedComponentsAndWires();
      }
    });
    cardG.appendChild(rotG);

    compLayer.appendChild(cardG);
    prepareCardFlipTexts(cardG, box);
    updateCardTextOrientations(cardG, rot);
    state.placedEntries.push({ box, def, cardG, drawX, drawY, scale });
  }

  renderMountedWirelessModules(compLayer);
  renderWiresAndHandles(null, 0, 0);
}
