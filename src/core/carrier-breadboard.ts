// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Centered Breadboard Carrier Layer & Per-Hole Tie-Point / Power-Rail Allocator (Inkscape-Safe, zero <filter>)
import { SVG_NS } from './constants';
import type { PinAttachment } from '../types';
import { state, escapeHtml, isLightTheme } from './state';
import { getActiveBoard, isBoardCarrierActive } from '../boards';
import { boardToMaster } from './routing';
import { moduleSupports3v3, moduleSupportsDualPower } from './hardware';
import { t } from '../i18n/index';
import { appBus } from '../store/bus';

export interface CarrierFeederSpec {
  railId: string;
  netId: string;
  label: string;
  color: string;
  side: 'left' | 'right';
  feederPinId: string;
  feederRowHoleIdx: number;
  pointsBoard: Array<{ x: number; y: number }>;
  pointsMaster: Array<{ x: number; y: number }>;
  pathD: string;
  startMaster: { x: number; y: number };
  endMaster: { x: number; y: number };
}

function createEl(tag: string, attrs: Record<string, string | number>, textContent?: string) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

export function getCarrierColLetter(side: 'left' | 'right', holeIdx: number): string {
  const letters = side === 'left' ? ['d', 'c', 'b', 'a'] : ['g', 'h', 'i', 'j'];
  return letters[holeIdx] || '';
}

export function getCarrierRowNum(y: number): number {
  return Math.max(1, Math.round((y - 76) / 19) + 1);
}

/**
 * Renders the full Inkscape-safe breadboard carrier underneath the centered MCU board.
 * Left power rails: +3.3V (orange) & GND (blue).
 * Right power rails: +5V VBUS (red) & GND (blue).
 * Every MCU pin row has 4 exposed horizontal tie-point holes extending outward on its side.
 */
