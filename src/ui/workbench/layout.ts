// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Workbench Viewport, Zoom/Pan Geometry, Card Layout & Orientation Helpers
import { SVG_NS, BASE_VB } from '../../core/constants';
import { state, $, showToast, syncWorkbenchToggles } from '../../core/state';
import { getCompDef } from '../../core/hardware';
import { getRotatedBoxBounds, boardToMaster } from '../../core/routing';
import { getActiveBoard, getBoardGeometry } from '../../boards';
import { t } from '../../i18n/index';
import { appBus } from '../../store/bus';

export function applyViewBox() {
  const svg = $('#masterSvg');
  if (!Number.isFinite(state.vb.x) || !Number.isFinite(state.vb.y) ||
      !Number.isFinite(state.vb.w) || !Number.isFinite(state.vb.h) ||
      state.vb.w <= 0 || state.vb.h <= 0) {
    state.vb = { ...BASE_VB };
  }
  const { x, y, w, h } = state.vb;
  svg.setAttribute('viewBox', `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
  $('#btnZoomPct').textContent = `${Math.round((BASE_VB.w / w) * 100)}%`;
}

export function clientToSvgWithVb(clientX, clientY, vb) {
  const svg = $('#masterSvg');
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height || !vb.w || !vb.h) return { x: 0, y: 0 };
  const pxPerUnit = Math.min(rect.width / vb.w, rect.height / vb.h);
  const offX = (rect.width - vb.w * pxPerUnit) / 2;
  const offY = (rect.height - vb.h * pxPerUnit) / 2;
  return {
    x: vb.x + (clientX - rect.left - offX) / pxPerUnit,
    y: vb.y + (clientY - rect.top - offY) / pxPerUnit
  };
}

export function clientToSvg(clientX, clientY) {
  return clientToSvgWithVb(clientX, clientY, state.vb);
}

export function zoomAt(factor, centerX, centerY) {
  const newW = Math.max(BASE_VB.w / 4.5, Math.min(BASE_VB.w / 0.4, state.vb.w * factor));
  const newH = newW * (BASE_VB.h / BASE_VB.w);
  const ratio = newW / state.vb.w;
  state.vb.x = centerX - (centerX - state.vb.x) * ratio;
  state.vb.y = centerY - (centerY - state.vb.y) * ratio;
  state.vb.w = newW;
  state.vb.h = newH;
  applyViewBox();
}

export function prepareCardFlipTexts(cardG, box) {
  const hdrContent = cardG.querySelector('.card-hdr-content');
  if (hdrContent) {
    hdrContent.dataset.flipCx = (box.x + box.w / 2).toFixed(1);
    hdrContent.dataset.flipCy = (box.y + 11.5).toFixed(1);
  }

  cardG.querySelectorAll('.comp-svg-inner text').forEach((el) => {
    const origTr = el.getAttribute('transform') || '';
    el.dataset.origTransform = origTr;
    const rotMatch = origTr.match(/rotate\(\s*([-\d.]+)/);
    el.dataset.origAngle = rotMatch ? String(parseFloat(rotMatch[1])) : '0';

    let tx = null;
    let ty = null;
    try {
      const bb = el.getBBox();
      if (bb && bb.width > 0 && bb.height > 0) {
        tx = bb.x + bb.width / 2;
        ty = bb.y + bb.height / 2;
      }
    } catch (_) {}

    if (tx === null || ty === null || !Number.isFinite(tx) || !Number.isFinite(ty)) {
      const x = parseFloat(el.getAttribute('x') || '0');
      const y = parseFloat(el.getAttribute('y') || '0');
      const fs = parseFloat(el.getAttribute('font-size') || '8');
      const anchor = el.getAttribute('text-anchor') || 'start';
      const tw = (el.textContent || '').trim().length * fs * 0.6;
      tx = anchor === 'middle' ? x : (anchor === 'end' ? x - tw / 2 : x + tw / 2);
      ty = y - fs * 0.3;
    }
    el.dataset.flipCx = tx.toFixed(2);
    el.dataset.flipCy = ty.toFixed(2);
  });
}

export function updateCardTextOrientations(cardG, deg) {
  if (!cardG) return;
  const normDeg = ((deg % 360) + 360) % 360;
  const flipHdr = normDeg > 90 && normDeg < 270;

  const hdrContent = cardG.querySelector('.card-hdr-content');
  if (hdrContent) {
    if (flipHdr) {
      hdrContent.setAttribute('transform', `rotate(180, ${hdrContent.dataset.flipCx}, ${hdrContent.dataset.flipCy})`);
    } else {
      hdrContent.removeAttribute('transform');
    }
  }

  cardG.querySelectorAll('.comp-svg-inner text').forEach((el) => {
    const origAngle = parseFloat(el.dataset.origAngle || '0');
    const netAngle = (((origAngle + normDeg) % 360) + 360) % 360;
    const shouldFlip = netAngle > 90 && netAngle < 270;
    const origTr = el.dataset.origTransform || '';
    if (shouldFlip) {
      const flipTr = `rotate(180, ${el.dataset.flipCx}, ${el.dataset.flipCy})`;
      el.setAttribute('transform', origTr ? `${origTr} ${flipTr}` : flipTr);
    } else if (origTr) {
      el.setAttribute('transform', origTr);
    } else {
      el.removeAttribute('transform');
    }
  });
}

export function computePlacedBoxes() {
  const leftItems = [];
  const rightItems = [];
  state.active.forEach((inst) => {
    const def = getCompDef(inst.compId);
    if (!def || def.onboardWirelessSlot) return;
    if (def.interface === 'I2C' && rightItems.length <= leftItems.length + 1) rightItems.push(inst);
    else if (leftItems.length <= rightItems.length) leftItems.push(inst);
    else rightItems.push(inst);
  });

  const dockLayout = (list, side) => {
    const count = list.length;
    if (!count) return [];
    const padTop = 18;
    const availH = 654;
    const slotH = Math.min(205, availH / count);
    const cardW = 278;
    const cardX = side === 'left' ? 18 : 1320 - 18 - cardW;
    return list.map((inst, idx) => {
      const defaultX = cardX;
      const defaultY = padTop + idx * slotH + (availH - count * slotH) / 2;
      const defaultH = slotH - 12;
      if (inst.customPos) {
        return {
          inst,
          side,
          x: inst.customPos.x,
          y: inst.customPos.y,
          w: inst.customPos.w || cardW,
          h: inst.customPos.h || defaultH
        };
      }
      return { inst, side, x: defaultX, y: defaultY, w: cardW, h: defaultH };
    });
  };

  return [...dockLayout(leftItems, 'left'), ...dockLayout(rightItems, 'right')];
}

export function computeLayoutBounds() {
  let minX = BASE_VB.x;
  let minY = BASE_VB.y;
  let maxX = BASE_VB.x + BASE_VB.w;
  let maxY = BASE_VB.y + BASE_VB.h;

  const boxes = computePlacedBoxes();
  for (const b of boxes) {
    const rb = getRotatedBoxBounds(b);
    minX = Math.min(minX, rb.minX - 34);
    minY = Math.min(minY, rb.minY - 34);
    maxX = Math.max(maxX, rb.maxX + 34);
    maxY = Math.max(maxY, rb.maxY + 38);
  }
  if (boxes.length) {
    const geom = getBoardGeometry();
    minY = Math.min(minY, geom.top - 60);
    maxY = Math.max(maxY, geom.bottom + 75);
  }

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const targetAspect = BASE_VB.w / BASE_VB.h;
  let w = rawW;
  let h = rawH;
  if (rawW / rawH > targetAspect) {
    h = rawW / targetAspect;
    minY -= (h - rawH) / 2;
  } else {
    w = rawH * targetAspect;
    minX -= (w - rawW) / 2;
  }
  return { x: minX, y: minY, w, h };
}

export function resetViewFit() {
  state.vb = computeLayoutBounds();
  applyViewBox();
}

export function zoomToBoard() {
  const g = getBoardGeometry();
  state.vb = { x: Math.round(g.left - 32), y: Math.round(g.top - 18), w: Math.round(g.width + 64), h: Math.round(g.height + 36) };
  applyViewBox();
}

export function capturePointerSafe(pointerId) {
  const svg = $('#masterSvg');
  try { if (svg.setPointerCapture) svg.setPointerCapture(pointerId); } catch (_) {}
}

export function releasePointerSafe(pointerId) {
  const svg = $('#masterSvg');
  try {
    if (pointerId !== undefined && svg.hasPointerCapture && svg.hasPointerCapture(pointerId)) {
      svg.releasePointerCapture(pointerId);
    }
  } catch (_) {}
}

export function panToComponent(instanceId) {
  const entry = (state.placedEntries || []).find((e) => e.box.inst.instanceId === instanceId);
  if (!entry) return;
  const rb = getRotatedBoxBounds(entry.box, entry.box.inst.rotation || 0);
  const pad = 36;
  const inView = rb.minX >= state.vb.x + pad &&
    rb.maxX <= state.vb.x + state.vb.w - pad &&
    rb.minY >= state.vb.y + pad &&
    rb.maxY <= state.vb.y + state.vb.h - pad;
  if (inView) return;

  const boxW = rb.maxX - rb.minX + pad * 2;
  const boxH = rb.maxY - rb.minY + pad * 2;
  if (boxW > state.vb.w || boxH > state.vb.h) {
    resetViewFit();
    return;
  }
  const cx = (rb.minX + rb.maxX) / 2;
  const cy = (rb.minY + rb.maxY) / 2;
  state.vb.x = cx - state.vb.w / 2;
  state.vb.y = cy - state.vb.h / 2;
  applyViewBox();
}

export function renderRotationBadge(cx, cy, deg) {
  const layer = $('#dragOverlayLayer');
  layer.innerHTML = '';
  const pw = 46;
  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('x', (cx - pw / 2).toFixed(1));
  bg.setAttribute('y', (cy - 11).toFixed(1));
  bg.setAttribute('width', String(pw));
  bg.setAttribute('height', '22');
  bg.setAttribute('rx', '6');
  bg.setAttribute('fill', '#0f172a');
  bg.setAttribute('stroke', '#38bdf8');
  bg.setAttribute('stroke-width', '1.4');
  layer.appendChild(bg);

  const lbl = document.createElementNS(SVG_NS, 'text');
  lbl.setAttribute('x', cx.toFixed(1));
  lbl.setAttribute('y', (cy + 3.8).toFixed(1));
  lbl.setAttribute('fill', '#e0f2fe');
  lbl.setAttribute('font-family', 'Consolas, monospace');
  lbl.setAttribute('font-size', '11');
  lbl.setAttribute('font-weight', '700');
  lbl.setAttribute('text-anchor', 'middle');
  lbl.textContent = `${deg}°`;
  layer.appendChild(lbl);
}

export function updateResetPositionsVisibility() {
  const hasMoved = state.active.some((i) => !!i.customPos || !!(i.rotation && i.rotation % 360 !== 0));
  const hasActive = state.active.some((i) => !getCompDef(i.compId)?.onboardWirelessSlot);
  const btn = $('#btnResetPositions');
  if (btn) btn.classList.toggle('hidden', !hasMoved);
  const tidyBtn = $('#btnAutoLayout');
  if (tidyBtn) tidyBtn.classList.toggle('hidden', !hasActive);
  const sep = $('#hudOptLayoutSep');
  if (sep) sep.classList.toggle('hidden', !hasActive && !hasMoved);
  syncWorkbenchToggles();
}

export function autoLayoutComponents() {
  if (!state.active.length) return;
  appBus.emit('history:push');

  const g = getBoardGeometry();
  const boardMidX = g.left + g.width / 2;
  const leftGroup = [];
  const rightGroup = [];

  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def || def.onboardWirelessSlot) continue;
    let sumX = 0, sumY = 0, cnt = 0;
    for (const p of def.pins) {
      const bpId = inst.pinMap[p.id];
      const raw = bpId && getActiveBoard().pins[bpId];
      if (!raw) continue;
      const weight = (p.role === 'POWER' || p.role === 'GND') ? 0.25 : 1.0;
      const mPt = boardToMaster(raw.x, raw.y);
      sumX += mPt.x * weight;
      sumY += mPt.y * weight;
      cnt += weight;
    }
    const avgX = cnt ? sumX / cnt : boardMidX;
    const avgY = cnt ? sumY / cnt : 345;
    const side = avgX < boardMidX ? 'left' : 'right';
    (side === 'left' ? leftGroup : rightGroup).push({ inst, avgY });
  }

  leftGroup.sort((a, b) => a.avgY - b.avgY);
  rightGroup.sort((a, b) => a.avgY - b.avgY);

  const placeColumn = (list, side) => {
    const count = list.length;
    if (!count) return;
    const padTop = 18;
    const availH = 654;
    const slotH = Math.min(200, availH / count);
    const cardW = 278;
    const cardH = Math.max(122, Math.round(slotH - 12));
    const cardX = side === 'left' ? 18 : 1320 - 18 - cardW;
    list.forEach(({ inst }, idx) => {
      const y = Math.round(padTop + idx * slotH + (availH - count * slotH) / 2);
      inst.customPos = { x: cardX, y, w: cardW, h: cardH };
      inst.rotation = 0;
    });
  };

  placeColumn(leftGroup, 'left');
  placeColumn(rightGroup, 'right');
  updateResetPositionsVisibility();
  resetViewFit();
  appBus.emit('workspace:recompute');
  showToast(t('toast.autoLayoutDone'));
}
