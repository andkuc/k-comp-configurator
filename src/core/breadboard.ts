// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Red Prototyping Area (Breadboard) Visualization, Power Distribution Rails & 4+ I²C Bus Expansion Hub
import { SVG_NS } from './constants';
import { state, hooks, escapeHtml, getNetMeta } from './state';
import { getDisplayLabel } from './hardware';
import { boardToMaster } from './routing';
import { t } from '../i18n/index';
import { getActiveBoard, getBoardGeometry } from '../boards';

export function buildBreadboardBaseLayer(container) {
  container.innerHTML = '';
  const bb = getActiveBoard().breadboard;
  if (!bb) return;
  const { cols: BB_COLS, colX: BB_COL_X, topY: BB_TOP_Y, botY: BB_BOT_Y } = bb;

  const areaHit = document.createElementNS(SVG_NS, 'rect');
  areaHit.setAttribute('x', '285');
  areaHit.setAttribute('y', '16');
  areaHit.setAttribute('width', '159');
  areaHit.setAttribute('height', '104');
  areaHit.setAttribute('rx', '4');
  areaHit.setAttribute('fill', 'transparent');
  areaHit.setAttribute('style', 'cursor:help');
  areaHit.addEventListener('mouseenter', (ev: any) => {
    if (state.dragWire || state.dragComp || state.rotateComp) return;
    hooks.showCustomTooltip(t('tip.bbArea'), ev);
  });
  areaHit.addEventListener('mousemove', (ev: any) => { if (!state.dragWire && !state.dragComp && !state.rotateComp) hooks.moveTooltip(ev); });
  areaHit.addEventListener('mouseleave', () => hooks.hideTooltip());
  container.appendChild(areaHit);

  // Subtle dashed center trench divider (top 4-hole strips are electrically separate from bottom 4-hole strips)
  const trench = document.createElementNS(SVG_NS, 'line');
  trench.setAttribute('x1', '288');
  trench.setAttribute('y1', '68');
  trench.setAttribute('x2', '441');
  trench.setAttribute('y2', '68');
  trench.setAttribute('stroke', '#ffffff');
  trench.setAttribute('stroke-opacity', '0.28');
  trench.setAttribute('stroke-width', '0.9');
  trench.setAttribute('stroke-dasharray', '3,2');
  trench.setAttribute('pointer-events', 'none');
  container.appendChild(trench);

  const halves = [
    { half: 'T', ys: BB_TOP_Y },
    { half: 'B', ys: BB_BOT_Y }
  ];

  for (const { half, ys } of halves) {
    const yMin = ys[0];
    const yMax = ys[ys.length - 1];
    for (let col = 0; col < BB_COLS; col++) {
      const cx = BB_COL_X[col];
      const colName = `${half}${col + 1}`;

      // Subtle vertical bus bar showing the 4 vertically connected holes
      const strip = document.createElementNS(SVG_NS, 'rect');
      strip.setAttribute('x', (cx - 2.6).toFixed(1));
      strip.setAttribute('y', (yMin - 2.6).toFixed(1));
      strip.setAttribute('width', '5.2');
      strip.setAttribute('height', (yMax - yMin + 5.2).toFixed(1));
      strip.setAttribute('rx', '2.4');
      strip.setAttribute('fill', '#ffffff');
      strip.setAttribute('fill-opacity', '0.13');
      strip.setAttribute('stroke', '#ffffff');
      strip.setAttribute('stroke-opacity', '0.24');
      strip.setAttribute('stroke-width', '0.55');
      strip.setAttribute('class', 'bb-col-strip');
      strip.setAttribute('data-bb-col', colName);
      strip.setAttribute('pointer-events', 'none');
      container.appendChild(strip);

      // Subtle copper hole rings
      for (const cy of ys) {
        const hole = document.createElementNS(SVG_NS, 'circle');
        hole.setAttribute('cx', cx.toFixed(1));
        hole.setAttribute('cy', cy.toFixed(1));
        hole.setAttribute('r', '1.8');
        hole.setAttribute('fill', '#111827');
        hole.setAttribute('stroke', '#fca5a5');
        hole.setAttribute('stroke-opacity', '0.45');
        hole.setAttribute('stroke-width', '0.55');
        hole.setAttribute('pointer-events', 'none');
        container.appendChild(hole);
      }

      // Interactive hover target per vertical 4-hole strip (teaches internal connectivity & highlights active net!)
      const hit = document.createElementNS(SVG_NS, 'rect');
      hit.setAttribute('x', (cx - 4.3).toFixed(1));
      hit.setAttribute('y', (yMin - 4).toFixed(1));
      hit.setAttribute('width', '8.6');
      hit.setAttribute('height', (yMax - yMin + 8).toFixed(1));
      hit.setAttribute('fill', 'transparent');
      hit.setAttribute('class', 'bb-col-hit');
      hit.setAttribute('data-bb-col', colName);
      hit.addEventListener('mouseenter', (ev: any) => {
        if (state.dragWire || state.dragComp || state.rotateComp) return;
        const activeRail = (state.breadboardRails || []).find((r) => r.colNames.includes(colName));
        if (activeRail) {
          hooks.setHoveredNet(activeRail.netId);
          const srcLbl = getActiveBoard().pins[activeRail.bpId]?.label || activeRail.bpId;
          const users = activeRail.branches.map((b) => `${escapeHtml(getDisplayLabel(b.def))} (${escapeHtml(b.p.id)})`).join(', ');
          hooks.showCustomTooltip(
            t('tip.bbRail', {
              label: escapeHtml(activeRail.label),
              cols: activeRail.colNames.join(' + '),
              src: escapeHtml(srcLbl),
              feeder: activeRail.feederHole.colName,
              count: activeRail.branches.length,
              bridged: activeRail.bridges.length ? t('tip.bbBridged') : ''
            }) + `<br><span class="tip-muted">${users}</span>`,
            ev
          );
        } else {
          hooks.showCustomTooltip(
            t('tip.bbCol', { col: colName, half: half === 'T' ? t('tip.bbHalfTop') : t('tip.bbHalfBot') }),
            ev
          );
        }
      });
      hit.addEventListener('mousemove', (ev: any) => { if (!state.dragWire && !state.dragComp && !state.rotateComp) hooks.moveTooltip(ev); });
      hit.addEventListener('mouseleave', () => {
        hooks.setHoveredNet(null);
        hooks.hideTooltip();
      });
      container.appendChild(hit);
    }
  }
}

