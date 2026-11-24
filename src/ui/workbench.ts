// Interactive Dark-Mode SVG Workbench (Board Mount, Zoom/Pan/Pinch, Drag, Rotate, Rewire & Inkscape-Safe Export)
import { SVG_NS, BASE_VB, GRID_SNAP, MAX_HISTORY, COPYRIGHT_AUTHOR, COPYRIGHT_NOTICE, CONFIGURATOR_REPO_URL } from '../core/constants';
import { state, hooks, $, escapeHtml, isLightTheme, getNetMeta, getCleanProjectName, getProjectSlug, showToast, isMobileViewport, syncWorkbenchToggles, getActiveOnboardDefs } from '../core/state';
import {
  getCompDef, getDisplayLabel, getInstanceAddress, getExternalPinClaims,
  getOnboardPinUsage, getSuitableBoardPins, applyI2CHeaderMapping,
  getPendingPins, autoConnectPendingPins, removeComponent, toggleDipSwitch,
  toggleOnboardComponent, computeDipStates, computeUartAssignments, getPinUsageCounts
} from '../core/hardware';
import { buildBreadboardBaseLayer, renderBreadboardActiveRails, allocateBreadboardRails, getBreadboardDropTarget } from '../core/breadboard';
import { buildCarrierBreadboardLayer, allocateCarrierBreadboardConnections, renderCarrierActiveOverlay, getCarrierRowAnchorBoardPt, getCarrierRowHoleTargets, getCarrierPowerRailTargets } from '../core/carrier-breadboard';
import {
  rotatePoint, getRotatedBoxBounds, boardToMaster, roundedOrthoPath,
  routeSmartWires, buildCurvedWirePath, buildCurvedFeederPath
} from '../core/routing';
import { shortInterfaceLabel } from './inspector';
import { t, tComp, tOnboard } from '../i18n/index';
import { getActiveBoard, getBoardGeometry, isBoardCarrierActive } from '../boards';

export function mountBoardSvg(svgText) {
  const board = getActiveBoard();
  const geom = getBoardGeometry(board);
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svgRoot = doc.documentElement;
  const mount = $('#boardMount');
  mount.innerHTML = '';
  mount.setAttribute('transform', `translate(${geom.tx}, ${geom.ty}) scale(${geom.scale})`);

  const styleEl = svgRoot.querySelector<any>('style');
  if (styleEl) mount.appendChild(document.importNode(styleEl, true));

  const carrierBaseG = document.createElementNS(SVG_NS, 'g');
  carrierBaseG.setAttribute('id', 'kcomp-carrier-base');
  const carrierActiveG = document.createElementNS(SVG_NS, 'g');
  carrierActiveG.setAttribute('id', 'kcomp-carrier-active');
  mount.appendChild(carrierBaseG);
  mount.appendChild(carrierActiveG);
  buildCarrierBreadboardLayer(carrierBaseG);

  const boardGroup = svgRoot.querySelector<any>('#kcomp-board-root');
  const imported = document.importNode(boardGroup, true);
  mount.appendChild(imported);
  state.boardSvgEl = imported;

  imported.querySelectorAll('.kcomp-pin-hit').forEach((hit) => {
    const pinId = hit.getAttribute('data-pin');
    hit.addEventListener('mouseenter', (e: any) => { if (!state.dragWire && !state.dragComp && !state.rotateComp) hooks.showPinTooltip(pinId, e); });
    hit.addEventListener('mousemove', (e: any) => { if (!state.dragWire && !state.dragComp && !state.rotateComp) hooks.moveTooltip(e); });
    hit.addEventListener('mouseleave', () => hooks.hideTooltip());
  });

  imported.querySelectorAll('[data-dip]').forEach((el) => {
    el.addEventListener('click', (e: any) => {
      e.stopPropagation();
      toggleDipSwitch(parseInt(el.getAttribute('data-dip'), 10));
    });
  });

  // Inject permanent breadboard internal-connection visual layer right before #kcomp-pin-highlights
  const pinHl = imported.querySelector('#kcomp-pin-highlights');
  const bbBaseG = document.createElementNS(SVG_NS, 'g');
  bbBaseG.setAttribute('id', 'kcomp-breadboard-base');
  const bbRailsG = document.createElementNS(SVG_NS, 'g');
  bbRailsG.setAttribute('id', 'kcomp-breadboard-rails');
  // Interactive Onboard PCB Hit Layer (allows clicking OLED, Joystick, LED, Pot, Buttons, Buzzer, HC-SR04, Wireless directly on PCB)
  const obHitG = document.createElementNS(SVG_NS, 'g');
  obHitG.setAttribute('id', 'kcomp-onboard-hit-layer');
  const obZones = board.onboardZones || [];
  for (const z of obZones) {
    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('class', 'ob-pcb-hit');
    r.setAttribute('data-ob-hit', z.id);
    r.setAttribute('x', String(z.x));
    r.setAttribute('y', String(z.y));
    r.setAttribute('width', String(z.w));
    r.setAttribute('height', String(z.h));
    r.setAttribute('rx', String(z.rx));
    r.setAttribute('style', `--ob-accent:${z.accent}`);
    r.addEventListener('click', (e: any) => {
      e.stopPropagation();
      if (state.suppressClick || state.dragWire || state.dragComp || state.rotateComp) return;
      toggleOnboardComponent(z.id);
    });
    r.addEventListener('mouseenter', (e: any) => {
      if (state.dragWire || state.dragComp || state.rotateComp) return;
      const dipStates = computeDipStates();
      const obDef = getActiveOnboardDefs().find((o) => o.id === z.id);
      if (z.id === 'onboard_wireless') {
        const d7 = dipStates.find((d) => d.id === 7);
        const d8 = dipStates.find((d) => d.id === 8);
        const blocked = d7?.forcedOff || d8?.forcedOff;
        const isOn = !blocked && (d7?.on || d8?.on);
        const status = blocked
          ? escapeHtml(t('onboard.wirelessBlocked'))
          : `<span class="tip-accent">${escapeHtml(isOn ? t('onboard.pcbClickDisable') : t('onboard.pcbClickEnable'))}</span>`;
        hooks.showCustomTooltip(`<strong>${escapeHtml(t('onboard.wireless'))}</strong> (S1-7,8 · D6/D7)<br>${status}`, e);
      } else if (obDef) {
        const dip = obDef.dip ? dipStates.find((d) => d.id === obDef.dip) : null;
        const blocked = dip && dip.forcedOff;
        const isOn = dip ? dip.on : !!state.onboard[obDef.id];
        const status = blocked
          ? escapeHtml(t('onboard.disabledReason', { name: tOnboard(obDef, 'name'), reason: dip.reason }))
          : `<span class="tip-accent">${escapeHtml(isOn ? t('onboard.pcbClickDisable') : t('onboard.pcbClickEnable'))}</span>`;
        hooks.showCustomTooltip(`<strong>${escapeHtml(tOnboard(obDef, 'name'))}</strong> (${escapeHtml(obDef.pinInfo)})<br>${status}`, e);
      }
    });
    r.addEventListener('mousemove', (e: any) => {
      if (!state.dragWire && !state.dragComp && !state.rotateComp) hooks.moveTooltip(e);
    });
    r.addEventListener('mouseleave', () => hooks.hideTooltip());
    obHitG.appendChild(r);
  }

  if (pinHl && pinHl.parentNode) {
    pinHl.parentNode.insertBefore(bbBaseG, pinHl);
    pinHl.parentNode.insertBefore(bbRailsG, pinHl);
    pinHl.parentNode.insertBefore(obHitG, pinHl);
  } else {
    imported.appendChild(bbBaseG);
    imported.appendChild(bbRailsG);
    imported.appendChild(obHitG);
  }
  buildBreadboardBaseLayer(bbBaseG);
}

const OB_BOUNDS = {
  onboard_oled:     { x: 323, y: 129, w: 72,  h: 84 },
  onboard_joystick: { x: 89,  y: 193, w: 82,  h: 90 },
  onboard_led:      { x: 288, y: 268, w: 32,  h: 32 },
  onboard_pot:      { x: 204, y: 288, w: 52,  h: 64 },
  onboard_start:    { x: 394, y: 268, w: 36,  h: 26 },
  onboard_select:   { x: 330, y: 268, w: 36,  h: 26 },
  onboard_buzzer:   { x: 429, y: 155, w: 46,  h: 46 },
  onboard_distance: { x: 456, y: 30,  w: 58,  h: 122 },
  onboard_wireless: { x: 179, y: 193, w: 116, h: 74 }
};


export function syncCarrierVisuals() {
  const board = getActiveBoard();
  const geom = getBoardGeometry(board, state.carrierEnabled);
  const mount = $('#boardMount');
  if (mount) {
    mount.setAttribute('transform', `translate(${geom.tx}, ${geom.ty}) scale(${geom.scale})`);
  }
  const carrierBaseG = document.querySelector<SVGGElement>('#kcomp-carrier-base');
  if (carrierBaseG) buildCarrierBreadboardLayer(carrierBaseG);
  const carrierActiveG = document.querySelector<SVGGElement>('#kcomp-carrier-active');
  if (carrierActiveG && !isBoardCarrierActive(board, state.carrierEnabled)) {
    carrierActiveG.innerHTML = '';
  }
}

