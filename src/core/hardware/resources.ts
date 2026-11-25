// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Declarative DIP Switch Calculator, SRAM Breakdown & 5V USB Current Estimator
import { state, getActiveOnboardDefs, formatRamAmount } from '../state';
import { computeCodeBlocksSramFromList } from '../code-blocks-sram';
import { t, tOnboard, tDipName } from '../../i18n/index';
import { getActiveBoard } from '../../boards';
import type { DipSwitchState, SramBreakdown, UsbCurrentEstimate } from '../../types';
import { getCompDef, getDisplayLabel } from './catalog-queries';
import { getExternalPinClaims } from './pin-allocator';

export function computeDipStates(): DipSwitchState[] {
  const board = getActiveBoard();
  if (!board.dipSwitches || !board.dipSwitches.length) return [];
  const extClaims = getExternalPinClaims();
  const hasWirelessComp = state.active.some((i) => getCompDef(i.compId)?.onboardWirelessSlot);

  return board.dipSwitches.map((d) => {
    if (d.lockedOn) return { ...d, on: true, reason: t('dip.autoResetLocked') };
    if (d.id === 7 || d.id === 8) {
      if (hasWirelessComp) return { ...d, on: true, reason: t('dip.wirelessActive') };
      if (extClaims[d.pin]) {
        return { ...d, on: false, forcedOff: true, reason: t('dip.external', { comp: extClaims[d.pin].compName }) };
      }
      const wOn = !!state.onboard.onboard_wireless;
      return { ...d, on: wOn, reason: wOn ? t('dip.wirelessEnabled') : t('dip.off') };
    }
    if (extClaims[d.pin]) {
      return { ...d, on: false, forcedOff: true, reason: t('dip.external', { comp: extClaims[d.pin].compName }) };
    }
    const obOn = Boolean(d.onboardId && state.onboard[d.onboardId]);
    return { ...d, on: obOn, reason: obOn ? t('dip.active', { name: tDipName(d) }) : t('dip.off') };
  });
}

export function computeSramBreakdown(): SramBreakdown {
  const board = getActiveBoard();
  const base = board.electrical.sramBaseOverheadBytes;
  const total = board.electrical.sramBytes;
  let used = base;
  const fmtBase = formatRamAmount(base, total).usedStr;
  const breakdown: string[] = [
    t('sram.base', { bytes: total >= 16384 ? fmtBase : `${base} B` }).replace(' B B', ' B')
  ];

  for (const ob of getActiveOnboardDefs()) {
    if (!state.onboard[ob.id]) continue;
    if (ob.id === 'onboard_oled') {
      const b = state.oledPaged ? (ob.sramPaged ?? ob.sram) : ob.sram;
      used += b;
      const modeLbl = state.oledPaged ? t('bottom.oledShortPaged') : t('bottom.oledShortFull');
      breakdown.push(t('sram.oledItem', { mode: modeLbl, bytes: b }));
    } else {
      const b = ob.sram || 0;
      used += b;
      if (b > 0) {
        const bLbl = b >= 4096 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`;
        breakdown.push(`${tOnboard(ob, 'shortName') || ob.name}: ${bLbl}`);
      }
    }
  }

  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def) continue;
    const b = def.sram || 0;
    used += b;
    if (b > 0) breakdown.push(`${getDisplayLabel(def)}: ${b} B`);
  }

  const blkBytes = computeCodeBlocksSramFromList(state.codeBlocks);
  if (blkBytes > 0) {
    used += blkBytes;
    breakdown.push(t('sram.blocksItem', { bytes: blkBytes }));
  }

  if (board.onboardPeripherals.some((o) => o.modeToggle && state.onboard[o.id]) && !state.oledPaged) {
    breakdown.push(t('sram.oledSaveTip'));
  }

  return { used, total, breakdown };
}

export function computeSram(): number {
  return computeSramBreakdown().used;
}

export function computeUsbCurrent(): UsbCurrentEstimate {
  const board = getActiveBoard();
  const base = board.electrical.baseCurrentMa;
  let onboardMa = 0;
  const breakdown: string[] = [t('current.base', { ma: base })];

  for (const ob of getActiveOnboardDefs()) {
    if (!state.onboard[ob.id]) continue;
    const m = ob.currentMa || 0;
    onboardMa += m;
    if (m >= 10) breakdown.push(t('current.onboard', { name: tOnboard(ob, 'shortName') || ob.name, ma: m }));
  }

  let extMa = 0;
  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def) continue;
    const m = def.currentMa || 0;
    extMa += m;
    if (m > 0) breakdown.push(`${getDisplayLabel(def)}: ${m} mA`);
  }

  return { total: base + onboardMa + extMa, base, onboardMa, extMa, breakdown };
}
