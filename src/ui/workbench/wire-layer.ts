// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Wire Rendering, Drag-to-Rewire, Electrical Net Highlighting & Hover Pin Flags
import { SVG_NS } from '../../core/constants';
import type { PinAttachment } from '../../types';
import { state, $, escapeHtml, isLightTheme, getNetMeta, showToast, isMobileViewport } from '../../core/state';
import {
  getCompDef, getDisplayLabel, getSuitableBoardPins, applyI2CHeaderMapping,
  autoConnectPendingPins, computeUartAssignments, getPinUsageCounts,
  deactivateOptionalPin, isOptionalPin, moduleSupportsDualPower
} from '../../core/hardware';
import { renderBreadboardActiveRails, allocateBreadboardRails, getBreadboardDropTarget } from '../../core/breadboard';
import {
  allocateCarrierBreadboardConnections, renderCarrierActiveOverlay,
  getCarrierRowAnchorBoardPt, getCarrierRowHoleTargets, getCarrierPowerRailTargets
} from '../../core/carrier-breadboard';
import {
  rotatePoint, getRotatedBoxBounds, boardToMaster,
  routeSmartWires, buildCurvedWirePath, buildCurvedFeederPath
} from '../../core/routing';
import { getActiveBoard, isBoardCarrierActive } from '../../boards';
import { t } from '../../i18n/index';
import { getLastCarrierWireHoles, setLastCarrierWireHoles } from './shared';
import { clientToSvg, capturePointerSafe, releasePointerSafe } from './layout';
import { appBus } from '../../store/bus';

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