export function buildCarrierBreadboardLayer(container: SVGGElement) {
  container.innerHTML = '';
  const board = getActiveBoard();
  if (!isBoardCarrierActive(board, state.carrierEnabled) || !board.carrier) return;

  const carrier = board.carrier;
  const light = isLightTheme();
  const b = carrier.localBounds;

  const bodyFill = light ? '#f8fafc' : '#e2e8f0';
  const bodyStroke = light ? '#94a3b8' : '#64748b';
  const innerFill = light ? '#ffffff' : '#f1f5f9';
  const grooveFill = light ? '#cbd5e1' : '#94a3b8';
  const holeFill = '#1e293b';
  const holeStroke = '#475569';
  const railBg = light ? '#f1f5f9' : '#e2e8f0';
  const stripStroke = 'rgba(100, 116, 139, 0.24)';

  const bbTop = 44;
  const bbBot = b.maxY - 6;
  const bbH = bbBot - bbTop;
  const bbW = b.maxX - b.minX;

  container.appendChild(createEl('rect', {
    x: b.minX,
    y: bbTop,
    width: bbW,
    height: bbH,
    rx: 8,
    fill: bodyFill,
    stroke: bodyStroke,
    'stroke-width': 1.8
  }));

  container.appendChild(createEl('rect', {
    x: -74,
    y: bbTop + 12,
    width: 412,
    height: bbH - 24,
    rx: 4,
    fill: innerFill,
    stroke: '#cbd5e1',
    'stroke-width': 0.9
  }));
  container.appendChild(createEl('rect', {
    x: b.minX + 6,
    y: bbTop + 12,
    width: 44,
    height: bbH - 24,
    rx: 4,
    fill: railBg,
    stroke: '#cbd5e1',
    'stroke-width': 0.9
  }));
  container.appendChild(createEl('rect', {
    x: 342,
    y: bbTop + 12,
    width: 44,
    height: bbH - 24,
    rx: 4,
    fill: railBg,
    stroke: '#cbd5e1',
    'stroke-width': 0.9
  }));

  container.appendChild(createEl('rect', {
    x: 124,
    y: bbTop + 14,
    width: 16,
    height: bbH - 28,
    rx: 3,
    fill: grooveFill,
    opacity: 0.45
  }));

  const leftColNames = ['d', 'c', 'b', 'a'];
  carrier.leftHoleXs.forEach((hx, idx) => {
    container.appendChild(createEl('text', {
      x: hx,
      y: bbTop + 23,
      'text-anchor': 'middle',
      'font-family': 'Consolas, monospace',
      'font-size': 7.5,
      'font-weight': 700,
      fill: '#64748b'
    }, leftColNames[idx] || ''));
  });
  const rightColNames = ['g', 'h', 'i', 'j'];
  carrier.rightHoleXs.forEach((hx, idx) => {
    container.appendChild(createEl('text', {
      x: hx,
      y: bbTop + 23,
      'text-anchor': 'middle',
      'font-family': 'Consolas, monospace',
      'font-size': 7.5,
      'font-weight': 700,
      fill: '#64748b'
    }, rightColNames[idx] || ''));
  });

  // Power Rails (Left: +3.3V & GND | Right: +5V & GND)
  for (const rail of carrier.powerRails) {
    const yMin = rail.ys[0];
    const yMax = rail.ys[rail.ys.length - 1];
    const stripeDx = rail.id.includes('GND') ? (rail.side === 'left' ? -7.5 : 7.5) : (rail.side === 'left' ? 7.5 : -7.5);

    container.appendChild(createEl('line', {
      x1: rail.x + stripeDx,
      y1: yMin - 5,
      x2: rail.x + stripeDx,
      y2: yMax + 5,
      stroke: rail.stripeColor,
      'stroke-width': 2.0,
      'stroke-linecap': 'round',
      opacity: 0.85
    }));

    container.appendChild(createEl('line', {
      x1: rail.x,
      y1: yMin,
      x2: rail.x,
      y2: yMax,
      stroke: rail.color,
      'stroke-width': 2.2,
      opacity: 0.2
    }));

    container.appendChild(createEl('text', {
      x: rail.x,
      y: bbTop + 22,
      'text-anchor': 'middle',
      'font-family': 'Consolas, monospace',
      'font-size': 6.6,
      'font-weight': 800,
      fill: rail.stripeColor
    }, rail.label));
    container.appendChild(createEl('text', {
      x: rail.x,
      y: bbBot - 16,
      'text-anchor': 'middle',
      'font-family': 'Consolas, monospace',
      'font-size': 6.6,
      'font-weight': 800,
      fill: rail.stripeColor
    }, rail.label));

    for (const hy of rail.ys) {
      container.appendChild(createEl('rect', {
        x: (rail.x - 2.3).toFixed(1),
        y: (hy - 2.3).toFixed(1),
        width: 4.6,
        height: 4.6,
        rx: 0.8,
        fill: holeFill,
        stroke: holeStroke,
        'stroke-width': 0.5
      }));
    }

    const hit = createEl('rect', {
      class: 'kcomp-pin-hit carrier-rail-hit',
      'data-carrier-rail': rail.id,
      x: (rail.x - 6).toFixed(1),
      y: (yMin - 6).toFixed(1),
      width: 12,
      height: (yMax - yMin + 12).toFixed(1),
      rx: 4,
      fill: 'transparent'
    });
    hit.addEventListener('mouseenter', (e: any) => {
      if (state.dragWire || state.dragComp || state.rotateComp) return;
      appBus.emit('tooltip:showCustom', { html: `<strong>${escapeHtml(t('carrier.railTipTitle', { label: rail.label }))}</strong><br>${escapeHtml(t('carrier.railTipSub', { side: rail.side === 'left' ? t('carrier.sideLeft') : t('carrier.sideRight') }))}`, ev: e });
    });
    hit.addEventListener('mousemove', (e: any) => {
      if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:move', { ev: e });
    });
    hit.addEventListener('mouseleave', () => appBus.emit('tooltip:hide'));
    container.appendChild(hit);
  }

  // Horizontal 4-Hole Signal Rows aligned 1:1 with every left & right MCU pin
  for (const [bpId, meta] of Object.entries(board.pins)) {
    const isLeft = meta.approach === 'left';
    const isRight = meta.approach === 'right';
    if (!isLeft && !isRight) continue;

    const holeXs = isLeft ? carrier.leftHoleXs : carrier.rightHoleXs;
    const rowIdx = getCarrierRowNum(meta.y);
    const xStart = isLeft ? holeXs[holeXs.length - 1] : meta.x;
    const xEnd = isLeft ? meta.x : holeXs[holeXs.length - 1];

    container.appendChild(createEl('line', {
      x1: xStart,
      y1: meta.y,
      x2: xEnd,
      y2: meta.y,
      stroke: stripStroke,
      'stroke-width': 3.2,
      'stroke-linecap': 'round'
    }));

    container.appendChild(createEl('text', {
      x: isLeft ? (holeXs[holeXs.length - 1] - 8.5) : (holeXs[holeXs.length - 1] + 8.5),
      y: (meta.y + 2.5).toFixed(1),
      'text-anchor': 'middle',
      'font-family': 'Consolas, monospace',
      'font-size': 6.0,
      'font-weight': 700,
      fill: '#94a3b8'
    }, String(rowIdx)));

    for (const hx of holeXs) {
      container.appendChild(createEl('rect', {
        x: (hx - 2.4).toFixed(1),
        y: (meta.y - 2.4).toFixed(1),
        width: 4.8,
        height: 4.8,
        rx: 0.8,
        fill: holeFill,
        stroke: holeStroke,
        'stroke-width': 0.55
      }));
    }

    const rowMinX = Math.min(...holeXs) - 4;
    const rowMaxX = Math.max(...holeXs) + 4;
    const rowHit = createEl('rect', {
      class: 'kcomp-pin-hit carrier-row-hit',
      'data-pin': bpId,
      x: rowMinX.toFixed(1),
      y: (meta.y - 6.5).toFixed(1),
      width: (rowMaxX - rowMinX).toFixed(1),
      height: 13,
      rx: 3,
      fill: 'transparent'
    });
    rowHit.addEventListener('mouseenter', (e: any) => {
      if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:showPin', { pinId: bpId, ev: e });
    });
    rowHit.addEventListener('mousemove', (e: any) => {
      if (!state.dragWire && !state.dragComp && !state.rotateComp) appBus.emit('tooltip:move', { ev: e });
    });
    rowHit.addEventListener('mouseleave', () => appBus.emit('tooltip:hide'));
    container.appendChild(rowHit);
  }

  container.appendChild(createEl('text', {
    x: 132,
    y: bbBot - 15,
    'text-anchor': 'middle',
    'font-family': 'Consolas, monospace',
    'font-size': 7.0,
    'font-weight': 700,
    fill: '#64748b'
  }, 'BREADBOARD · LEFT 3.3V / GND · RIGHT 5V / GND'));
}