export function setHwHover(hwId) {
  const svg = $('#masterSvg');
  if (!svg) return;
  const norm = hwId === 'oled_grid' ? 'onboard_oled' : (hwId || null);
  if (state.hoveredHwId === norm) return;
  state.hoveredHwId = norm;

  svg.querySelectorAll('.hw-hl').forEach((el) => el.classList.remove('hw-hl'));
  if (!norm) {
    svg.classList.remove('hw-hovering');
    return;
  }

  let matched = false;
  if (norm.startsWith('onboard_')) {
    const obHl = state.boardSvgEl?.querySelector<any>(`#ob-hl-${norm}`);
    const obHit = state.boardSvgEl?.querySelector<any>(`[data-ob-hit="${norm}"]`);
    if (obHl) { obHl.classList.add('hw-hl'); matched = true; }
    if (obHit) { obHit.classList.add('hw-hl'); matched = true; }
  } else {
    // Match either exact instanceId or all active instances of compId
    const instIds = state.active.some((i) => i.instanceId === norm)
      ? [norm]
      : state.active.filter((i) => i.compId === norm).map((i) => i.instanceId);
    for (const id of instIds) {
      svg.querySelectorAll(`[data-inst-id="${id}"]`).forEach((el) => {
        el.classList.add('hw-hl');
        matched = true;
      });
    }
  }
  svg.classList.toggle('hw-hovering', matched);
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

let flashTimer: ReturnType<typeof setTimeout> | null = null;
let lastCarrierWireHoles: Array<{ instId: string; compPinId: string; kind: string; bpId?: string; railId?: string; holeIdx: number }> = [];
export function flashTarget(opts: any = {}) {
  const svg = $('#masterSvg');
  if (!svg) return;
  if (opts.instanceId && opts.panIfOffscreen) {
    panToComponent(opts.instanceId);
  }
  svg.querySelectorAll('.hw-flash-group').forEach((n) => n.remove());
  clearTimeout(flashTimer);

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'hw-flash-group');
  g.setAttribute('pointer-events', 'none');

  if (opts.instanceId) {
    const entry = (state.placedEntries || []).find((e) => e.box.inst.instanceId === opts.instanceId);
    if (entry) {
      const rb = getRotatedBoxBounds(entry.box, entry.box.inst.rotation || 0);
      const r = document.createElementNS(SVG_NS, 'rect');
      r.setAttribute('x', (rb.minX - 6).toFixed(1));
      r.setAttribute('y', (rb.minY - 6).toFixed(1));
      r.setAttribute('width', (rb.maxX - rb.minX + 12).toFixed(1));
      r.setAttribute('height', (rb.maxY - rb.minY + 12).toFixed(1));
      r.setAttribute('rx', '13');
      r.setAttribute('class', 'hw-flash-ring');
      g.appendChild(r);
    }
  }
  if (opts.onboardId && OB_BOUNDS[opts.onboardId]) {
    const b = OB_BOUNDS[opts.onboardId];
    const tl = boardToMaster(b.x, b.y);
    const br = boardToMaster(b.x + b.w, b.y + b.h);
    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('x', (tl.x - 5).toFixed(1));
    r.setAttribute('y', (tl.y - 5).toFixed(1));
    r.setAttribute('width', (br.x - tl.x + 10).toFixed(1));
    r.setAttribute('height', (br.y - tl.y + 10).toFixed(1));
    r.setAttribute('rx', '8');
    r.setAttribute('class', 'hw-flash-ring');
    g.appendChild(r);
  }
  if (opts.pinId && getActiveBoard()?.pins?.[opts.pinId]) {
    const raw = getActiveBoard().pins[opts.pinId];
    const pt = boardToMaster(raw.x, raw.y);
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', pt.x.toFixed(1));
    c.setAttribute('cy', pt.y.toFixed(1));
    c.setAttribute('r', '14');
    c.setAttribute('class', 'hw-flash-ring is-amber');
    g.appendChild(c);
  }
  if (opts.dipNum && opts.dipNum >= 1 && opts.dipNum <= 8) {
    const dx = 335 + (opts.dipNum - 1) * 10;
    const tl = boardToMaster(dx - 3, 228);
    const br = boardToMaster(dx + 9, 250);
    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('x', tl.x.toFixed(1));
    r.setAttribute('y', tl.y.toFixed(1));
    r.setAttribute('width', (br.x - tl.x).toFixed(1));
    r.setAttribute('height', (br.y - tl.y).toFixed(1));
    r.setAttribute('rx', '4');
    r.setAttribute('class', 'hw-flash-ring is-amber');
    g.appendChild(r);
  }

  if (g.childNodes.length) {
    svg.appendChild(g);
    flashTimer = setTimeout(() => { g.remove(); }, 1450);
  }
}

export function setHoveredNet(netId) {
  const svg = $('#masterSvg');
  if (!svg) return;
  if (state.hoveredNet === netId) return;
  state.hoveredNet = netId || null;

  svg.querySelectorAll('.net-active').forEach((el) => el.classList.remove('net-active'));
  if (!state.hoveredNet) {
    svg.classList.remove('net-hovering');
    renderPinFlags();
    return;
  }
  svg.classList.add('net-hovering');
  svg.querySelectorAll(`[data-net-id="${state.hoveredNet}"]`).forEach((el) => {
    el.classList.add('net-active');
  });
  renderPinFlags();
}

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

export function startCompDrag(ev, instId) {
  const entry = state.placedEntries.find((e) => e.box.inst.instanceId === instId);
  if (!entry) return;

  ev.preventDefault();
  ev.stopPropagation();
  hooks.hideTooltip();
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
    preSnap: hooks.captureSnapshot(),
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
    hooks.hideTooltip();
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
      hooks.updateHistoryButtons();
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
  hooks.hideTooltip();
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
    preSnap: hooks.captureSnapshot(),
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
      hooks.updateHistoryButtons();
    }
    state.suppressClick = true;
    setTimeout(() => { state.suppressClick = false; }, 80);
    renderDockedComponentsAndWires();
  }
}

export function quickRotateComponent(instId, deltaDeg = 90) {
  const inst = state.active.find((i) => i.instanceId === instId);
  if (!inst || getCompDef(inst.compId)?.onboardWirelessSlot) return;
  hooks.pushUndoState();
  const cur = inst.rotation || 0;
  let next = Math.round((cur + deltaDeg) / 90) * 90;
  next = ((next % 360) + 360) % 360;
  inst.rotation = next;
  state.focusedId = instId;
  updateResetPositionsVisibility();
  renderDockedComponentsAndWires();
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
  hooks.pushUndoState();

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
  hooks.recomputeAndRender();
  showToast(t('toast.autoLayoutDone'));
}

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
  hooks.hideTooltip();

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
    hooks.hideTooltip();
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
    hooks.hideTooltip();
    handlePointerUp(null);
  };

  svg.addEventListener('mouseleave', () => {
    if (state.dragWire || state.dragComp || state.rotateComp) return;
    setHoveredNet(null);
    hooks.hideTooltip();
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
    hooks.pushUndoState();
    state.active.forEach((i) => { i.customPos = null; i.rotation = 0; });
    updateResetPositionsVisibility();
    resetViewFit();
    renderDockedComponentsAndWires();
  });
}