export function startWireDrag(ev, meta) {
  ev.stopPropagation();
  ev.preventDefault();
  appBus.emit('tooltip:hide');
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
    for (const h of getLastCarrierWireHoles()) {
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
    // Dual-voltage I2C modules can also drag VCC/VIN directly to 3.3V (keeping SDA/SCL/GND on the header!)
    if (pSpec.role === 'I2C_VCC' && moduleSupportsDualPower(def)) {
      for (const [bpId, raw] of Object.entries(board.pins)) {
        if (raw.blocked || !(raw.caps || []).includes('3V3')) continue;
        validTargets.push({
          boardPinId: bpId,
          label: raw.label || bpId,
          shortLabel: bpId.replace('PWR_', ''),
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
        appBus.emit('history:push');
        applyI2CHeaderMapping(inst, def, newHdr);
        autoConnectPendingPins();
        showToast(t('toast.rewiredI2c', { comp: getDisplayLabel(def), header: newHdr }));
      }
    } else if (dw.snappedTarget.boardPinId) {
      const newPin = dw.snappedTarget.boardPinId;
      if (!inst.attachments) inst.attachments = {};
      const origAttJson = JSON.stringify(inst.attachments[dw.compPinId] || null);
      const isSharedRole = ['GND', 'POWER_5V', 'POWER_3V3', 'RESET'].includes(
        (def.pins.find((p) => p.id === dw.compPinId)?.role) || ''
      );
      let nextAtt: PinAttachment | null = null;
      if (dw.snappedTarget.forceBreadboard) {
        nextAtt = { kind: 'board-breadboard', forceRail: true };
      } else if (dw.snappedTarget.carrierRailId) {
        nextAtt = typeof dw.snappedTarget.carrierRailHoleIdx === 'number'
          ? { kind: 'carrier-rail', railId: dw.snappedTarget.carrierRailId, holeIndex: dw.snappedTarget.carrierRailHoleIdx }
          : { kind: 'carrier-rail', railId: dw.snappedTarget.carrierRailId };
      } else if (typeof dw.snappedTarget.carrierRowHoleIdx === 'number') {
        nextAtt = { kind: 'carrier-row', holeIndex: dw.snappedTarget.carrierRowHoleIdx };
      } else if (isSharedRole && isBoardCarrierActive(getActiveBoard(), state.carrierEnabled)) {
        nextAtt = { kind: 'carrier-row' };
      } else if (isSharedRole && getActiveBoard().breadboard) {
        const counts = getPinUsageCounts(inst.instanceId, dw.compPinId);
        nextAtt = (counts[newPin] || 0) >= 1 ? { kind: 'board-breadboard', forceRail: true } : null;
      }

      if (newPin !== dw.origPin || JSON.stringify(nextAtt) !== origAttJson) {
        appBus.emit('history:push');
        inst.pinMap[dw.compPinId] = newPin;
        if (nextAtt === null) delete inst.attachments[dw.compPinId];
        else inst.attachments[dw.compPinId] = nextAtt;
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
            appBus.emit('history:push');
            if (targetObId === 'onboard_wireless') state.onboard.onboard_wireless = false;
            else state.onboard[targetObId] = false;
            curInst.pinMap[targetCompPinId] = targetPin;
            autoConnectPendingPins();
            showToast(t('toast.rewired', { comp: getDisplayLabel(def), pin: targetCompPinId, dest: targetPin }));
            appBus.emit('workspace:recompute');
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
  appBus.emit('workspace:recompute');
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

export function renderWiresAndHandles(dragInstId = null, dragDx = 0, dragDy = 0, dragRot = null) {
  const wiresLayer = $('#wiresLayer');
  const handlesLayer = $('#handlesLayer');
  wiresLayer.innerHTML = '';
  handlesLayer.innerHTML = '';
  setHoveredNet(null);
  appBus.emit('tooltip:hide');

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
      const isPowerPin = p.role === 'POWER_5V' || p.role === 'POWER_3V3' || p.role === 'I2C_VCC';
      const powerRailCol = isPowerPin
        ? (net.id === 'NET_3V3' ? '#fb923c' : (net.id === 'NET_5V' ? '#ef4444' : p.color))
        : p.color;
      const wireColor = uartInfo
        ? (uartInfo.kind === 'hw'
            ? (p.role === 'UART_RX' ? '#06b6d4' : '#0ea5e9')
            : (p.role === 'UART_RX' ? '#c084fc' : '#f59e0b'))
        : powerRailCol;
      const wireDash = (uartInfo && uartInfo.kind === 'sw') ? '6,3.5' : null;
      const attachment = box.inst.attachments?.[p.id] || null;
      const forceBreadboard = attachment?.kind === 'board-breadboard';
      wireJobs.push({ entry, box, rb, def, p, bpId, net, rot, start, end, isFocused, uartInfo, wireColor, wireDash, forceBreadboard, attachment });
    }
  }

  // Promote shared pins used >= 2 times to dedicated breadboard distribution rails (Top half = Power, Bottom half = 4+ I²C Bus Expansion!)
  const rails = allocateBreadboardRails(wireJobs);
  state.breadboardRails = rails;
  renderBreadboardActiveRails(rails);

  // If a centered breadboard carrier is active (e.g. ESP32-S3 on Breadboard), map wires to breadboard rows & power rails!
  const carrierAlloc = allocateCarrierBreadboardConnections(wireJobs);
  state.carrierFeeders = carrierAlloc.feeders;
  const cwMap: Record<string, any> = {};
  for (const j of wireJobs) {
    if (j.carrierHole) {
      cwMap[`${j.box.inst.instanceId}::${j.p.id}`] = j.carrierHole;
    }
  }
  state.carrierWireMap = cwMap;
  setLastCarrierWireHoles(wireJobs
    .filter((j) => j.carrierHole && typeof j.carrierHole.holeIdx === 'number')
    .map((j) => ({
      instId: j.box.inst.instanceId,
      compPinId: j.p.id,
      kind: j.carrierHole.kind,
      bpId: j.carrierHole.bpId,
      railId: j.carrierHole.railId,
      holeIdx: j.carrierHole.holeIdx
    })));
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
      appBus.emit('tooltip:showCustom', { html: `<strong>${escapeHtml(t('carrier.feederTip', { pin: cf.feederPinId, rail: cf.label }))}</strong>`, ev: ev });
    });
    cHit.addEventListener('mousemove', (ev: any) => {
      if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:move', { ev: ev });
    });
    cHit.addEventListener('mouseleave', () => {
      setHoveredNet(null);
      appBus.emit('tooltip:hide');
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
        appBus.emit('tooltip:showCustom', { html: t('tip.wireFeederHover', {
            label: escapeHtml(rail.label),
            src: escapeHtml(srcLbl),
            col: escapeHtml(rail.feederHole.colName),
            net: escapeHtml(rail.netLabel),
            count: rail.branches.length
          }), ev: ev });
      });
      fHit.addEventListener('mousemove', (ev: any) => {
        if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:move', { ev: ev });
      });
      fHit.addEventListener('mouseleave', () => {
        setHoveredNet(null);
        appBus.emit('tooltip:hide');
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
        appBus.emit('tooltip:showCustom', { html: t('tip.wireHover', {
            comp: escapeHtml(getDisplayLabel(def)),
            pin: escapeHtml(p.id),
            route: routeStr,
            net: escapeHtml(net.label),
            netCount: t('net.wireCount', { count: cnt })
          }), ev: ev });
      });
      wHit.addEventListener('mousemove', (ev: any) => {
        if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:move', { ev: ev });
      });
      wHit.addEventListener('mouseleave', () => {
        setHoveredNet(null);
        appBus.emit('tooltip:hide');
      });
      wHit.addEventListener('click', (ev: any) => {
        ev.stopPropagation();
        if (state.suppressClick) return;
        state.focusedId = state.focusedId === box.inst.instanceId ? null : box.inst.instanceId;
        appBus.emit('workspace:recompute');
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
      if (isOptionalPin(p) && p.tier === 'optional') {
        hG.addEventListener('dblclick', (ev: any) => {
          ev.stopPropagation();
          deactivateOptionalPin(box.inst.instanceId, p.id);
        });
      }
      hG.addEventListener('mouseenter', (ev: any) => {
        if (state.dragWire || state.dragComp || state.rotateComp) return;
        setHoveredNet(net.id);
        const bLbl = getActiveBoard().pins[bpId]?.label || bpId;
        const viaStr = bbHole
          ? t('tip.wireHandleVia', { col: escapeHtml(bbHole.colName), hole: bbHole.holeNum, dest: escapeHtml(bLbl) })
          : t('tip.wireHandleDirect', { dest: escapeHtml(bLbl) });
        const optHint = isOptionalPin(p) && p.tier === 'optional' ? `<br><span class="tip-muted">${escapeHtml(t('tip.optPinDblClickOff'))}</span>` : '';
        appBus.emit('tooltip:showCustom', { html: `<strong>${escapeHtml(getDisplayLabel(def))} • ${escapeHtml(p.id)}</strong><br>${viaStr}<br><span class="tip-accent">${escapeHtml(t('tip.wireHandleDragHint'))}</span>${optHint}`, ev: ev });
      });
      hG.addEventListener('mousemove', (ev: any) => { if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:move', { ev: ev }); });
      hG.addEventListener('mouseleave', () => {
        setHoveredNet(null);
        appBus.emit('tooltip:hide');
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