/**
 * Returns the primary breadboard tie-point coordinate (in board-local space) for pin flags / single anchors.
 */
export function getCarrierRowAnchorBoardPt(bpId: string): { x: number; y: number } | null {
  const board = getActiveBoard();
  if (!isBoardCarrierActive(board, state.carrierEnabled) || !board.carrier) return null;
  const meta = board.pins[bpId];
  if (!meta) return null;
  if (meta.approach === 'left') {
    const xs = board.carrier.leftHoleXs;
    return { x: xs[xs.length - 1], y: meta.y };
  }
  if (meta.approach === 'right') {
    const xs = board.carrier.rightHoleXs;
    return { x: xs[xs.length - 1], y: meta.y };
  }
  return null;
}

function hasExplicitHole(att: PinAttachment | null | undefined): boolean {
  return Boolean(att && (att.kind === 'carrier-row' || att.kind === 'carrier-rail') && typeof att.holeIndex === 'number');
}

/**
 * Maps all external wire endpoints onto Breadboard Carrier tie-point holes & power rails.
 * Respects exact per-hole placements (e.g. 2a -> 1b) and power-rail placements (Left +3.3V/GND, Right +5V/GND).
 */
export function allocateCarrierBreadboardConnections(wireJobs: any[]): {
  feeders: CarrierFeederSpec[];
  activeStrips: Array<{ x1: number; x2: number; y: number; color: string; netId: string }>;
  activeRailIds: Set<string>;
} {
  const board = getActiveBoard();
  const empty = { feeders: [], activeStrips: [], activeRailIds: new Set<string>() };
  if (!isBoardCarrierActive(board, state.carrierEnabled) || !board.carrier) return empty;

  const carrier = board.carrier;
  const railById = new Map(carrier.powerRails.map((r) => [r.id, r]));
  const usedRailHoles = new Map<string, Set<number>>();
  const usedRowHoles = new Map<string, Set<number>>();
  const activeRailIds = new Set<string>();
  const activeStrips: Array<{ x1: number; x2: number; y: number; color: string; netId: string }> = [];
  const boardCenterMasterX = boardToMaster(132, 250).x;

  const markRowHole = (bpId: string, idx: number) => {
    if (!usedRowHoles.has(bpId)) usedRowHoles.set(bpId, new Set<number>());
    usedRowHoles.get(bpId)!.add(idx);
  };
  const markRailHole = (railId: string, idx: number) => {
    if (!usedRailHoles.has(railId)) usedRailHoles.set(railId, new Set<number>());
    usedRailHoles.get(railId)!.add(idx);
  };

  const getFeederRailHoleIdx = (rail: any) => {
    const feederMeta = board.pins[rail.feederPinId];
    if (!feederMeta) return 0;
    if (feederMeta.approach && feederMeta.approach !== rail.side) {
      return rail.ys.length - 1;
    }
    return Math.max(0, Math.min(rail.ys.length - 1, Math.round((feederMeta.y - 76) / 19)));
  };

  const reserveFeederRailHole = (railId: string) => {
    const rail = railById.get(railId);
    if (!rail) return;
    markRailHole(railId, getFeederRailHoleIdx(rail));
  };

  const pickNearestFreeRailHole = (railId: string, desiredMasterY: number, preferredIdx?: number): number => {
    const rail = railById.get(railId)!;
    reserveFeederRailHole(railId);
    const taken = usedRailHoles.get(railId)!;
    if (typeof preferredIdx === 'number' && preferredIdx >= 0 && preferredIdx < rail.ys.length && !taken.has(preferredIdx)) {
      taken.add(preferredIdx);
      return preferredIdx;
    }
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < rail.ys.length; i++) {
      if (taken.has(i)) continue;
      const my = boardToMaster(rail.x, rail.ys[i]).y;
      const d = Math.abs(my - desiredMasterY);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) bestIdx = 0;
    taken.add(bestIdx);
    return bestIdx;
  };

  const pickFreeRowHole = (bpId: string, holeCount: number, preferredIdx?: number): number => {
    if (!usedRowHoles.has(bpId)) usedRowHoles.set(bpId, new Set<number>());
    const taken = usedRowHoles.get(bpId)!;
    if (typeof preferredIdx === 'number' && preferredIdx >= 0 && preferredIdx < holeCount && !taken.has(preferredIdx)) {
      taken.add(preferredIdx);
      return preferredIdx;
    }
    // Prefer outermost free hole first (index 3 -> 2 -> 1 -> 0)
    for (let idx = holeCount - 1; idx >= 0; idx--) {
      if (!taken.has(idx)) {
        taken.add(idx);
        return idx;
      }
    }
    return holeCount - 1;
  };

  // Process explicitly pinned holes FIRST so auto-placed wires never steal a manually chosen hole (e.g. 1b)!
  const orderedJobs = [...wireJobs].sort((a, b) => (hasExplicitHole(a.attachment) ? 0 : 1) - (hasExplicitHole(b.attachment) ? 0 : 1));

  for (const job of orderedJobs) {
    const meta = board.pins[job.bpId];
    if (!meta) continue;
    const isCardRight = job.start.x >= boardCenterMasterX;
    const att: PinAttachment | null = job.attachment || null;
    const isPowerNet = job.net.id === 'NET_3V3' || job.net.id === 'NET_5V' || job.net.id === 'NET_GND';

    // 1. Power Rail placement (default for power/GND nets unless user explicitly attached to a pin row)
    if (att?.kind === 'carrier-rail' || (att?.kind !== 'carrier-row' && isPowerNet)) {
      let targetRailId: string | null = null;
      if (att?.kind === 'carrier-rail' && railById.has(att.railId)) {
        targetRailId = att.railId;
      } else if (job.net.id === 'NET_3V3') {
        targetRailId = 'BB_L_3V3';
      } else if (job.net.id === 'NET_5V') {
        targetRailId = 'BB_R_5V';
      } else if (job.net.id === 'NET_GND') {
        targetRailId = isCardRight ? 'BB_R_GND' : 'BB_L_GND';
      }

      const rail = targetRailId ? railById.get(targetRailId) : null;
      if (rail) {
        activeRailIds.add(rail.id);
        const prefHole = att?.kind === 'carrier-rail' ? att.holeIndex : undefined;
        const hIdx = pickNearestFreeRailHole(rail.id, job.start.y, prefHole);
        const bPt = { x: rail.x, y: rail.ys[hIdx] };
        const mPt = boardToMaster(bPt.x, bPt.y);
        job.origBoardEnd = job.end;
        job.end = mPt;
        job.carrierApproach = rail.side;
        job.carrierHole = {
          kind: 'rail',
          railId: rail.id,
          holeIdx: hIdx,
          label: `${rail.label} (${rail.side === 'left' ? 'L' : 'R'}${hIdx + 1})`,
          boardPt: bPt,
          masterPt: mPt
        };
        continue;
      }
    }

    // 2. Pin-Row Tie-Point placement (Signal, I2C, or manually placed Power/GND hole like 1b!)
    const isLeft = meta.approach === 'left';
    const isRight = meta.approach === 'right';
    if (!isLeft && !isRight) continue;

    const side: 'left' | 'right' = isLeft ? 'left' : 'right';
    const holeXs = isLeft ? carrier.leftHoleXs : carrier.rightHoleXs;
    const prefRowHole = att?.kind === 'carrier-row' ? att.holeIndex : undefined;
    const holeIdx = pickFreeRowHole(job.bpId, holeXs.length, prefRowHole);
    const hx = holeXs[holeIdx];
    const bPt = { x: hx, y: meta.y };
    const mPt = boardToMaster(bPt.x, bPt.y);
    const colLetter = getCarrierColLetter(side, holeIdx);
    const rowNum = getCarrierRowNum(meta.y);

    job.origBoardEnd = job.end;
    job.end = mPt;
    job.carrierApproach = side;
    job.carrierHole = {
      kind: 'row',
      bpId: job.bpId,
      holeIdx,
      label: `${rowNum}${colLetter}`,
      boardPt: bPt,
      masterPt: mPt
    };

    activeStrips.push({
      x1: isLeft ? hx : meta.x,
      x2: isLeft ? meta.x : hx,
      y: meta.y,
      color: job.wireColor || job.p.color,
      netId: job.net.id
    });
  }

  // 3. Build short physical feeder jumpers from ESP32 power pins to each active Breadboard power rail
  const feeders: CarrierFeederSpec[] = [];
  for (const railId of activeRailIds) {
    const rail = railById.get(railId);
    if (!rail) continue;
    const pinMeta = board.pins[rail.feederPinId];
    if (!pinMeta) continue;
    const rowIdx = Math.max(0, Math.min(rail.ys.length - 1, Math.round((pinMeta.y - 76) / 19)));
    const targetY = rail.ys[rowIdx];

    const pinIsLeft = pinMeta.approach === 'left';
    const holeXs = pinIsLeft ? carrier.leftHoleXs : carrier.rightHoleXs;
    // Prefer outermost free hole (a on left, j on right) so feeder is super short and doesn't cross inner holes!
    const feederRowHoleIdx = pickFreeRowHole(rail.feederPinId, holeXs.length);
    const rowHoleX = holeXs[feederRowHoleIdx];

    let ptsBoard: Array<{ x: number; y: number }>;
    if (rail.side === 'left' && pinIsLeft) {
      ptsBoard = [
        { x: rowHoleX, y: pinMeta.y },
        { x: rail.x, y: targetY }
      ];
      activeStrips.push({ x1: rowHoleX, x2: pinMeta.x, y: pinMeta.y, color: rail.color, netId: rail.netId });
    } else if (rail.side === 'right' && !pinIsLeft) {
      ptsBoard = [
        { x: rowHoleX, y: pinMeta.y },
        { x: rail.x, y: targetY }
      ];
      activeStrips.push({ x1: pinMeta.x, x2: rowHoleX, y: pinMeta.y, color: rail.color, netId: rail.netId });
    } else {
      // Cross-board feeder (e.g. 5V_L on bottom-left -> Right +5V rail neatly routed along bottom margin y=496)
      const botY = 496;
      ptsBoard = [
        { x: rowHoleX, y: pinMeta.y },
        { x: rowHoleX, y: botY },
        { x: rail.x, y: botY },
        { x: rail.x, y: rail.ys[rail.ys.length - 1] }
      ];
      activeStrips.push({ x1: rowHoleX, x2: pinMeta.x, y: pinMeta.y, color: rail.color, netId: rail.netId });
    }

    const ptsMaster = ptsBoard.map((pt) => boardToMaster(pt.x, pt.y));
    const pathD = ptsMaster
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(' ');

    feeders.push({
      railId: rail.id,
      netId: rail.netId,
      label: rail.label,
      color: rail.color,
      side: rail.side,
      feederPinId: rail.feederPinId,
      feederRowHoleIdx,
      pointsBoard: ptsBoard,
      pointsMaster: ptsMaster,
      pathD,
      startMaster: ptsMaster[0],
      endMaster: ptsMaster[ptsMaster.length - 1]
    });
  }

  return { feeders, activeStrips, activeRailIds };
}