export function renderBreadboardActiveRails(rails) {
  if (!state.boardSvgEl) return;
  const layer = state.boardSvgEl.querySelector<any>('#kcomp-breadboard-rails');
  if (!layer) return;
  layer.innerHTML = '';
  const bb = getActiveBoard().breadboard;
  if (!bb) return;
  const { colX: BB_COL_X, topY: BB_TOP_Y, botY: BB_BOT_Y } = bb;

  const i2cExpRails = (rails || []).filter((r) => r.isI2cExpansion);

  for (const rail of (rails || [])) {
    const ys = rail.half === 'B' ? BB_BOT_Y : BB_TOP_Y;
    const yTop = ys[0];
    const yBot = ys[ys.length - 1];
    const strokeCol = rail.color === '#334155' ? '#e2e8f0' : rail.color;

    const railG = document.createElementNS(SVG_NS, 'g');
    railG.setAttribute('class', 'bb-rail-group');
    railG.setAttribute('data-net-id', rail.netId);
    railG.setAttribute('pointer-events', 'none');

    for (let ci = 0; ci < rail.cols.length; ci++) {
      const col = rail.cols[ci];
      const cx = BB_COL_X[col];

      const strip = document.createElementNS(SVG_NS, 'rect');
      strip.setAttribute('x', (cx - 3.6).toFixed(1));
      strip.setAttribute('y', (yTop - 3.6).toFixed(1));
      strip.setAttribute('width', '7.2');
      strip.setAttribute('height', (yBot - yTop + 7.2).toFixed(1));
      strip.setAttribute('rx', '3');
      strip.setAttribute('fill', rail.color);
      strip.setAttribute('fill-opacity', '0.45');
      strip.setAttribute('stroke', strokeCol);
      strip.setAttribute('stroke-width', '1.25');
      railG.appendChild(strip);

      // Crisp mini rail label above top-half rails or below bottom-half rails
      if (ci === 0) {
        const midX = rail.cols.length > 1 ? (BB_COL_X[rail.cols[0]] + BB_COL_X[rail.cols[rail.cols.length - 1]]) / 2 : cx;
        const shortTag = rail.shortTag || rail.label;
        const tw = Math.max(14, shortTag.length * 4.2 + 5);
        const tagY = rail.half === 'B' ? 117.2 : 13.0;

        const tagBg = document.createElementNS(SVG_NS, 'rect');
        tagBg.setAttribute('x', (midX - tw / 2).toFixed(1));
        tagBg.setAttribute('y', tagY.toFixed(1));
        tagBg.setAttribute('width', tw.toFixed(1));
        tagBg.setAttribute('height', '7.2');
        tagBg.setAttribute('rx', '2');
        tagBg.setAttribute('fill', '#0f172a');
        tagBg.setAttribute('stroke', strokeCol);
        tagBg.setAttribute('stroke-width', '0.8');
        railG.appendChild(tagBg);

        const tagTxt = document.createElementNS(SVG_NS, 'text');
        tagTxt.setAttribute('x', midX.toFixed(1));
        tagTxt.setAttribute('y', (tagY + 5.1).toFixed(1));
        tagTxt.setAttribute('fill', '#ffffff');
        tagTxt.setAttribute('font-family', 'Consolas, monospace');
        tagTxt.setAttribute('font-size', '4.4');
        tagTxt.setAttribute('font-weight', '800');
        tagTxt.setAttribute('text-anchor', 'middle');
        tagTxt.textContent = shortTag;
        railG.appendChild(tagTxt);
      }
    }

    // Draw short horizontal bridge jumper wires between extended columns (when >3 modules share a rail)
    for (const br of (rail.bridges || [])) {
      const x1 = BB_COL_X[br.fromCol];
      const y1 = ys[br.row];
      const x2 = BB_COL_X[br.toCol];
      const y2 = ys[br.row];
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', x1.toFixed(1));
      line.setAttribute('y1', y1.toFixed(1));
      line.setAttribute('x2', x2.toFixed(1));
      line.setAttribute('y2', y2.toFixed(1));
      line.setAttribute('stroke', strokeCol);
      line.setAttribute('stroke-width', '2.1');
      line.setAttribute('stroke-linecap', 'round');
      railG.appendChild(line);

      for (const bx of [x1, x2]) {
        const d = document.createElementNS(SVG_NS, 'circle');
        d.setAttribute('cx', bx.toFixed(1));
        d.setAttribute('cy', y1.toFixed(1));
        d.setAttribute('r', '2.2');
        d.setAttribute('fill', rail.color);
        d.setAttribute('stroke', '#ffffff');
        d.setAttribute('stroke-width', '0.8');
        railG.appendChild(d);
      }
    }

    layer.appendChild(railG);
  }

  // Draw crisp bracket badge grouping automatic 4+ I²C Bus Expansion columns on the bottom half
  if (i2cExpRails.length) {
    const allCols = i2cExpRails.flatMap((r) => r.cols);
    const minC = Math.min(...allCols);
    const maxC = Math.max(...allCols);
    const x1 = BB_COL_X[minC] - 4.2;
    const x2 = BB_COL_X[maxC] + 4.2;
    const midX = (x1 + x2) / 2;
    const hdr = i2cExpRails[0].i2cHeader || 'H3';

    const brk = document.createElementNS(SVG_NS, 'rect');
    brk.setAttribute('x', (x1 - 1.5).toFixed(1));
    brk.setAttribute('y', (BB_BOT_Y[0] - 5.8).toFixed(1));
    brk.setAttribute('width', (x2 - x1 + 3.0).toFixed(1));
    brk.setAttribute('height', (BB_BOT_Y[3] - BB_BOT_Y[0] + 11.6).toFixed(1));
    brk.setAttribute('rx', '4');
    brk.setAttribute('fill', 'none');
    brk.setAttribute('stroke', '#a855f7');
    brk.setAttribute('stroke-width', '0.95');
    brk.setAttribute('stroke-dasharray', '3,2');
    brk.setAttribute('pointer-events', 'none');
    layer.appendChild(brk);

    const lblBg = document.createElementNS(SVG_NS, 'rect');
    const lblText = `I²C BUS (${hdr})`;
    const lw = lblText.length * 4.1 + 8;
    lblBg.setAttribute('x', (midX - lw / 2).toFixed(1));
    lblBg.setAttribute('y', '64.6');
    lblBg.setAttribute('width', lw.toFixed(1));
    lblBg.setAttribute('height', '7.2');
    lblBg.setAttribute('rx', '2.5');
    lblBg.setAttribute('fill', '#4c1d95');
    lblBg.setAttribute('stroke', '#c084fc');
    lblBg.setAttribute('stroke-width', '0.75');
    lblBg.setAttribute('pointer-events', 'none');
    layer.appendChild(lblBg);

    const lblEl = document.createElementNS(SVG_NS, 'text');
    lblEl.setAttribute('x', midX.toFixed(1));
    lblEl.setAttribute('y', '69.7');
    lblEl.setAttribute('fill', '#f5f3ff');
    lblEl.setAttribute('font-family', 'Consolas, monospace');
    lblEl.setAttribute('font-size', '4.3');
    lblEl.setAttribute('font-weight', '800');
    lblEl.setAttribute('text-anchor', 'middle');
    lblEl.setAttribute('pointer-events', 'none');
    lblEl.textContent = lblText;
    layer.appendChild(lblEl);
  }
}

