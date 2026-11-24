// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Smart Orthogonal Perimeter Wire Routing & Classic Curved Routing
import { BOARD_TX, BOARD_TY, BOARD_SCALE, BOARD_RIGHT, BOARD_BOTTOM } from './constants.js?v=0.1.0';

export function rotatePoint(x, y, cx, cy, deg) {
  if (!deg) return { x, y };
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

export function getRotatedBoxBounds(b, rotOverride = null) {
  const rot = rotOverride !== null ? rotOverride : (b.inst ? (b.inst.rotation || 0) : 0);
  if (!rot) return { minX: b.x, minY: b.y, maxX: b.x + b.w, maxY: b.y + b.h };
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const corners = [
    rotatePoint(b.x, b.y, cx, cy, rot),
    rotatePoint(b.x + b.w, b.y, cx, cy, rot),
    rotatePoint(b.x + b.w, b.y + b.h, cx, cy, rot),
    rotatePoint(b.x, b.y + b.h, cx, cy, rot)
  ];
  return {
    minX: Math.min(...corners.map((c) => c.x)),
    minY: Math.min(...corners.map((c) => c.y)),
    maxX: Math.max(...corners.map((c) => c.x)),
    maxY: Math.max(...corners.map((c) => c.y))
  };
}

export function boardToMaster(x, y) {
  return { x: BOARD_TX + x * BOARD_SCALE, y: BOARD_TY + y * BOARD_SCALE };
}

export function roundedOrthoPath(points, radius = 7) {
  const pts = [];
  for (const p of points) {
    if (!pts.length || Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y) > 0.8) {
      pts.push(p);
    }
  }
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  }
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, d1 * 0.44, d2 * 0.44);
    if (r < 1) {
      d += ` L ${cur.x.toFixed(1)} ${cur.y.toFixed(1)}`;
      continue;
    }
    const ax = cur.x - ((cur.x - prev.x) / d1) * r;
    const ay = cur.y - ((cur.y - prev.y) / d1) * r;
    const bx = cur.x + ((next.x - cur.x) / d2) * r;
    const by = cur.y + ((next.y - cur.y) / d2) * r;
    d += ` L ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${cur.x.toFixed(1)} ${cur.y.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

export function getBoardPinApproach(bpId) {
  const meta = window.KCOMP_BOARD.pins[bpId];
  if (!meta) return 'bottom';
  const g = meta.group;
  if (g === 'digital' || g === 'i2c' || g === 'i2c_h1') return 'top';
  if (g === 'i2c_h2' || g === 'i2c_h3' || g === 'distance') return 'right';
  if (g === 'slot_hc05') return 'bottom';
  if (g === 'slot_esp') return meta.y < 225 ? 'top' : 'bottom';
  if (bpId === 'TOP_GND' || bpId === 'TOP_AREF') return 'top';
  return 'bottom';
}

export function resolveSmartOverlaps(wireJobs, tol = 4.2, step = 5.5, passes = 8) {
  const bps = wireJobs.map((j) => j.bpId);

  const collectSegs = () => {
    const hs = [];
    const vs = [];
    for (let wi = 0; wi < wireJobs.length; wi++) {
      const pts = wireJobs[wi].pts;
      const n = pts.length;
      for (let i = 0; i < n - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const isInt = i > 0 && i + 1 < n - 1;
        if (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.x - a.x) > 1.0) {
          hs.push({ wi, i, isInt, c: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
        } else if (Math.abs(a.x - b.x) < 0.5 && Math.abs(b.y - a.y) > 1.0) {
          vs.push({ wi, i, isInt, c: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
        }
      }
    }
    return { hs, vs };
  };

  const isFree = (segs, myIdx, cand, lo, hi, ignoreSameBp) => {
    const myW = segs[myIdx].wi;
    for (let k = 0; k < segs.length; k++) {
      if (k === myIdx || segs[k].wi === myW) continue;
      if (ignoreSameBp && bps[segs[k].wi] === bps[myW]) continue;
      if (Math.abs(segs[k].c - cand) < tol && (Math.min(segs[k].hi, hi) - Math.max(segs[k].lo, lo)) > 3.0) {
        return false;
      }
    }
    return true;
  };

  const mults = [1, -1, 2, -2, 3, -3, 4, -4];
  for (let pass = 0; pass < passes; pass++) {
    let changed = false;
    const { hs, vs } = collectSegs();

    for (let a = 0; a < hs.length; a++) {
      for (let b = a + 1; b < hs.length; b++) {
        const s1 = hs[a], s2 = hs[b];
        if (s1.wi === s2.wi) continue;
        if (Math.abs(s1.c - s2.c) < tol && (Math.min(s1.hi, s2.hi) - Math.max(s1.lo, s2.lo)) > 3.0) {
          const tIdx = s2.isInt ? b : (s1.isInt ? a : -1);
          if (tIdx === -1) continue;
          const ts = hs[tIdx];
          for (const m of mults) {
            const cand = ts.c + m * step;
            if (isFree(hs, tIdx, cand, ts.lo, ts.hi, false)) {
              wireJobs[ts.wi].pts[ts.i].y = cand;
              wireJobs[ts.wi].pts[ts.i + 1].y = cand;
              ts.c = cand;
              changed = true;
              break;
            }
          }
        }
      }
    }

    for (let a = 0; a < vs.length; a++) {
      for (let b = a + 1; b < vs.length; b++) {
        const s1 = vs[a], s2 = vs[b];
        if (s1.wi === s2.wi || bps[s1.wi] === bps[s2.wi]) continue;
        if (Math.abs(s1.c - s2.c) < tol && (Math.min(s1.hi, s2.hi) - Math.max(s1.lo, s2.lo)) > 3.0) {
          const tIdx = s2.isInt ? b : (s1.isInt ? a : -1);
          if (tIdx === -1) continue;
          const ts = vs[tIdx];
          for (const m of mults) {
            const cand = ts.c + m * step;
            if (isFree(vs, tIdx, cand, ts.lo, ts.hi, true)) {
              wireJobs[ts.wi].pts[ts.i].x = cand;
              wireJobs[ts.wi].pts[ts.i + 1].x = cand;
              ts.c = cand;
              changed = true;
              break;
            }
          }
        }
      }
    }
    if (!changed) break;
  }
}

export function routeSmartWires(wireJobs, rails) {
  const byCard = new Map();
  for (const j of wireJobs) {
    const rb = j.rb;
    if (rb.maxX <= BOARD_TX + 20) j.cardSide = 'left';
    else if (rb.minX >= BOARD_RIGHT - 20) j.cardSide = 'right';
    else if (rb.maxY <= BOARD_TY + 20) j.cardSide = 'top';
    else j.cardSide = 'bottom';
    j.approach = j.bbHole ? 'top' : getBoardPinApproach(j.bpId);
    j.targetOff = 0;
    const cid = j.box.inst.instanceId;
    if (!byCard.has(cid)) byCard.set(cid, []);
    byCard.get(cid).push(j);
  }

  // 1. Detect coherent pin-header orientation per component card (never splits a pin column)
  for (const clist of byCard.values()) {
    const rb = clist[0].rb;
    const cx = (rb.minX + rb.maxX) / 2;
    const cy = (rb.minY + rb.maxY) / 2;
    const xs = clist.map((z) => z.start.x);
    const ys = clist.map((z) => z.start.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);

    if (spanX > 60 && spanY > 60) {
      for (const z of clist) {
        const dL = z.start.x - rb.minX, dR = rb.maxX - z.start.x;
        const dT = z.start.y - rb.minY, dB = rb.maxY - z.start.y;
        if (Math.min(dL, dR) <= Math.min(dT, dB)) z.exitEdge = dL <= dR ? 'left' : 'right';
        else z.exitEdge = dT <= dB ? 'top' : 'bottom';
      }
    } else if (spanY >= spanX) {
      const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
      const edge = avgX >= cx ? 'right' : 'left';
      for (const z of clist) z.exitEdge = edge;
    } else {
      const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
      const edge = avgY >= cy ? 'bottom' : 'top';
      for (const z of clist) z.exitEdge = edge;
    }
  }

  // Slight X separation for H1 vertical shafts if a Digital pin 3.5px away is also wired
  const wiredDigitalXs = wireJobs
    .filter((z) => !z.bbHole && window.KCOMP_BOARD.pins[z.bpId]?.group === 'digital')
    .map((z) => z.end.x);
  for (const j of wireJobs) {
    if (!j.bbHole && window.KCOMP_BOARD.pins[j.bpId]?.group === 'i2c_h1') {
      if (wiredDigitalXs.some((dx) => Math.abs(j.end.x - dx) < 4.5)) {
        j.targetOff = 2.4;
      }
    }
  }

  // 2. Per-card staggered exit fanout
  const byCardEdge = new Map();
  for (const j of wireJobs) {
    const k = `${j.box.inst.instanceId}::${j.exitEdge}`;
    if (!byCardEdge.has(k)) byCardEdge.set(k, []);
    byCardEdge.get(k).push(j);
  }
  for (const lst of byCardEdge.values()) {
    const edge = lst[0].exitEdge;
    const rb = lst[0].rb;
    const cside = lst[0].cardSide;
    if (edge === 'bottom' || edge === 'top') {
      lst.sort((a, b) => (cside === 'left' ? b.start.x - a.start.x : a.start.x - b.start.x));
      lst.forEach((z, rank) => {
        z.fanY = edge === 'bottom' ? (rb.maxY + 8 + rank * 7) : (rb.minY - 8 - rank * 7);
      });
    } else {
      const away = (cside === 'left' && edge === 'left') || (cside === 'right' && edge === 'right');
      if (away) {
        const avgEy = lst.reduce((a, z) => a + z.end.y, 0) / lst.length;
        const wrapTop = avgEy < (rb.minY + rb.maxY) / 2;
        lst.sort((a, b) => (wrapTop ? a.start.y - b.start.y : b.start.y - a.start.y));
        lst.forEach((z, rank) => {
          z.fanX = edge === 'left' ? (rb.minX - 9 - rank * 6.5) : (rb.maxX + 9 + rank * 6.5);
          z.wrapY = wrapTop ? (rb.minY - 8 - rank * 6.5) : (rb.maxY + 8 + rank * 6.5);
        });
      }
    }
  }

  // 3. Build Feeder wire jobs (K-Comp shared pin -> Breadboard column hole 0) so they get their own dedicated corridor tracks!
  const feederJobs = (rails || []).map((rail) => {
    const raw = window.KCOMP_BOARD.pins[rail.bpId];
    const srcPt = boardToMaster(raw.x, raw.y);
    const dstPt = rail.feederHole.masterPt;
    const srcApp = getBoardPinApproach(rail.bpId);
    return {
      isFeeder: true,
      rail,
      bpId: rail.bpId,
      start: srcPt,
      end: dstPt,
      srcApproach: srcApp,
      cardSide: srcApp === 'right' ? 'right' : 'left',
      approach: 'top'
    };
  });

  // 4. Assign non-overlapping perimeter corridor tracks across BOTH component wires AND feeder wires
  const leftBus = [], rightBus = [], topBus = [], botBus = [];
  for (const j of wireJobs) {
    const cs = j.cardSide, ap = j.approach;
    if (cs === 'left') {
      leftBus.push(j);
      if (ap === 'top') topBus.push(j);
      else if (ap === 'bottom') botBus.push(j);
      else if (ap === 'right') {
        j.wrapSide = j.start.y < (BOARD_TY + BOARD_BOTTOM) / 2 ? 'top' : 'bottom';
        (j.wrapSide === 'top' ? topBus : botBus).push(j);
        rightBus.push(j);
      }
    } else if (cs === 'right') {
      rightBus.push(j);
      if (ap === 'top') topBus.push(j);
      else if (ap === 'bottom') botBus.push(j);
      else if (ap === 'left') {
        j.wrapSide = 'bottom'; botBus.push(j); leftBus.push(j);
      }
    } else if (cs === 'top') {
      topBus.push(j);
      if (ap === 'bottom') {
        j.wrapSide = j.start.x < (BOARD_TX + BOARD_RIGHT) / 2 ? 'left' : 'right';
        (j.wrapSide === 'left' ? leftBus : rightBus).push(j);
        botBus.push(j);
      } else if (ap === 'right') rightBus.push(j);
    } else {
      botBus.push(j);
      if (ap === 'top') {
        j.wrapSide = j.start.x < (BOARD_TX + BOARD_RIGHT) / 2 ? 'left' : 'right';
        (j.wrapSide === 'left' ? leftBus : rightBus).push(j);
        topBus.push(j);
      } else if (ap === 'right') rightBus.push(j);
    }
  }

  for (const fj of feederJobs) {
    topBus.push(fj);
    if (fj.srcApproach === 'bottom') {
      botBus.push(fj);
      leftBus.push(fj);
    } else if (fj.srcApproach === 'right') {
      rightBus.push(fj);
    }
  }

  if (leftBus.length) {
    leftBus.sort((a, b) => {
      if (!!a.isFeeder !== !!b.isFeeder) return a.isFeeder ? 1 : -1; // Feeders hug PCB inner edge cleanly
      const da = a.approach === 'top' ? 0 : 1, db = b.approach === 'top' ? 0 : 1;
      if (da !== db) return da - db;
      const dx = a.approach === 'top' ? (b.end.x - a.end.x) : (a.end.x - b.end.x);
      return Math.abs(dx) > 1 ? dx : (a.start.y - b.start.y);
    });
    const leftCardEdges = wireJobs.filter((z) => z.cardSide === 'left').map((z) => z.rb.maxX);
    const maxCardR = leftCardEdges.length ? Math.max(...leftCardEdges) : 296;
    const lo = maxCardR + 8, hi = BOARD_TX - 8;
    const n = leftBus.length;
    const step = Math.min(7.5, Math.max(4.8, (hi - lo) / Math.max(n, 1)));
    const startX = (lo + hi) / 2 - ((n - 1) * step) / 2;
    leftBus.forEach((z, idx) => { z.leftX = startX + idx * step; });
  }

  if (rightBus.length) {
    rightBus.sort((a, b) => {
      if (!!a.isFeeder !== !!b.isFeeder) return a.isFeeder ? -1 : 1;
      const ord = (ap) => ap === 'right' ? 0 : (ap === 'top' ? 1 : 2);
      if (ord(a.approach) !== ord(b.approach)) return ord(a.approach) - ord(b.approach);
      return Math.abs(a.end.y - b.end.y) > 1 ? (a.end.y - b.end.y) : (a.end.x - b.end.x);
    });
    const rightCardEdges = wireJobs.filter((z) => z.cardSide === 'right').map((z) => z.rb.minX);
    const minCardL = rightCardEdges.length ? Math.min(...rightCardEdges) : 1024;
    const lo = BOARD_RIGHT + 8, hi = minCardL - 8;
    const n = rightBus.length;
    const step = Math.min(7.5, Math.max(4.8, (hi - lo) / Math.max(n, 1)));
    const startX = (lo + hi) / 2 - ((n - 1) * step) / 2;
    rightBus.forEach((z, idx) => { z.rightX = startX + idx * step; });
  }

  if (topBus.length) {
    topBus.sort((a, b) => {
      const sa = a.cardSide === 'left' ? 0 : 1, sb = b.cardSide === 'left' ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.cardSide === 'left' ? (a.end.x - b.end.x) : (b.end.x - a.end.x);
    });
    topBus.forEach((z, idx) => { z.topY = BOARD_TY - 14 - idx * 7.4; });
  }

  if (botBus.length) {
    botBus.sort((a, b) => {
      const sa = a.cardSide === 'left' ? 0 : 1, sb = b.cardSide === 'left' ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const ax = a.isFeeder ? a.start.x : a.end.x;
      const bx = b.isFeeder ? b.start.x : b.end.x;
      return a.cardSide === 'left' ? (ax - bx) : (bx - ax);
    });
    botBus.forEach((z, idx) => { z.botY = BOARD_BOTTOM + 14 + idx * 7.4; });
  }

  // 5. Assemble orthogonal polylines for component wires
  for (const j of wireJobs) {
    const sx = j.start.x, sy = j.start.y;
    const ex = j.end.x, ey = j.end.y;
    const cs = j.cardSide, ap = j.approach, toff = j.targetOff || 0;
    const pts = [{ x: sx, y: sy }];
    let curX = sx, curY = sy;

    if (j.exitEdge === 'bottom' || j.exitEdge === 'top') {
      curY = j.fanY;
      pts.push({ x: curX, y: curY });
    } else if (j.fanX !== undefined) {
      pts.push({ x: j.fanX, y: curY }, { x: j.fanX, y: j.wrapY });
      curX = j.fanX; curY = j.wrapY;
    }

    const finishVertical = (trackY, fromTop) => {
      if (j.bbHole) {
        // Dedicated vertical micro-lane into breadboard hole (zero overlap with feeder or sibling holes!)
        const tx = ex + (j.bbHole.microDx || 0);
        pts.push({ x: tx, y: trackY });
        if (Math.abs(j.bbHole.microDx || 0) > 0.1) {
          pts.push({ x: tx, y: ey });
        }
        pts.push({ x: ex, y: ey });
        return;
      }
      const tx = ex + toff;
      pts.push({ x: tx, y: trackY });
      if (Math.abs(toff) > 0.1) pts.push({ x: tx, y: fromTop ? ey - 10 : ey + 10 });
      pts.push({ x: ex, y: ey });
    };
    const finishRight = (rx) => {
      pts.push({ x: rx, y: ey }, { x: ex, y: ey });
    };

    if (cs === 'left') {
      const lx = j.leftX;
      pts.push({ x: lx, y: curY });
      if (ap === 'top') { pts.push({ x: lx, y: j.topY }); finishVertical(j.topY, true); }
      else if (ap === 'bottom') { pts.push({ x: lx, y: j.botY }); finishVertical(j.botY, false); }
      else if (ap === 'right') {
        const wy = j.wrapSide === 'top' ? j.topY : j.botY;
        pts.push({ x: lx, y: wy }, { x: j.rightX, y: wy });
        finishRight(j.rightX);
      }
      j.exitX = lx; j.vertical = false;
    } else if (cs === 'right') {
      const rx = j.rightX;
      pts.push({ x: rx, y: curY });
      if (ap === 'right') finishRight(rx);
      else if (ap === 'top') { pts.push({ x: rx, y: j.topY }); finishVertical(j.topY, true); }
      else if (ap === 'bottom') { pts.push({ x: rx, y: j.botY }); finishVertical(j.botY, false); }
      j.exitX = rx; j.vertical = false;
    } else if (cs === 'top') {
      const ty = j.topY;
      pts.push({ x: curX, y: ty });
      if (ap === 'top') finishVertical(ty, true);
      else if (ap === 'right') { pts.push({ x: j.rightX, y: ty }); finishRight(j.rightX); }
      else {
        const wx = j.wrapSide === 'left' ? j.leftX : j.rightX;
        pts.push({ x: wx, y: ty }, { x: wx, y: j.botY });
        finishVertical(j.botY, false);
      }
      j.exitX = curX; j.vertical = true;
    } else {
      const by = j.botY;
      pts.push({ x: curX, y: by });
      if (ap === 'bottom') finishVertical(by, false);
      else if (ap === 'right') { pts.push({ x: j.rightX, y: by }); finishRight(j.rightX); }
      else {
        const wx = j.wrapSide === 'left' ? j.leftX : j.rightX;
        pts.push({ x: wx, y: by }, { x: wx, y: j.topY });
        finishVertical(j.topY, true);
      }
      j.exitX = curX; j.vertical = true;
    }

    j.pts = pts;
  }

  // 6. Assemble orthogonal polylines for Feeder wires (K-Comp shared pin -> Breadboard hole 0)
  for (const fj of feederJobs) {
    const sx = fj.start.x, sy = fj.start.y;
    const ex = fj.end.x, ey = fj.end.y;
    if (fj.srcApproach === 'bottom') {
      fj.pts = [
        { x: sx, y: sy },
        { x: sx, y: fj.botY },
        { x: fj.leftX, y: fj.botY },
        { x: fj.leftX, y: fj.topY },
        { x: ex, y: fj.topY },
        { x: ex, y: ey }
      ];
    } else if (fj.srcApproach === 'right') {
      fj.pts = [
        { x: sx, y: sy },
        { x: fj.rightX, y: sy },
        { x: fj.rightX, y: fj.topY },
        { x: ex, y: fj.topY },
        { x: ex, y: ey }
      ];
    } else {
      fj.pts = [
        { x: sx, y: sy },
        { x: sx, y: fj.topY },
        { x: ex, y: fj.topY },
        { x: ex, y: ey }
      ];
    }
  }

  // 7. Global nearest-free-track overlap resolver across ALL wires (components + feeders)
  const allJobs = [...wireJobs, ...feederJobs];
  resolveSmartOverlaps(allJobs);

  for (const j of wireJobs) {
    j.routed = {
      d: roundedOrthoPath(j.pts, 7),
      exitX: j.exitX,
      vertical: j.vertical
    };
  }
  for (const fj of feederJobs) {
    fj.rail.feederPathD = roundedOrthoPath(fj.pts, 7);
    fj.rail.feederStartPt = fj.start;
  }
}

export function buildCurvedWirePath(box, start, end, laneOffset, rotOverride = null) {
  const rb = getRotatedBoxBounds(box, rotOverride);
  const cardLeftOfBoard = rb.maxX <= (BOARD_TX + 25);
  const cardRightOfBoard = rb.minX >= (BOARD_RIGHT - 25);
  const approach = box._isBreadboard ? 'top' : getBoardPinApproach(box._curBpId || '');

  if (cardLeftOfBoard) {
    const corridorX = Math.min(end.x - 16, rb.maxX + 22 + laneOffset);
    const ctrlY = approach === 'top' ? Math.min(start.y, end.y) - 26 : (approach === 'bottom' ? Math.max(start.y, end.y) + 34 + laneOffset * 0.4 : (start.y + end.y) / 2);
    return {
      d: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${corridorX.toFixed(1)} ${start.y.toFixed(1)}, ${corridorX.toFixed(1)} ${ctrlY.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
      exitX: corridorX,
      vertical: false
    };
  }
  if (cardRightOfBoard) {
    const corridorX = Math.max(end.x + 16, rb.minX - 22 + laneOffset);
    const ctrlY = approach === 'top' ? Math.min(start.y, end.y) - 26 : (approach === 'bottom' ? Math.max(start.y, end.y) + 34 + laneOffset * 0.4 : (start.y + end.y) / 2);
    return {
      d: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${corridorX.toFixed(1)} ${start.y.toFixed(1)}, ${corridorX.toFixed(1)} ${ctrlY.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
      exitX: corridorX,
      vertical: false
    };
  }
  const midY = (start.y + end.y) / 2 + laneOffset * 0.6;
  return {
    d: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${start.x.toFixed(1)} ${midY.toFixed(1)}, ${end.x.toFixed(1)} ${midY.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
    exitX: (start.x + end.x) / 2,
    vertical: true
  };
}

export function buildCurvedFeederPath(rail, idx) {
  const raw = window.KCOMP_BOARD.pins[rail.bpId];
  const start = boardToMaster(raw.x, raw.y);
  const end = rail.feederHole.masterPt;
  const app = getBoardPinApproach(rail.bpId);
  const off = idx * 10;
  if (app === 'bottom') {
    const botY = BOARD_BOTTOM + 18 + off;
    const leftX = BOARD_TX - 22 - off;
    const topY = BOARD_TY - 18 - off;
    return {
      start,
      d: roundedOrthoPath([start, { x: start.x, y: botY }, { x: leftX, y: botY }, { x: leftX, y: topY }, { x: end.x, y: topY }, end], 12)
    };
  }
  if (app === 'right') {
    const rightX = BOARD_RIGHT + 20 + off;
    const topY = BOARD_TY - 18 - off;
    return {
      start,
      d: roundedOrthoPath([start, { x: rightX, y: start.y }, { x: rightX, y: topY }, { x: end.x, y: topY }, end], 12)
    };
  }
  const topY = BOARD_TY - 18 - off;
  return {
    start,
    d: roundedOrthoPath([start, { x: start.x, y: topY }, { x: end.x, y: topY }, end], 12)
  };
}