/**
 * Returns ALL free individual tie-point hole drop targets (e.g. 1a, 1b, 1c, 1d) for a valid board pin row.
 */
export function getCarrierRowHoleTargets(
  bpId: string,
  meta: any,
  occupiedRowHoles?: Map<string, Set<number>>
) {
  const board = getActiveBoard();
  if (!isBoardCarrierActive(board, state.carrierEnabled) || !board.carrier) return [];
  if (meta.approach !== 'left' && meta.approach !== 'right') return [];

  const side: 'left' | 'right' = meta.approach;
  const holeXs = side === 'left' ? board.carrier.leftHoleXs : board.carrier.rightHoleXs;
  const rowNum = getCarrierRowNum(meta.y);
  const taken = occupiedRowHoles?.get(bpId);
  const cleanPin = bpId.replace(/^PWR_/, '');
  const targets = [];

  for (let holeIdx = 0; holeIdx < holeXs.length; holeIdx++) {
    if (taken && taken.has(holeIdx)) continue;
    const colLetter = getCarrierColLetter(side, holeIdx);
    const coord = `${rowNum}${colLetter}`;
    const isOuter = holeIdx === holeXs.length - 1;
    targets.push({
      boardPinId: bpId,
      carrierRowHoleIdx: holeIdx,
      isCarrierHole: true,
      label: `${coord} (${meta.label || cleanPin})`,
      shortLabel: isOuter ? cleanPin : '',
      snapLabel: `${coord} · ${cleanPin}`,
      masterPt: boardToMaster(holeXs[holeIdx], meta.y)
    });
  }
  return targets;
}