export function startWireDrag(ev, meta) {
  ev.stopPropagation();
  ev.preventDefault();
  hooks.hideTooltip();
  setHoveredNet(null);
  const pf = $('#pinFlagsLayer'); if (pf) pf.innerHTML = '';
  capturePointerSafe(ev.pointerId);

  const inst = state.active.find((i) => i.instanceId === meta.instanceId);
  if (!inst) return;
  const def = getCompDef(inst.compId);
  const pSpec = def.pins.find((p) => p.id === meta.compPinId);
  if (!pSpec) return;
  const board = getActiveBoard();
  const isI2C = ['I2C_VCC', 'I2C_GND', 'I2C_SCL', 'I2C_SDA'].includes(pSpec.role);
  const hasMultiI2cHeaders = Object.keys(board.i2cHeaders || {}).length > 1;
  const carrierOn = isBoardCarrierActive(board, state.carrierEnabled);

  // Collect currently occupied carrier breadboard holes (excluding the wire being dragged)
  const occupiedRowHoles = new Map<string, Set<number>>();
  const occupiedRailHoles = new Map<string, Set<number>>();
  if (carrierOn) {
    for (const h of lastCarrierWireHoles) {
      if (h.instId === inst.instanceId && h.compPinId === pSpec.id) continue;
      if (h.kind === 'row' && h.bpId) {
        if (!occupiedRowHoles.has(h.bpId)) occupiedRowHoles.set(h.bpId, new Set<number>());
        occupiedRowHoles.get(h.bpId)!.add(h.holeIdx);
      } else if (h.kind === 'rail' && h.railId) {
        if (!occupiedRailHoles.has(h.railId)) occupiedRailHoles.set(h.railId, new Set<number>());
        occupiedRailHoles.get(h.railId)!.add(h.holeIdx);
      }
    }
    for (const f of (state.carrierFeeders || [])) {
      if (f.feederPinId && typeof f.feederRowHoleIdx === 'number') {
        if (!occupiedRowHoles.has(f.feederPinId)) occupiedRowHoles.set(f.feederPinId, new Set<number>());
        occupiedRowHoles.get(f.feederPinId)!.add(f.feederRowHoleIdx);
      }
    }
  }

  let validTargets = [];
  let lockedTargets = [];
  if (isI2C && def.i2cHeaderSelectable && hasMultiI2cHeaders) {
    // K-Comp V2 multi-header mode (H1 / H2 / H3)
    const roleKey = pSpec.role.replace('I2C_', '');
    for (const [hk, hv] of Object.entries(board.i2cHeaders)) {
      const mainPin = hv[roleKey];
      for (const rk of ['VCC', 'GND', 'SCL', 'SDA']) {
        const bpId = hv[rk];
        const raw = board.pins[bpId];
        if (!raw) continue;
        validTargets.push({
          boardPinId: bpId,
          i2cHeader: hk,
          label: t('drag.i2cHeader', { hk }),
          shortLabel: bpId === mainPin ? hk : '',
          masterPt: boardToMaster(raw.x, raw.y)
        });
      }
    }
  } else if (pSpec.selectable || isI2C) {
    const cands = getSuitableBoardPins(pSpec, inst.instanceId, pSpec.id, def).filter((c) => !c.takenBy);
    for (const c of cands) {
      const raw = board.pins[c.id];
      if (!raw) continue;
      if (c.onboardBy) {
        const lockAnchor = getCarrierRowAnchorBoardPt(c.id) || raw;
        lockedTargets.push({
          boardPinId: c.id,
          onboardId: c.onboardBy.onboardId,
          onboardName: c.onboardBy.name,
          canToggle: !c.onboardBy.hardwired && !c.onboardBy.lockedBySlot,
          label: t('drag.lockedByOnboard', { pin: c.id, name: c.onboardBy.name }),
          shortLabel: c.id,
          masterPt: boardToMaster(lockAnchor.x, lockAnchor.y)
        });
      } else if (carrierOn) {
        // Expose EVERY free individual breadboard tie-point hole (e.g. 1a, 1b, 1c, 1d) on this row!
        for (const hTgt of getCarrierRowHoleTargets(c.id, raw, occupiedRowHoles)) {
          validTargets.push(hTgt);
        }
      } else {
        validTargets.push({
          boardPinId: c.id,
          label: c.label,
          shortLabel: c.id.replace('PWR_', ''),
          masterPt: boardToMaster(raw.x, raw.y)
        });
      }
    }
    // K-Comp V2: explicit drop target directly on the red Breadboard rail
    const bbTgt = getBreadboardDropTarget(pSpec, state.breadboardRails || []);
    if (bbTgt) validTargets.push(bbTgt);
    // ESP32-S3 Breadboard: explicit per-hole drop targets along outer Power Rails (Left +3.3V/GND, Right +5V/GND)
    if (carrierOn) {
      for (const rTgt of getCarrierPowerRailTargets(pSpec, def, occupiedRailHoles)) {
        validTargets.push(rTgt);
      }
    }
  } else {
    return;
  }

  state.focusedId = inst.instanceId;
  state.dragWire = {
    instanceId: inst.instanceId,
    pointerId: ev.pointerId,
    compPinId: pSpec.id,
    color: pSpec.color,
    isI2C,
    origHeader: inst.i2cHeader || null,
    origPin: inst.pinMap[pSpec.id],
    startPt: meta.startPt,
    exitX: meta.exitX,
    vertical: meta.vertical,
    validTargets,
    lockedTargets,
    snappedTarget: null,
    hoveredLocked: null,
    cursorPt: clientToSvg(ev.clientX, ev.clientY)
  };

  $('#masterSvg').classList.add('wiring-drag');
  const origWireEl = document.querySelector<any>(`[data-wire-key="${inst.instanceId}::${pSpec.id}"]`);
  if (origWireEl) { origWireEl.setAttribute('opacity', '0.18'); origWireEl.setAttribute('stroke-dasharray', '4,4'); }
  renderDragOverlay();
}

export function onWireDragMove(ev) {
  const dw = state.dragWire;
  if (!dw) return;
  dw.cursorPt = clientToSvg(ev.clientX, ev.clientY);

  let best = null;
  let bestScore = Infinity;
  for (const tgt of dw.validTargets) {
    const maxR = tgt.isCarrierHole ? 13 : (tgt.isBreadboardTarget ? 26 : 18);
    const d = Math.hypot(tgt.masterPt.x - dw.cursorPt.x, tgt.masterPt.y - dw.cursorPt.y);
    if (d < maxR && d < bestScore) {
      bestScore = d;
      best = tgt;
    }
  }
  dw.snappedTarget = best;

  let nearLock = null;
  if (!best && dw.lockedTargets && dw.lockedTargets.length) {
    let ld = 16;
    for (const lt of dw.lockedTargets) {
      const d = Math.hypot(lt.masterPt.x - dw.cursorPt.x, lt.masterPt.y - dw.cursorPt.y);
      if (d < ld) {
        ld = d;
        nearLock = lt;
      }
    }
  }
  dw.hoveredLocked = nearLock;
  renderDragOverlay();
}

export function onWireDragEnd() {
  const dw = state.dragWire;
  if (!dw) return;
  releasePointerSafe(dw.pointerId);
  $('#masterSvg').classList.remove('wiring-drag');

  const inst = state.active.find((i) => i.instanceId === dw.instanceId);
  const def = inst ? getCompDef(inst.compId) : null;

  if (dw.snappedTarget && inst && def) {
    if (dw.isI2C && dw.snappedTarget.i2cHeader) {
      const newHdr = dw.snappedTarget.i2cHeader;
      if (newHdr !== dw.origHeader) {
        hooks.pushUndoState();
        applyI2CHeaderMapping(inst, def, newHdr);
        autoConnectPendingPins();
        showToast(t('toast.rewiredI2c', { comp: getDisplayLabel(def), header: newHdr }));
      }
    } else if (dw.snappedTarget.boardPinId) {
      const newPin = dw.snappedTarget.boardPinId;
      if (!inst.bbPins) inst.bbPins = {};
      const origBb = inst.bbPins[dw.compPinId] ?? null;
      const isSharedRole = ['GND', 'POWER_5V', 'POWER_3V3', 'RESET'].includes(
        (def.pins.find((p) => p.id === dw.compPinId)?.role) || ''
      );
      let nextBb: boolean | string | null = null;
      if (dw.snappedTarget.forceBreadboard) {
        nextBb = true;
      } else if (dw.snappedTarget.carrierRailId && typeof dw.snappedTarget.carrierRailHoleIdx === 'number') {
        nextBb = `rail:${dw.snappedTarget.carrierRailId}:${dw.snappedTarget.carrierRailHoleIdx}`;
      } else if (dw.snappedTarget.carrierRailId) {
        nextBb = dw.snappedTarget.carrierRailId;
      } else if (typeof dw.snappedTarget.carrierRowHoleIdx === 'number') {
        // Exact individual breadboard tie-point hole (e.g. 1b -> 'hole:2')!
        nextBb = `hole:${dw.snappedTarget.carrierRowHoleIdx}`;
      } else if (isSharedRole && isBoardCarrierActive(getActiveBoard(), state.carrierEnabled)) {
        nextBb = 'direct';
      } else if (isSharedRole && getActiveBoard().breadboard) {
        const counts = getPinUsageCounts(inst.instanceId, dw.compPinId);
        nextBb = (counts[newPin] || 0) >= 1 ? true : null;
      }

      if (newPin !== dw.origPin || nextBb !== origBb) {
        hooks.pushUndoState();
        inst.pinMap[dw.compPinId] = newPin;
        if (nextBb === null) delete inst.bbPins[dw.compPinId];
        else inst.bbPins[dw.compPinId] = nextBb;
        autoConnectPendingPins();
        showToast(t('toast.rewired', { comp: getDisplayLabel(def), pin: dw.compPinId, dest: dw.snappedTarget.label }));
      }
    }
  } else if (dw.hoveredLocked) {
    const hl = dw.hoveredLocked;
    if (hl.canToggle && hl.onboardId && inst && def) {
      const targetInstId = inst.instanceId;
      const targetCompPinId = dw.compPinId;
      const targetPin = hl.boardPinId;
      const targetObId = hl.onboardId;
      showToast(
        t('toast.rewiredBlocked', { pin: targetPin, name: hl.onboardName || '' }),
        {
          actionLabel: t('toast.freeAndConnect', { name: hl.onboardName || targetPin }),
          duration: 5500,
          onAction: () => {
            const curInst = state.active.find((i) => i.instanceId === targetInstId);
            if (!curInst) return;
            hooks.pushUndoState();
            if (targetObId === 'onboard_wireless') state.onboard.onboard_wireless = false;
            else state.onboard[targetObId] = false;
            curInst.pinMap[targetCompPinId] = targetPin;
            autoConnectPendingPins();
            showToast(t('toast.rewired', { comp: getDisplayLabel(def), pin: targetCompPinId, dest: targetPin }));
            hooks.recomputeAndRender();
          }
        }
      );
    } else {
      showToast(t('toast.rewiredBlocked', { pin: hl.boardPinId, name: hl.onboardName || '' }));
    }
  }

  state.dragWire = null;
  state.suppressClick = true;
  setTimeout(() => { state.suppressClick = false; }, 60);
  $('#dragOverlayLayer').innerHTML = '';
  hooks.recomputeAndRender();
}