export function allocateBreadboardRails(wireJobs) {
  const bb = getActiveBoard().breadboard;
  if (!bb) return [];
  const { cols: BB_COLS, colX: BB_COL_X, topY: BB_TOP_Y, botY: BB_BOT_Y } = bb;
  const { tx: BOARD_TX } = getBoardGeometry();
  const byBp = new Map();
  for (const j of wireJobs) {
    if (!byBp.has(j.bpId)) byBp.set(j.bpId, []);
    byBp.get(j.bpId).push(j);
  }

  const rails = [];
  let nextTopCol = 1; // Top half (T2..T16): shared power/system rails (5V, 3.3V, GND, RESET)
  let nextBotCol = 1; // Bottom half (B2..B16): automatic 4+ I²C Bus Expansion Hub (VCC, GND, SCL, SDA)

  // Stable ordering: place Power rails first, then grouped I²C expansion pins in clean VCC/GND/SCL/SDA order
  const i2cPinOrder = { VCC: 0, GND: 1, SCL: 2, SDA: 3 };
  const entries = Array.from(byBp.entries()).sort(([a], [b]) => {
    const aI2c = /^H[1-3]_/.test(a);
    const bI2c = /^H[1-3]_/.test(b);
    if (aI2c !== bI2c) return aI2c ? 1 : -1;
    if (aI2c && bI2c) {
      const [ah, ap] = a.split('_');
      const [bh, bp] = b.split('_');
      if (ah !== bh) return ah.localeCompare(bh);
      return (i2cPinOrder[ap] ?? 9) - (i2cPinOrder[bp] ?? 9);
    }
    return a.localeCompare(b);
  });

  const hasI2cBottomHub = entries.some(([bpId, lst]) => {
    const m = getActiveBoard().pins[bpId];
    return m && m.shared && lst.length >= 2 && /^H([1-3])_(VCC|GND|SCL|SDA)$/.test(bpId);
  });

  for (const [bpId, lst] of entries) {
    const meta = getActiveBoard().pins[bpId];
    const forcedBb = lst.some((j) => !!j.forceBreadboard);
    if (!meta || !meta.shared || (lst.length < 2 && !forcedBb)) continue;

    const isI2cExp = /^H([1-3])_(VCC|GND|SCL|SDA)$/.test(bpId);
    const i2cMatch = isI2cExp ? bpId.match(/^H([1-3])_(VCC|GND|SCL|SDA)$/) : null;
    const netCheck = getNetMeta(bpId);
    const isBottomGndRail = !isI2cExp && !hasI2cBottomHub && netCheck.id === 'NET_GND';
    const half = (isI2cExp || isBottomGndRail) ? 'B' : 'T';
    const ys = half === 'B' ? BB_BOT_Y : BB_TOP_Y;

    const n = lst.length;
    const colsUsed = [];
    if (half === 'B') {
      const needed = n <= 3 ? 1 : (1 + Math.ceil((n - 2) / 3));
      for (let k = 0; k < needed; k++) {
        colsUsed.push(Math.min(nextBotCol + k, BB_COLS - 1));
      }
      // Keep I²C bus columns compactly spaced (gap of 1 column between VCC/GND/SCL/SDA, or tight if > 3 modules need bridging)
      nextBotCol = colsUsed[colsUsed.length - 1] + (isI2cExp ? (n <= 3 ? 2 : 1) : (n <= 3 ? 3 : 2));
    } else {
      if (n <= 3) {
        const c = Math.min(nextTopCol, BB_COLS - 2);
        colsUsed.push(c);
        nextTopCol = c + 3;
      } else {
        const needed = 1 + Math.ceil((n - 2) / 3);
        for (let k = 0; k < needed; k++) {
          colsUsed.push(Math.min(nextTopCol + k, BB_COLS - 1));
        }
        nextTopCol = colsUsed[colsUsed.length - 1] + 2;
      }
    }

    const shortLbl = isI2cExp
      ? `I²C ${i2cMatch[2]}`
      : bpId
          .replace('PWR_', '')
          .replace('GND1', 'GND')
          .replace('GND2', 'GND')
          .replace('TOP_', '')
          .replace('EXT_', '');
    const shortTag = isI2cExp ? i2cMatch[2] : shortLbl;
    const railColor = lst[0].p.color;
    const feederCol = colsUsed[0];
    const feederRow = 0;
    const feederBoardPt = { x: BB_COL_X[feederCol], y: ys[feederRow] };
    const feederMasterPt = boardToMaster(feederBoardPt.x, feederBoardPt.y);

    const branchSlots = [];
    const bridges = [];
    if (colsUsed.length === 1) {
      for (let i = 0; i < n; i++) {
        const row = i + 1;
        const microDx = row === 1 ? -4.5 : (row === 2 ? 4.5 : -8.5);
        branchSlots.push({ col: colsUsed[0], row, microDx });
      }
    } else {
      let bi = 0;
      for (const r of [1, 2]) {
        if (bi < n) {
          branchSlots.push({ col: colsUsed[0], row: r, microDx: r === 1 ? -4.5 : 4.5 });
          bi++;
        }
      }
      for (let ci = 1; ci < colsUsed.length; ci++) {
        const prevCol = colsUsed[ci - 1];
        const curCol = colsUsed[ci];
        bridges.push({
          fromCol: prevCol,
          toCol: curCol,
          row: 3,
          fromName: `${half}${prevCol + 1}`,
          toName: `${half}${curCol + 1}`
        });
        for (const r of [0, 1, 2]) {
          if (bi < n) {
            const microDx = r === 0 ? 0 : (r === 1 ? 4.5 : 8.5);
            branchSlots.push({ col: curCol, row: r, microDx });
            bi++;
          }
        }
      }
    }

    const net = getNetMeta(bpId);
    const rail = {
      bpId,
      netId: net.id,
      netLabel: net.label,
      half,
      isI2cExpansion: isI2cExp,
      i2cHeader: i2cMatch ? `H${i2cMatch[1]}` : null,
      label: shortLbl,
      shortTag,
      color: railColor,
      cols: colsUsed,
      colNames: colsUsed.map((c) => `${half}${c + 1}`),
      feederHole: {
        col: feederCol,
        row: feederRow,
        colName: `${half}${feederCol + 1}`,
        holeNum: feederRow + 1,
        boardPt: feederBoardPt,
        masterPt: feederMasterPt
      },
      bridges,
      branches: []
    };

    lst.sort((a, b) => {
      const sa = a.start.x < BOARD_TX ? 0 : 1;
      const sb = b.start.x < BOARD_TX ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.start.y - b.start.y;
    });

    lst.forEach((job, idx) => {
      const slot = branchSlots[idx] || branchSlots[branchSlots.length - 1];
      const bPt = { x: BB_COL_X[slot.col], y: ys[slot.row] };
      const mPt = boardToMaster(bPt.x, bPt.y);
      job.bbHole = {
        col: slot.col,
        row: slot.row,
        half,
        colName: `${half}${slot.col + 1}`,
        holeNum: slot.row + 1,
        microDx: slot.microDx,
        boardPt: bPt,
        masterPt: mPt,
        rail
      };
      job.origBoardEnd = job.end;
      job.end = mPt;
      rail.branches.push(job);
    });

    rails.push(rail);
  }

  return rails;
}