/**
 * Returns individual free hole drop targets along matching Breadboard Carrier outer power rails
 * (Left +3.3V / GND, Right +5V / GND).
 */
export function getCarrierPowerRailTargets(
  pinSpec: any,
  compDef: any = null,
  occupiedRailHoles?: Map<string, Set<number>>
) {
  const board = getActiveBoard();
  if (!isBoardCarrierActive(board, state.carrierEnabled) || !board.carrier) return [];

  const allowed = new Set<string>(pinSpec.allowedTypes || []);
  if (pinSpec.role === 'GND' || pinSpec.role === 'I2C_GND') allowed.add('GND');
  if (pinSpec.role === 'POWER_3V3') allowed.add('3V3');
  if (pinSpec.role === 'POWER_5V' || pinSpec.role === 'POWER_3V3' || pinSpec.role === 'I2C_VCC') {
    if (compDef && moduleSupportsDualPower(compDef)) {
      allowed.add('3V3');
      allowed.add('5V');
    } else if (pinSpec.role === 'POWER_3V3') {
      allowed.add('3V3');
    } else {
      allowed.add('5V');
      if (board.electrical.logicVoltage < 5 && (!compDef || moduleSupports3v3(compDef))) {
        allowed.add('3V3');
      }
    }
  }

  const wantedNets = new Set<string>();
  if (allowed.has('GND')) wantedNets.add('NET_GND');
  if (allowed.has('3V3')) wantedNets.add('NET_3V3');
  if (allowed.has('5V')) wantedNets.add('NET_5V');
  if (!wantedNets.size) return [];

  const out = [];
  for (const rail of board.carrier.powerRails) {
    if (!wantedNets.has(rail.netId)) continue;
    const sideLbl = rail.side === 'left' ? t('carrier.sideLeft') : t('carrier.sideRight');
    const taken = occupiedRailHoles?.get(rail.id);
    const feederMeta = board.pins[rail.feederPinId];
    const feederIdx = feederMeta
      ? Math.max(0, Math.min(rail.ys.length - 1, Math.round((feederMeta.y - 76) / 19)))
      : 0;

    for (let hIdx = 0; hIdx < rail.ys.length; hIdx++) {
      if (hIdx === feederIdx || (taken && taken.has(hIdx))) continue;
      const coord = `${rail.side === 'left' ? 'L' : 'R'}${hIdx + 1}`;
      out.push({
        boardPinId: rail.feederPinId,
        carrierRailId: rail.id,
        carrierRailHoleIdx: hIdx,
        isCarrierHole: true,
        isCarrierRailHole: true,
        label: `${t('carrier.railTipTitle', { label: rail.label })} ${coord} (${sideLbl})`,
        shortLabel: hIdx === Math.floor(rail.ys.length / 2) ? `⊞ ${rail.label}` : '',
        snapLabel: `${rail.label} (${coord})`,
        masterPt: boardToMaster(rail.x, rail.ys[hIdx])
      });
    }
  }
  return out;
}