export function renderDragOverlay() {
  const layer = $('#dragOverlayLayer');
  layer.innerHTML = '';
  const dw = state.dragWire;
  if (!dw) return;

  const validIds = new Set(dw.validTargets.map((t) => t.boardPinId));
  const lockedIds = new Set((dw.lockedTargets || []).map((t) => t.boardPinId));

  // Dim all non-valid board pins so valid green drop targets stand out immediately
  for (const [bpId, raw] of Object.entries(getActiveBoard().pins || {})) {
    if (validIds.has(bpId) || lockedIds.has(bpId)) continue;
    const pt = boardToMaster(raw.x, raw.y);
    const dim = document.createElementNS(SVG_NS, 'circle');
    dim.setAttribute('cx', pt.x.toFixed(1));
    dim.setAttribute('cy', pt.y.toFixed(1));
    dim.setAttribute('r', '5.5');
    dim.setAttribute('fill', isLightTheme() ? 'rgba(248, 250, 252, 0.72)' : 'rgba(11, 17, 32, 0.72)');
    layer.appendChild(dim);
  }

  // Draw amber dashed indicators on pins locked by enabled onboard peripherals
  for (const lt of (dw.lockedTargets || [])) {
    const isHov = dw.hoveredLocked && dw.hoveredLocked.boardPinId === lt.boardPinId;
    const lRing = document.createElementNS(SVG_NS, 'circle');
    lRing.setAttribute('cx', lt.masterPt.x.toFixed(1));
    lRing.setAttribute('cy', lt.masterPt.y.toFixed(1));
    lRing.setAttribute('r', isHov ? '9.5' : '7.2');
    lRing.setAttribute('fill', isHov ? 'rgba(245, 158, 11, 0.30)' : 'rgba(245, 158, 11, 0.16)');
    lRing.setAttribute('stroke', '#f59e0b');
    lRing.setAttribute('stroke-width', isHov ? '2.1' : '1.5');
    lRing.setAttribute('stroke-dasharray', '3,2');
    layer.appendChild(lRing);

    if (isHov && lt.shortLabel) {
      const lTag = document.createElementNS(SVG_NS, 'text');
      lTag.setAttribute('x', lt.masterPt.x.toFixed(1));
      lTag.setAttribute('y', (lt.masterPt.y - 12).toFixed(1));
      lTag.setAttribute('fill', '#fbbf24');
      lTag.setAttribute('font-family', 'Consolas, monospace');
      lTag.setAttribute('font-size', '9.5');
      lTag.setAttribute('font-weight', '800');
      lTag.setAttribute('text-anchor', 'middle');
      lTag.setAttribute('stroke', '#090d16');
      lTag.setAttribute('stroke-width', '3');
      lTag.setAttribute('paint-order', 'stroke');
      lTag.textContent = `🔒 ${lt.shortLabel}`;
      layer.appendChild(lTag);
    }
  }

  // Draw bright emerald drop rings on all electrically valid free pins / I²C headers
  for (const tgt of dw.validTargets) {
    const isSnap = dw.snappedTarget === tgt;
    if (tgt.isCarrierHole) {
      const sz = isSnap ? 13 : 8.5;
      const hRect = document.createElementNS(SVG_NS, 'rect');
      hRect.setAttribute('x', (tgt.masterPt.x - sz / 2).toFixed(1));
      hRect.setAttribute('y', (tgt.masterPt.y - sz / 2).toFixed(1));
      hRect.setAttribute('width', String(sz));
      hRect.setAttribute('height', String(sz));
      hRect.setAttribute('rx', isSnap ? '3.2' : '2');
      hRect.setAttribute('class', isSnap ? 'pin-drop-snap' : 'pin-drop-target');
      layer.appendChild(hRect);
    } else if (tgt.isBreadboardTarget) {
      const boxR = document.createElementNS(SVG_NS, 'rect');
      const bw = isSnap ? 28 : 22;
      const bh = isSnap ? 28 : 22;
      boxR.setAttribute('x', (tgt.masterPt.x - bw / 2).toFixed(1));
      boxR.setAttribute('y', (tgt.masterPt.y - bh / 2).toFixed(1));
      boxR.setAttribute('width', String(bw));
      boxR.setAttribute('height', String(bh));
      boxR.setAttribute('rx', '6');
      boxR.setAttribute('class', isSnap ? 'pin-drop-snap' : 'pin-drop-target');
      layer.appendChild(boxR);
    } else {
      const ring = document.createElementNS(SVG_NS, 'circle');
      ring.setAttribute('cx', tgt.masterPt.x.toFixed(1));
      ring.setAttribute('cy', tgt.masterPt.y.toFixed(1));
      ring.setAttribute('r', isSnap ? '10.5' : '7.5');
      ring.setAttribute('class', isSnap ? 'pin-drop-snap' : 'pin-drop-target');
      layer.appendChild(ring);
    }

    const displayTag = isSnap && tgt.snapLabel ? tgt.snapLabel : tgt.shortLabel;
    if (displayTag) {
      const tag = document.createElementNS(SVG_NS, 'text');
      tag.setAttribute('x', tgt.masterPt.x.toFixed(1));
      tag.setAttribute('y', (tgt.masterPt.y - (isSnap ? 13.5 : 10.5)).toFixed(1));
      tag.setAttribute('fill', isSnap ? '#4ade80' : '#86efac');
      tag.setAttribute('font-family', 'Consolas, monospace');
      tag.setAttribute('font-size', isSnap ? '10.5' : '8.4');
      tag.setAttribute('font-weight', '800');
      tag.setAttribute('text-anchor', 'middle');
      tag.setAttribute('stroke', '#090d16');
      tag.setAttribute('stroke-width', '3');
      tag.setAttribute('paint-order', 'stroke');
      tag.textContent = displayTag;
      layer.appendChild(tag);
    }
  }

  const end = dw.snappedTarget ? dw.snappedTarget.masterPt : dw.cursorPt;
  const midY = (dw.startPt.y + end.y) / 2;
  const d = dw.vertical
    ? `M ${dw.startPt.x.toFixed(1)} ${dw.startPt.y.toFixed(1)} C ${dw.startPt.x.toFixed(1)} ${midY.toFixed(1)}, ${end.x.toFixed(1)} ${midY.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
    : `M ${dw.startPt.x.toFixed(1)} ${dw.startPt.y.toFixed(1)} C ${dw.exitX.toFixed(1)} ${dw.startPt.y.toFixed(1)}, ${dw.exitX.toFixed(1)} ${end.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;

  const glow = document.createElementNS(SVG_NS, 'path');
  glow.setAttribute('d', d);
  glow.setAttribute('fill', 'none');
  glow.setAttribute('stroke', dw.snappedTarget ? '#34d399' : '#38bdf8');
  glow.setAttribute('stroke-width', '7');
  glow.setAttribute('stroke-linecap', 'round');
  glow.setAttribute('opacity', '0.32');
  layer.appendChild(glow);

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', dw.color);
  path.setAttribute('stroke-width', '3.2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-dasharray', dw.snappedTarget ? '' : '7,4');
  layer.appendChild(path);

  const pillText = dw.snappedTarget
    ? t('drag.dropTo', { label: dw.snappedTarget.label })
    : (dw.hoveredLocked ? t('drag.lockedHint', { label: dw.hoveredLocked.label }) : t('drag.prompt'));
  const pw = pillText.length * 6.2 + 16;
  const vbLeft = state.vb.x + 8;
  const vbRight = state.vb.x + state.vb.w - pw - 8;
  const px = Math.max(vbLeft, Math.min(vbRight, end.x - pw / 2));
  const preferAbove = end.y - 44 >= state.vb.y + 6;
  const py = preferAbove ? (end.y - 44) : (end.y + 24);

  const pillBg = document.createElementNS(SVG_NS, 'rect');
  pillBg.setAttribute('x', px.toFixed(1));
  pillBg.setAttribute('y', py.toFixed(1));
  pillBg.setAttribute('width', pw.toFixed(1));
  pillBg.setAttribute('height', '20');
  pillBg.setAttribute('rx', '5');
  pillBg.setAttribute('fill', dw.snappedTarget ? '#052e16' : '#0f172a');
  pillBg.setAttribute('stroke', dw.snappedTarget ? '#34d399' : '#38bdf8');
  pillBg.setAttribute('stroke-width', '1.3');
  layer.appendChild(pillBg);

  const pillTxt = document.createElementNS(SVG_NS, 'text');
  pillTxt.setAttribute('x', (px + 8).toFixed(1));
  pillTxt.setAttribute('y', (py + 13.5).toFixed(1));
  pillTxt.setAttribute('fill', dw.snappedTarget ? '#a7f3d0' : '#e2e8f0');
  pillTxt.setAttribute('font-family', 'Consolas, monospace');
  pillTxt.setAttribute('font-size', '10');
  pillTxt.setAttribute('font-weight', '700');
  pillTxt.textContent = pillText;
  layer.appendChild(pillTxt);
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

export function updateBoardSvgState(dipStates) {
  if (!state.boardSvgEl) return;

  const dipById = {};
  for (const d of dipStates) {
    dipById[d.id] = d;
    const slider = state.boardSvgEl.querySelector<any>(`#dip-s1-${d.id}`);
    if (!slider) continue;
    slider.setAttribute('y', d.on ? '0.5' : '7.5');
    slider.setAttribute('fill', d.on ? '#ffffff' : (d.forcedOff ? '#fde047' : '#fca5a5'));
  }

  const setObHl = (id, isOn) => {
    const g = state.boardSvgEl.querySelector<any>(`#ob-hl-${id}`);
    if (g) g.classList.toggle('active', !!isOn);
  };
  const board = getActiveBoard();
  if (board.id === 'kcomp-v2') {
    setObHl('onboard_oled',     state.onboard.onboard_oled);
    setObHl('onboard_joystick', state.onboard.onboard_joystick);
    setObHl('onboard_led',      dipById[2]?.on);
    setObHl('onboard_pot',      dipById[3]?.on);
    setObHl('onboard_start',    dipById[4]?.on);
    setObHl('onboard_select',   dipById[5]?.on);
    setObHl('onboard_buzzer',   dipById[6]?.on);
    setObHl('onboard_distance', state.onboard.onboard_distance);
    setObHl('onboard_wireless', dipById[7]?.on || dipById[8]?.on);
  } else {
    for (const ob of getActiveOnboardDefs()) {
      setObHl(ob.id, !!state.onboard[ob.id]);
    }
  }

  const hl = state.boardSvgEl.querySelector<any>('#kcomp-pin-highlights');
  hl.innerHTML = '';

  const extClaims = getExternalPinClaims();
  const obUsage = getOnboardPinUsage();

  const drawPinCross = (pt, ringCol, crossCol, fillCol) => {
    const r = document.createElementNS(SVG_NS, 'circle');
    r.setAttribute('cx', String(pt.x));
    r.setAttribute('cy', String(pt.y));
    r.setAttribute('r', '4.1');
    r.setAttribute('fill', fillCol);
    r.setAttribute('stroke', ringCol);
    r.setAttribute('stroke-width', '1.2');
    r.setAttribute('pointer-events', 'none');
    hl.appendChild(r);

    const xPath = document.createElementNS(SVG_NS, 'path');
    xPath.setAttribute('d', `M ${(pt.x - 1.9).toFixed(1)} ${(pt.y - 1.9).toFixed(1)} L ${(pt.x + 1.9).toFixed(1)} ${(pt.y + 1.9).toFixed(1)} M ${(pt.x + 1.9).toFixed(1)} ${(pt.y - 1.9).toFixed(1)} L ${(pt.x - 1.9).toFixed(1)} ${(pt.y + 1.9).toFixed(1)}`);
    xPath.setAttribute('stroke', crossCol);
    xPath.setAttribute('stroke-width', '1.25');
    xPath.setAttribute('stroke-linecap', 'round');
    xPath.setAttribute('pointer-events', 'none');
    hl.appendChild(xPath);
  };

  const signalPins = board.id === 'kcomp-v2'
    ? ['D13','D12','D11','D10','D9','D8','D7','D6','D5','D4','D3','D2','D1','D0','A0','A1','A2','A3']
    : Object.entries(board.pins).filter(([, meta]) => meta.signalPin).map(([id]) => id);
  for (const bpId of signalPins) {
    const pt = getActiveBoard().pins[bpId];
    if (!pt) continue;
    if (extClaims[bpId]) continue; // External connected wire dot drawn below

    if (pt.blocked) {
      drawPinCross(pt, '#ef4444', '#fecaca', 'rgba(127, 29, 29, 0.72)');
    } else if (obUsage[bpId]) {
      drawPinCross(pt, '#f59e0b', '#fde68a', 'rgba(120, 53, 15, 0.68)');
      const pendingNeed = getPendingPins().some((pp) => pp.eligibleOnboard.some((c) => c.id === bpId));
      if (pendingNeed) {
        const pulse = document.createElementNS(SVG_NS, 'circle');
        pulse.setAttribute('cx', String(pt.x));
        pulse.setAttribute('cy', String(pt.y));
        pulse.setAttribute('r', '6.8');
        pulse.setAttribute('fill', 'none');
        pulse.setAttribute('stroke', '#fbbf24');
        pulse.setAttribute('stroke-dasharray', '2.5,2');
        pulse.setAttribute('class', 'pin-needs-free');
        hl.appendChild(pulse);
      }
    } else {
      const freeRing = document.createElementNS(SVG_NS, 'circle');
      freeRing.setAttribute('cx', String(pt.x));
      freeRing.setAttribute('cy', String(pt.y));
      freeRing.setAttribute('r', '3.8');
      freeRing.setAttribute('fill', 'rgba(34, 197, 94, 0.14)');
      freeRing.setAttribute('stroke', '#22c55e');
      freeRing.setAttribute('stroke-width', '1.3');
      freeRing.setAttribute('opacity', '0.88');
      freeRing.setAttribute('pointer-events', 'none');
      hl.appendChild(freeRing);
    }
  }

  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def || def.onboardWirelessSlot) continue;
    const isFocused = !state.focusedId || state.focusedId === inst.instanceId;
    for (const p of def.pins) {
      const bpId = inst.pinMap[p.id];
      if (!bpId) continue;
      const pt = getActiveBoard().pins[bpId];
      if (!pt) continue;
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', String(pt.x));
      c.setAttribute('cy', String(pt.y));
      c.setAttribute('r', isFocused ? '3.4' : '2.4');
      c.setAttribute('fill', p.color);
      c.setAttribute('stroke', '#ffffff');
      c.setAttribute('stroke-width', isFocused ? '1.1' : '0.6');
      c.setAttribute('opacity', isFocused ? '0.95' : '0.35');
      c.setAttribute('pointer-events', 'none');
      hl.appendChild(c);
    }
  }
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
      hooks.recomputeAndRender();
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
        if (!state.dragWire && !state.dragComp && !state.rotateComp) hooks.showCustomTooltip(tipHtml, ev);
      });
      g.addEventListener('mouseleave', () => hooks.hideTooltip());
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
      () => hooks.openComponentInfo(def.id),
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
      hooks.showCustomTooltip(t('card.rotHandleTip', { name: escapeHtml(def.name), deg: curRot }), ev);
    });
    rotG.addEventListener('mousemove', (ev: any) => {
      if (!state.dragWire && !state.dragComp && !state.rotateComp) hooks.moveTooltip(ev);
    });
    rotG.addEventListener('mouseleave', () => hooks.hideTooltip());
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