/**
 * Computes an explicit drag-to-rewire drop target directly on the onboard red Breadboard
 * for shared power/GND/3.3V/RESET pins — either snapping onto an existing matching rail
 * or creating a fresh rail slot on the appropriate half (bottom = GND, top = +5V / +3.3V / RESET).
 */
export function getBreadboardDropTarget(pinSpec: any, existingRails: any[]) {
  const board = getActiveBoard();
  const bb = board.breadboard;
  if (!bb) return null;

  const allowed = pinSpec.allowedTypes || [];
  let role: string | null = null;
  let netId: string | null = null;
  let railName = '';
  let shortLbl = '';

  if (pinSpec.role === 'GND' || allowed.includes('GND')) {
    role = 'GND'; netId = 'NET_GND'; railName = 'GND'; shortLbl = 'BB GND';
  } else if (pinSpec.role === 'POWER_5V' || allowed.includes('5V')) {
    role = 'POWER_5V'; netId = 'NET_5V'; railName = '5V'; shortLbl = 'BB 5V';
  } else if (pinSpec.role === 'POWER_3V3' || allowed.includes('3V3')) {
    role = 'POWER_3V3'; netId = 'NET_3V3'; railName = '3.3V'; shortLbl = 'BB 3.3V';
  } else if (pinSpec.role === 'RESET' || allowed.includes('RESET')) {
    role = 'RESET'; netId = 'NET_RST'; railName = 'RESET'; shortLbl = 'BB RST';
  } else {
    return null;
  }

  const prioList = board.powerPinPriority?.[role] || [];
  const defaultPin = prioList[0];
  if (!defaultPin || !board.pins[defaultPin]) return null;

  // 1. If a matching non-I2C rail already exists on the red breadboard, snap directly onto it!
  const matchRail = (existingRails || []).find((r) => !r.isI2cExpansion && r.netId === netId);
  if (matchRail) {
    const lastCol = matchRail.cols[matchRail.cols.length - 1];
    const ys = matchRail.half === 'B' ? bb.botY : bb.topY;
    const midY = (ys[1] + ys[2]) / 2;
    return {
      boardPinId: matchRail.bpId,
      forceBreadboard: true,
      isBreadboardTarget: true,
      label: t('drag.bbRailTarget', { name: railName, col: matchRail.colNames.join('+') }),
      shortLabel: `⊞ ${shortLbl} (${matchRail.colNames[0]})`,
      masterPt: boardToMaster(bb.colX[lastCol], midY)
    };
  }

  // 2. Otherwise offer a clean drop spot on the appropriate breadboard half!
  const hasI2cBottomHub = (existingRails || []).some((r) => r.isI2cExpansion);
  const useBottom = netId === 'NET_GND' && !hasI2cBottomHub;
  const ys = useBottom ? bb.botY : bb.topY;
  const usedCols = new Set(
    (existingRails || [])
      .filter((r) => (r.half === 'B') === useBottom)
      .flatMap((r) => r.cols)
  );
  let targetCol = 1;
  for (let c = 1; c < bb.cols - 1; c += 2) {
    if (!usedCols.has(c)) { targetCol = c; break; }
  }
  const colName = `${useBottom ? 'B' : 'T'}${targetCol + 1}`;
  const midY = (ys[1] + ys[2]) / 2;

  return {
    boardPinId: defaultPin,
    forceBreadboard: true,
    isBreadboardTarget: true,
    label: t('drag.bbRailTarget', { name: railName, col: colName }),
    shortLabel: `⊞ ${shortLbl}`,
    masterPt: boardToMaster(bb.colX[targetCol], midY)
  };
}