/**
 * Highlights active horizontal breadboard copper strips & active vertical power rails inside #kcomp-carrier-active.
 */
export function renderCarrierActiveOverlay(
  activeStrips: Array<{ x1: number; x2: number; y: number; color: string; netId: string }>,
  activeRailIds: Set<string>
) {
  const layer = document.querySelector<SVGGElement>('#kcomp-carrier-active');
  if (!layer) return;
  layer.innerHTML = '';

  const board = getActiveBoard();
  if (!isBoardCarrierActive(board, state.carrierEnabled) || !board.carrier) return;

  for (const rail of board.carrier.powerRails) {
    if (!activeRailIds.has(rail.id)) continue;
    const g = createEl('g', { class: 'wire-net-group', 'data-net-id': rail.netId });
    g.appendChild(createEl('line', {
      x1: rail.x,
      y1: rail.ys[0],
      x2: rail.x,
      y2: rail.ys[rail.ys.length - 1],
      stroke: rail.color,
      'stroke-width': 3.6,
      'stroke-linecap': 'round',
      opacity: 0.42,
      'pointer-events': 'none'
    }));
    layer.appendChild(g);
  }

  for (const st of activeStrips) {
    if (!Number.isFinite(st.x1) || !Number.isFinite(st.x2) || !Number.isFinite(st.y)) continue;
    const g = createEl('g', { class: 'wire-net-group', 'data-net-id': st.netId });
    g.appendChild(createEl('line', {
      x1: st.x1.toFixed(1),
      y1: st.y.toFixed(1),
      x2: st.x2.toFixed(1),
      y2: st.y.toFixed(1),
      stroke: st.color,
      'stroke-width': 3.4,
      'stroke-linecap': 'round',
      opacity: 0.55,
      'pointer-events': 'none'
    }));
    layer.appendChild(g);
  }
}