function createSvgEl(tag, attrs = {}, text = null) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  if (text !== null) el.textContent = text;
  return el;
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
    infoBtnG.addEventListener('click', (e: any) => { e.stopPropagation(); hooks.openComponentInfo(def.id); });
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
      hooks.recomputeAndRender();
    });
    cardG.addEventListener('mouseenter', (e: any) => {
      if (state.dragWire || state.dragComp || state.rotateComp) return;
      hooks.showCustomTooltip(
        `<strong>${escapeHtml(getDisplayLabel(def))}</strong> (${escapeHtml(def.voltage)})<br><span class="tip-accent">${escapeHtml(t('tip.mountedSlot'))}</span>`,
        e
      );
    });
    cardG.addEventListener('mousemove', (e: any) => {
      if (!state.dragWire && !state.dragComp && !state.rotateComp) hooks.moveTooltip(e);
    });
    cardG.addEventListener('mouseleave', () => hooks.hideTooltip());

    compLayer.appendChild(cardG);
    state.placedEntries.push({ box, def, cardG, drawX: box.x, drawY: box.y, scale: 1, isBoardMounted: true });
  });
}

export function renderWiresAndHandles(dragInstId = null, dragDx = 0, dragDy = 0, dragRot = null) {
  const wiresLayer = $('#wiresLayer');
  const handlesLayer = $('#handlesLayer');
  wiresLayer.innerHTML = '';
  handlesLayer.innerHTML = '';
  setHoveredNet(null);
  hooks.hideTooltip();

  const light = isLightTheme();
  const haloCol = light ? '#ffffff' : '#090d16';
  const dotOutline = light ? '#334155' : '#0f172a';

  const uartAssigns = computeUartAssignments();
  const uartValues = Object.values(uartAssigns);
  const hasHwUart = uartValues.some((u) => u.kind === 'hw');
  const hasSwUart = uartValues.some((u) => u.kind === 'sw');
  $('#legHwUart')?.classList.toggle('hidden', !hasHwUart);
  $('#legSwUart')?.classList.toggle('hidden', !hasSwUart);

  const wireJobs = [];
  for (const entry of state.placedEntries) {
    if (entry.isBoardMounted) continue;
    const { def, scale } = entry;
    const isDragged = dragInstId && entry.box.inst.instanceId === dragInstId;
    const ox = isDragged ? dragDx : 0;
    const oy = isDragged ? dragDy : 0;
    const box = isDragged ? { ...entry.box, x: entry.box.x + ox, y: entry.box.y + oy } : entry.box;
    const rot = (isDragged && dragRot !== null) ? dragRot : (box.inst.rotation || 0);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const drawX = entry.drawX + ox;
    const drawY = entry.drawY + oy;
    const isFocused = !state.focusedId || state.focusedId === box.inst.instanceId || isDragged;
    const rb = getRotatedBoxBounds(box, rot);

    for (const p of def.pins) {
      const bpId = box.inst.pinMap[p.id];
      if (!bpId) continue;
      const boardPtRaw = getActiveBoard().pins[bpId];
      const compAnchor = def.pinAnchors[p.id];
      if (!boardPtRaw || !compAnchor) continue;

      const rawStartX = drawX + compAnchor[0] * scale;
      const rawStartY = drawY + compAnchor[1] * scale;
      const start = rotatePoint(rawStartX, rawStartY, cx, cy, rot);
      const end = boardToMaster(boardPtRaw.x, boardPtRaw.y);
      const net = getNetMeta(bpId);
      const isUartSignal = p.role === 'UART_RX' || p.role === 'UART_TX';
      const uartInfo = isUartSignal ? (uartAssigns[box.inst.instanceId] || null) : null;
      const wireColor = uartInfo
        ? (uartInfo.kind === 'hw'
            ? (p.role === 'UART_RX' ? '#06b6d4' : '#0ea5e9')
            : (p.role === 'UART_RX' ? '#c084fc' : '#f59e0b'))
        : p.color;
      const wireDash = (uartInfo && uartInfo.kind === 'sw') ? '6,3.5' : null;
      const bbPref = box.inst.bbPins ? box.inst.bbPins[p.id] : undefined;
      const forceBreadboard = bbPref === true;
      const carrierRailPref = typeof bbPref === 'string' ? bbPref : null;
      wireJobs.push({ entry, box, rb, def, p, bpId, net, rot, start, end, isFocused, uartInfo, wireColor, wireDash, forceBreadboard, carrierRailPref });
    }
  }

  // Promote shared pins used >= 2 times to dedicated breadboard distribution rails (Top half = Power, Bottom half = 4+ I²C Bus Expansion!)
  const rails = allocateBreadboardRails(wireJobs);
  state.breadboardRails = rails;
  renderBreadboardActiveRails(rails);

  // If a centered breadboard carrier is active (e.g. ESP32-S3 on Breadboard), map wires to breadboard rows & power rails!
  const carrierAlloc = allocateCarrierBreadboardConnections(wireJobs);
  state.carrierFeeders = carrierAlloc.feeders;
  lastCarrierWireHoles = wireJobs
    .filter((j) => j.carrierHole && typeof j.carrierHole.holeIdx === 'number')
    .map((j) => ({
      instId: j.box.inst.instanceId,
      compPinId: j.p.id,
      kind: j.carrierHole.kind,
      bpId: j.carrierHole.bpId,
      railId: j.carrierHole.railId,
      holeIdx: j.carrierHole.holeIdx
    }));
  renderCarrierActiveOverlay(carrierAlloc.activeStrips, carrierAlloc.activeRailIds);

  if (state.wireMode === 'smart') {
    routeSmartWires(wireJobs, rails);
  } else {
    wireJobs.forEach((job, idx) => {
      const laneOffset = ((idx % 11) - 5) * 9;
      job.routed = buildCurvedWirePath(
        { ...job.box, _curBpId: job.bpId, _isBreadboard: !!job.bbHole },
        job.start,
        job.end,
        laneOffset,
        job.rot
      );
    });
    rails.forEach((rail, idx) => {
      const f = buildCurvedFeederPath(rail, idx);
      rail.feederPathD = f.d;
      rail.feederStartPt = f.start;
    });
  }

  const netCounts = {};
  for (const j of wireJobs) {
    netCounts[j.net.id] = (netCounts[j.net.id] || 0) + 1;
  }

  const spotlightKey = null;

  // 0. Render Centered Breadboard Carrier Power-Rail Feeders (ESP32 pin -> Left 3.3V/GND or Right 5V/GND rail)
  for (const cf of (carrierAlloc.feeders || [])) {
    const cfg = document.createElementNS(SVG_NS, 'g');
    cfg.setAttribute('class', 'wire-net-group carrier-feeder-group');
    cfg.setAttribute('data-net-id', cf.netId);

    const cHalo = document.createElementNS(SVG_NS, 'path');
    cHalo.setAttribute('d', cf.pathD);
    cHalo.setAttribute('fill', 'none');
    cHalo.setAttribute('stroke', haloCol);
    cHalo.setAttribute('stroke-width', '5.2');
    cHalo.setAttribute('stroke-linecap', 'round');
    cHalo.setAttribute('stroke-linejoin', 'round');
    cHalo.setAttribute('opacity', '0.85');
    cHalo.setAttribute('pointer-events', 'none');
    cfg.appendChild(cHalo);

    const cWire = document.createElementNS(SVG_NS, 'path');
    cWire.setAttribute('d', cf.pathD);
    cWire.setAttribute('fill', 'none');
    cWire.setAttribute('stroke', cf.color);
    cWire.setAttribute('stroke-width', '2.8');
    cWire.setAttribute('stroke-linecap', 'round');
    cWire.setAttribute('stroke-linejoin', 'round');
    cWire.setAttribute('class', 'wire-stroke');
    cWire.setAttribute('pointer-events', 'none');
    cfg.appendChild(cWire);

    for (const pt of [cf.startMaster, cf.endMaster]) {
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', pt.x.toFixed(1));
      dot.setAttribute('cy', pt.y.toFixed(1));
      dot.setAttribute('r', '3.6');
      dot.setAttribute('fill', cf.color);
      dot.setAttribute('stroke', '#ffffff');
      dot.setAttribute('stroke-width', '1.1');
      dot.setAttribute('pointer-events', 'none');
      cfg.appendChild(dot);
    }

    const cHit = document.createElementNS(SVG_NS, 'path');
    cHit.setAttribute('d', cf.pathD);
    cHit.setAttribute('fill', 'none');
    cHit.setAttribute('stroke', 'transparent');
    cHit.setAttribute('stroke-width', '10');
    cHit.addEventListener('mouseenter', (ev: any) => {
      if (state.dragWire || state.dragComp || state.rotateComp) return;
      setHoveredNet(cf.netId);
      hooks.showCustomTooltip(
        `<strong>${escapeHtml(t('carrier.feederTip', { pin: cf.feederPinId, rail: cf.label }))}</strong>`,
        ev
      );
    });
    cHit.addEventListener('mousemove', (ev: any) => {
      if (!state.dragWire && !state.dragComp && !state.rotateComp) hooks.moveTooltip(ev);
    });
    cHit.addEventListener('mouseleave', () => {
      setHoveredNet(null);
      hooks.hideTooltip();
    });
    cfg.appendChild(cHit);
    wiresLayer.appendChild(cfg);
  }

  // 1. Render Breadboard Feeder wires (K-Comp shared pin -> Breadboard column hole 1)
  for (const rail of rails) {
    if (!rail.feederPathD || !rail.feederStartPt) continue;
    const feederKey = `feeder::${rail.bpId}`;
    const isSpotlight = spotlightKey && spotlightKey === feederKey;
    const anyBranchFocused = !state.focusedId || rail.branches.some((b) => b.box.inst.instanceId === state.focusedId) || !!dragInstId;
    const fOp = spotlightKey ? (isSpotlight ? 1 : 0.16) : (anyBranchFocused ? 0.96 : 0.2);

    const fg = document.createElementNS(SVG_NS, 'g');
    fg.setAttribute('class', 'wire-net-group');
    fg.setAttribute('data-net-id', rail.netId);

    const fHalo = document.createElementNS(SVG_NS, 'path');
    fHalo.setAttribute('d', rail.feederPathD);
    fHalo.setAttribute('fill', 'none');
    fHalo.setAttribute('stroke', isSpotlight ? '#38bdf8' : haloCol);
    fHalo.setAttribute('stroke-width', isSpotlight ? '9' : '5.6');
    fHalo.setAttribute('stroke-linecap', 'round');
    fHalo.setAttribute('stroke-linejoin', 'round');
    fHalo.setAttribute('opacity', String(isSpotlight ? '0.5' : fOp * 0.88));
    fHalo.setAttribute('class', 'wire-halo');
    fHalo.setAttribute('pointer-events', 'none');
    fg.appendChild(fHalo);

    const fWire = document.createElementNS(SVG_NS, 'path');
    fWire.setAttribute('d', rail.feederPathD);
    fWire.setAttribute('fill', 'none');
    fWire.setAttribute('stroke', rail.color);
    fWire.setAttribute('stroke-width', isSpotlight ? '4.0' : '3.0');
    fWire.setAttribute('stroke-linecap', 'round');
    fWire.setAttribute('stroke-linejoin', 'round');
    fWire.setAttribute('opacity', String(fOp));
    fWire.setAttribute('class', 'wire-stroke');
    fWire.setAttribute('data-wire-key', feederKey);
    fWire.setAttribute('pointer-events', 'none');
    fg.appendChild(fWire);

    if (!dragInstId) {
      const fHit = document.createElementNS(SVG_NS, 'path');
      fHit.setAttribute('d', rail.feederPathD);
      fHit.setAttribute('fill', 'none');
      fHit.setAttribute('stroke', 'transparent');
      fHit.setAttribute('stroke-width', '12');
      fHit.setAttribute('stroke-linecap', 'round');
      fHit.setAttribute('stroke-linejoin', 'round');
      fHit.setAttribute('class', 'wire-hit-path');
      fHit.addEventListener('mouseenter', (ev: any) => {
        if (state.dragWire || state.dragComp || state.rotateComp) return;
        setHoveredNet(rail.netId);
        const srcLbl = getActiveBoard().pins[rail.bpId]?.label || rail.bpId;
        hooks.showCustomTooltip(
          t('tip.wireFeederHover', {
            label: escapeHtml(rail.label),
            src: escapeHtml(srcLbl),
            col: escapeHtml(rail.feederHole.colName),
            net: escapeHtml(rail.netLabel),
            count: rail.branches.length
          }),
          ev
        );
      });
      fHit.addEventListener('mousemove', (ev: any) => {
        if (!state.dragWire && !state.dragComp && !state.rotateComp) hooks.moveTooltip(ev);
      });
      fHit.addEventListener('mouseleave', () => {
        setHoveredNet(null);
        hooks.hideTooltip();
      });
      fg.appendChild(fHit);
    }

    const fsDot = document.createElementNS(SVG_NS, 'circle');
    fsDot.setAttribute('cx', rail.feederStartPt.x.toFixed(1));
    fsDot.setAttribute('cy', rail.feederStartPt.y.toFixed(1));
    fsDot.setAttribute('r', isSpotlight ? '5.6' : '4.4');
    fsDot.setAttribute('fill', rail.color);
    fsDot.setAttribute('stroke', '#ffffff');
    fsDot.setAttribute('stroke-width', '1.5');
    fsDot.setAttribute('opacity', String(fOp));
    fsDot.setAttribute('pointer-events', 'none');
    fg.appendChild(fsDot);

    const fePt = rail.feederHole.masterPt;
    const feDot = document.createElementNS(SVG_NS, 'circle');
    feDot.setAttribute('cx', fePt.x.toFixed(1));
    feDot.setAttribute('cy', fePt.y.toFixed(1));
    feDot.setAttribute('r', isSpotlight ? '5.2' : '3.9');
    feDot.setAttribute('fill', rail.color);
    feDot.setAttribute('stroke', '#ffffff');
    feDot.setAttribute('stroke-width', '1.4');
    feDot.setAttribute('opacity', String(fOp));
    feDot.setAttribute('pointer-events', 'none');
    fg.appendChild(feDot);

    wiresLayer.appendChild(fg);
  }

  // 2. Render Individual Component Wires (direct to K-Comp pin OR from component to Breadboard hole)
  for (const job of wireJobs) {
    const { box, def, p, bpId, net, start, end, isFocused, routed, bbHole, carrierHole, uartInfo, wireColor, wireDash } = job;
    const drawCol = wireColor || p.color;
    const wireKey = `${box.inst.instanceId}::${p.id}`;
    const isSpotlight = spotlightKey && spotlightKey === wireKey;
    const wireOp = spotlightKey
      ? (isSpotlight ? 1 : 0.14)
      : (state.focusedId && !isFocused ? 0.14 : 0.94);

    const wg = document.createElementNS(SVG_NS, 'g');
    wg.setAttribute('class', 'wire-net-group');
    wg.setAttribute('data-net-id', net.id);
    wg.setAttribute('data-inst-id', box.inst.instanceId);

    const halo = document.createElementNS(SVG_NS, 'path');
    halo.setAttribute('d', routed.d);
    halo.setAttribute('fill', 'none');
    halo.setAttribute('stroke', isSpotlight ? '#38bdf8' : haloCol);
    halo.setAttribute('stroke-width', isSpotlight ? '8.5' : (isFocused ? '5.0' : '3.4'));
    halo.setAttribute('stroke-linecap', 'round');
    halo.setAttribute('stroke-linejoin', 'round');
    halo.setAttribute('opacity', String(isSpotlight ? '0.45' : wireOp * 0.85));
    halo.setAttribute('class', 'wire-halo');
    halo.setAttribute('pointer-events', 'none');
    wg.appendChild(halo);

    const wire = document.createElementNS(SVG_NS, 'path');
    wire.setAttribute('d', routed.d);
    wire.setAttribute('fill', 'none');
    wire.setAttribute('stroke', drawCol);
    wire.setAttribute('stroke-width', isSpotlight ? '3.8' : (isFocused ? '2.6' : '1.8'));
    if (wireDash) wire.setAttribute('stroke-dasharray', wireDash);
    wire.setAttribute('stroke-linecap', 'round');
    wire.setAttribute('stroke-linejoin', 'round');
    wire.setAttribute('opacity', String(wireOp));
    wire.setAttribute('class', 'wire-stroke');
    wire.setAttribute('data-wire-key', wireKey);
    wire.setAttribute('pointer-events', 'none');
    wg.appendChild(wire);

    if (!dragInstId) {
      const wHit = document.createElementNS(SVG_NS, 'path');
      wHit.setAttribute('d', routed.d);
      wHit.setAttribute('fill', 'none');
      wHit.setAttribute('stroke', 'transparent');
      wHit.setAttribute('stroke-width', '11');
      wHit.setAttribute('stroke-linecap', 'round');
      wHit.setAttribute('stroke-linejoin', 'round');
      wHit.setAttribute('class', 'wire-hit-path');
      wHit.addEventListener('mouseenter', (ev: any) => {
        if (state.dragWire || state.dragComp || state.rotateComp) return;
        setHoveredNet(net.id);
        const bLbl = getActiveBoard().pins[bpId]?.label || bpId;
        const uartSuffix = uartInfo ? ` · <strong>${escapeHtml(uartInfo.badgeLabel)}</strong>` : '';
        const routeStr = bbHole
          ? t('tip.wireHandleVia', { col: escapeHtml(bbHole.colName), hole: bbHole.holeNum, dest: escapeHtml(bLbl) })
          : (carrierHole
              ? `${escapeHtml(t('carrier.holeVia', { hole: carrierHole.label, dest: bLbl }))}${uartSuffix}`
              : `${t('tip.wireHandleDirect', { dest: escapeHtml(bLbl) })}${uartSuffix}`);
        const cnt = netCounts[net.id] || 1;
        hooks.showCustomTooltip(
          t('tip.wireHover', {
            comp: escapeHtml(getDisplayLabel(def)),
            pin: escapeHtml(p.id),
            route: routeStr,
            net: escapeHtml(net.label),
            netCount: t('net.wireCount', { count: cnt })
          }),
          ev
        );
      });
      wHit.addEventListener('mousemove', (ev: any) => {
        if (!state.dragWire && !state.dragComp && !state.rotateComp) hooks.moveTooltip(ev);
      });
      wHit.addEventListener('mouseleave', () => {
        setHoveredNet(null);
        hooks.hideTooltip();
      });
      wHit.addEventListener('click', (ev: any) => {
        ev.stopPropagation();
        if (state.suppressClick) return;
        state.focusedId = state.focusedId === box.inst.instanceId ? null : box.inst.instanceId;
        hooks.recomputeAndRender();
      });
      wg.appendChild(wHit);
    }

    const sDot = document.createElementNS(SVG_NS, 'circle');
    sDot.setAttribute('cx', start.x.toFixed(1));
    sDot.setAttribute('cy', start.y.toFixed(1));
    sDot.setAttribute('r', isSpotlight ? '5.4' : (isFocused ? '3.8' : '2.8'));
    sDot.setAttribute('fill', drawCol);
    sDot.setAttribute('stroke', isSpotlight ? '#ffffff' : dotOutline);
    sDot.setAttribute('stroke-width', isSpotlight ? '2' : '1.2');
    sDot.setAttribute('opacity', String(wireOp));
    sDot.setAttribute('pointer-events', 'none');
    wg.appendChild(sDot);

    wiresLayer.appendChild(wg);

    const isDraggable = p.selectable || (def.i2cHeaderSelectable && ['I2C_VCC','I2C_GND','I2C_SCL','I2C_SDA'].includes(p.role));
    const hG = document.createElementNS(SVG_NS, 'g');
    hG.setAttribute('class', isDraggable ? 'wire-drag-handle wire-net-group' : 'wire-net-group');
    hG.setAttribute('data-net-id', net.id);
    hG.setAttribute('data-inst-id', box.inst.instanceId);
    hG.setAttribute('opacity', String(wireOp));

    const hit = document.createElementNS(SVG_NS, 'circle');
    hit.setAttribute('cx', end.x.toFixed(1));
    hit.setAttribute('cy', end.y.toFixed(1));
    hit.setAttribute('r', isMobileViewport() ? '15' : '9');
    hit.setAttribute('fill', 'transparent');
    hG.appendChild(hit);

    const eDot = document.createElementNS(SVG_NS, 'circle');
    eDot.setAttribute('cx', end.x.toFixed(1));
    eDot.setAttribute('cy', end.y.toFixed(1));
    eDot.setAttribute('r', isSpotlight ? '6.2' : (bbHole ? (isFocused ? '4.1' : '3.1') : (isFocused ? '4.8' : '3.4')));
    eDot.setAttribute('fill', drawCol);
    eDot.setAttribute('stroke', '#ffffff');
    eDot.setAttribute('stroke-width', isSpotlight ? '2.2' : (isFocused ? '1.5' : '1'));
    eDot.setAttribute('class', 'drag-dot');
    if (isDraggable) {
      const hRing = document.createElementNS(SVG_NS, 'circle');
      hRing.setAttribute('cx', end.x.toFixed(1));
      hRing.setAttribute('cy', end.y.toFixed(1));
      hRing.setAttribute('r', '7.5');
      hRing.setAttribute('fill', 'none');
      hRing.setAttribute('stroke', drawCol);
      hRing.setAttribute('stroke-width', '1.4');
      hRing.setAttribute('class', 'drag-hover-ring');
      hRing.setAttribute('pointer-events', 'none');
      hG.appendChild(hRing);
    }
    hG.appendChild(eDot);

    if (isDraggable && !dragInstId) {
      hG.addEventListener('pointerdown', (ev: any) => {
        setHoveredNet(null);
        startWireDrag(ev, { instanceId: box.inst.instanceId, compPinId: p.id, startPt: start, exitX: routed.exitX, vertical: routed.vertical });
      });
      hG.addEventListener('mouseenter', (ev: any) => {
        if (state.dragWire || state.dragComp || state.rotateComp) return;
        setHoveredNet(net.id);
        const bLbl = getActiveBoard().pins[bpId]?.label || bpId;
        const viaStr = bbHole
          ? t('tip.wireHandleVia', { col: escapeHtml(bbHole.colName), hole: bbHole.holeNum, dest: escapeHtml(bLbl) })
          : t('tip.wireHandleDirect', { dest: escapeHtml(bLbl) });
        hooks.showCustomTooltip(`<strong>${escapeHtml(getDisplayLabel(def))} • ${escapeHtml(p.id)}</strong><br>${viaStr}<br><span class="tip-accent">${escapeHtml(t('tip.wireHandleDragHint'))}</span>`, ev);
      });
      hG.addEventListener('mousemove', (ev: any) => { if (!state.dragWire && !state.dragComp && !state.rotateComp) hooks.moveTooltip(ev); });
      hG.addEventListener('mouseleave', () => {
        setHoveredNet(null);
        hooks.hideTooltip();
      });
    }
    handlesLayer.appendChild(hG);
  }
  renderPinFlags();
}

