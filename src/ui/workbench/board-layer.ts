// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PCB SVG Mounting, Carrier Synchronization, Onboard Hit Targets & Live Pin Status Layer
import { SVG_NS } from '../../core/constants';
import { state, $, escapeHtml, getActiveOnboardDefs } from '../../core/state';
import {
  getCompDef, getDisplayLabel, getExternalPinClaims, getOnboardPinUsage,
  getPendingPins, toggleDipSwitch, toggleOnboardComponent, computeDipStates
} from '../../core/hardware';
import { buildBreadboardBaseLayer } from '../../core/breadboard';
import { buildCarrierBreadboardLayer } from '../../core/carrier-breadboard';
import { boardToMaster, getRotatedBoxBounds } from '../../core/routing';
import { getActiveBoard, getBoardGeometry, isBoardCarrierActive } from '../../boards';
import { t, tOnboard } from '../../i18n/index';
import { getOnboardFlashRect } from './shared';
import { panToComponent } from './layout';
import { appBus } from '../../store/bus';

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
    hit.addEventListener('mouseenter', (e: any) => { if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:showPin', { pinId: pinId, ev: e }); });
    hit.addEventListener('mousemove', (e: any) => { if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:move', { ev: e }); });
    hit.addEventListener('mouseleave', () => appBus.emit('tooltip:hide'));
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
        appBus.emit('tooltip:showCustom', { html: `<strong>${escapeHtml(t('onboard.wireless'))}</strong> (S1-7,8 · D6/D7)<br>${status}`, ev: e });
      } else if (obDef) {
        const dip = obDef.dip ? dipStates.find((d) => d.id === obDef.dip) : null;
        const blocked = dip && dip.forcedOff;
        const isOn = dip ? dip.on : !!state.onboard[obDef.id];
        const status = blocked
          ? escapeHtml(t('onboard.disabledReason', { name: tOnboard(obDef, 'name'), reason: dip.reason }))
          : `<span class="tip-accent">${escapeHtml(isOn ? t('onboard.pcbClickDisable') : t('onboard.pcbClickEnable'))}</span>`;
        appBus.emit('tooltip:showCustom', { html: `<strong>${escapeHtml(tOnboard(obDef, 'name'))}</strong> (${escapeHtml(obDef.pinInfo)})<br>${status}`, ev: e });
      }
    });
    r.addEventListener('mousemove', (e: any) => {
      if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:move', { ev: e });
    });
    r.addEventListener('mouseleave', () => appBus.emit('tooltip:hide'));
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

let flashTimer: ReturnType<typeof setTimeout> | null = null;

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
  const obFlash = opts.onboardId ? getOnboardFlashRect(opts.onboardId) : null;
  if (obFlash) {
    const b = obFlash;
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
  for (const ob of getActiveOnboardDefs()) {
    const dip = ob.dip ? dipById[ob.dip] : null;
    setObHl(ob.id, dip ? dip.on : Boolean(state.onboard[ob.id]));
  }
  if (board.capabilities.hasWirelessSlot) {
    setObHl('onboard_wireless', Boolean(dipById[7]?.on || dipById[8]?.on));
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

  const signalPins = Object.entries(board.pins).filter(([, meta]) => meta.signalPin).map(([id]) => id);
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