export function renderPinFlags() {
  const layer = $('#pinFlagsLayer');
  if (!layer) return;
  layer.innerHTML = '';
  // Strictly hover-only (never permanently stuck on focus, and completely hidden during any drag/rotate/pan!)
  if (!state.hoveredNet || state.dragWire || state.dragComp || state.rotateComp || state.panning) return;

  const light = isLightTheme();
  const seen = new Map();
  const uartAssigns = computeUartAssignments();

  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def || def.onboardWirelessSlot) continue;
    for (const p of def.pins) {
      const bpId = inst.pinMap[p.id];
      if (!bpId) continue;
      const net = getNetMeta(bpId);
      if (net.id !== state.hoveredNet) continue;
      if (seen.has(bpId)) continue;
      const raw = getActiveBoard().pins[bpId];
      if (!raw) continue;
      const anchor = getCarrierRowAnchorBoardPt(bpId) || raw;
      const mPt = boardToMaster(anchor.x, anchor.y);
      const isUartSig = p.role === 'UART_RX' || p.role === 'UART_TX';
      const uInfo = isUartSig ? uartAssigns[inst.instanceId] : null;
      const baseLbl = (raw.label || bpId).replace(/^PWR_/, '').replace(/^TOP_/, '').replace(/^EXT_/, '');
      const shortLbl = uInfo ? `${uInfo.shortTag} · ${baseLbl}` : baseLbl;
      // Push flags AWAY from the PCB pin row: above top headers, below mid/bottom headers
      const dir = raw.y < 145 ? -1 : 1;
      seen.set(bpId, { pt: mPt, dir, label: shortLbl, color: p.color });
    }
  }

  const placedLabels = [];
  for (const { pt, dir, label, color } of seen.values()) {
    const w = Math.max(22, label.length * 5.6 + 9);
    const h = 14;
    const lx = pt.x;
    let ly = pt.y + dir * 22;
    // Stack strictly away from the pin header (never shift onto pt.y!)
    for (let tries = 0; tries < 5; tries++) {
      const collides = placedLabels.some((o) => Math.abs(o.x - lx) < (o.w + w) / 2 + 3 && Math.abs(o.y - ly) < h + 2);
      if (!collides) break;
      ly += dir * 16;
    }
    placedLabels.push({ x: lx, y: ly, w });

    // Thin leader line from pin dot to the flag edge
    const tick = document.createElementNS(SVG_NS, 'line');
    tick.setAttribute('x1', pt.x.toFixed(1));
    tick.setAttribute('y1', (pt.y + dir * 5).toFixed(1));
    tick.setAttribute('x2', lx.toFixed(1));
    tick.setAttribute('y2', (ly - dir * (h / 2)).toFixed(1));
    tick.setAttribute('stroke', color);
    tick.setAttribute('stroke-width', '1');
    tick.setAttribute('stroke-opacity', '0.75');
    layer.appendChild(tick);

    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', (lx - w / 2).toFixed(1));
    bg.setAttribute('y', (ly - h / 2).toFixed(1));
    bg.setAttribute('width', w.toFixed(1));
    bg.setAttribute('height', String(h));
    bg.setAttribute('rx', '4');
    bg.setAttribute('fill', light ? '#0f172a' : '#020617');
    bg.setAttribute('fill-opacity', '0.84');
    bg.setAttribute('stroke', color);
    bg.setAttribute('stroke-width', '1.1');
    layer.appendChild(bg);

    const tx = document.createElementNS(SVG_NS, 'text');
    tx.setAttribute('x', lx.toFixed(1));
    tx.setAttribute('y', (ly + 3.2).toFixed(1));
    tx.setAttribute('fill', '#f8fafc');
    tx.setAttribute('font-family', 'Consolas, monospace');
    tx.setAttribute('font-size', '8.4');
    tx.setAttribute('font-weight', '800');
    tx.setAttribute('text-anchor', 'middle');
    tx.textContent = label;
    layer.appendChild(tx);
  }
}

export function exportMasterSvg() {
  const svg = $('#masterSvg');
  const prevFocused = state.focusedId;
  const prevVb = { ...state.vb };

  setHoveredNet(null);
  setHwHover(null);
  state.focusedId = null;
  const dipStates = computeDipStates();
  updateBoardSvgState(dipStates);
  renderDockedComponentsAndWires();

  const bounds = computeLayoutBounds();
  svg.setAttribute('viewBox', `${bounds.x.toFixed(1)} ${bounds.y.toFixed(1)} ${bounds.w.toFixed(1)} ${bounds.h.toFixed(1)}`);

  const clone = svg.cloneNode(true);
  clone.setAttribute('width', String(Math.round(bounds.w)));
  clone.setAttribute('height', String(Math.round(bounds.h)));
  clone.querySelectorAll('.kcomp-pin-hit, #kcomp-onboard-hit-layer, #dragOverlayLayer, #pinFlagsLayer, .hw-flash-group, .drag-hover-ring, .comp-rotate-handle, .comp-quick-rotate, .comp-quick-btn, .pin-needs-free, .wire-hit-path').forEach((n) => n.remove());

  // Inject Inkscape-safe Dublin Core / RDF authorship metadata (zero <filter> tags)
  const titleText = escapeHtml(getCleanProjectName() ? `${getCleanProjectName()} — K-Comp V2 Wiring` : 'K-Comp V2 Wiring Diagram');
  const metaDoc = new DOMParser().parseFromString(
    `<metadata xmlns="http://www.w3.org/2000/svg" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#">` +
    `<rdf:RDF><cc:Work rdf:about="">` +
    `<dc:format>image/svg+xml</dc:format>` +
    `<dc:title>${titleText}</dc:title>` +
    `<dc:creator><cc:Agent><dc:title>${escapeHtml(COPYRIGHT_AUTHOR)}</dc:title></cc:Agent></dc:creator>` +
    `<dc:rights><cc:Agent><dc:title>${escapeHtml(COPYRIGHT_NOTICE)}</dc:title></cc:Agent></dc:rights>` +
    `<dc:source>${escapeHtml(CONFIGURATOR_REPO_URL)}</dc:source>` +
    `<cc:license rdf:resource="https://polyformproject.org/licenses/noncommercial/1.0.0/" />` +
    `</cc:Work></rdf:RDF></metadata>`,
    'image/svg+xml'
  );
  if (metaDoc.documentElement && metaDoc.documentElement.localName === 'metadata') {
    clone.insertBefore(document.importNode(metaDoc.documentElement, true), clone.firstChild);
  }

  const serialized = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- SPDX-FileCopyrightText: 2025-2026 Andreas Kucher | SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->\n' + new XMLSerializer().serializeToString(clone);

  state.focusedId = prevFocused;
  state.vb = prevVb;
  applyViewBox();
  updateBoardSvgState(dipStates);
  renderDockedComponentsAndWires();

  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getProjectSlug('kcomp-v2')}-wiring.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
