// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Declarative Multi-Board Pin Solver, Shared-Power Allocator & I2C Header Mapper
import { state } from '../state';
import { t, tOnboard } from '../../i18n/index';
import { getActiveBoard } from '../../boards';
import type {
  ActiveComponentInstance,
  BoardPowerPinPriority,
  ComponentDef,
  ComponentPinSpec,
  OnboardPinUsageEntry,
  PendingPinEntry,
  PinClaim,
  SuitableBoardPin
} from '../../types';
import { getCompDef, getDisplayLabel, isRequiredPin, isWifiRadioActive, moduleSupports3v3, moduleSupportsDualPower } from './catalog-queries';

type PowerRoleKey = keyof BoardPowerPinPriority;

function isPowerRoleKey(role: string): role is PowerRoleKey {
  return role === 'GND' || role === 'POWER_5V' || role === 'POWER_3V3' || role === 'RESET';
}

export function getExternalPinClaims(
  excludeInstId: string | null = null,
  excludeCompPinId: string | null = null
): Record<string, PinClaim> {
  const board = getActiveBoard();
  const claims: Record<string, PinClaim> = {};
  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def) continue;
    if (def.onboardWirelessSlot && board.capabilities.hasWirelessSlot) {
      claims['D6'] = { instanceId: inst.instanceId, compName: def.name, compPinId: 'TX' };
      claims['D7'] = { instanceId: inst.instanceId, compName: def.name, compPinId: 'RX' };
    }
    for (const [cpId, bpId] of Object.entries(inst.pinMap || {})) {
      if (!bpId) continue;
      if (inst.instanceId === excludeInstId && cpId === excludeCompPinId) continue;
      const bMeta = board.pins[bpId];
      if (bMeta && !bMeta.shared) {
        claims[bpId] = { instanceId: inst.instanceId, compName: def.name, compPinId: cpId };
      }
    }
  }
  return claims;
}

export function getOnboardPinUsage(): Record<string, OnboardPinUsageEntry> {
  const board = getActiveBoard();
  const used: Record<string, OnboardPinUsageEntry> = {};

  for (const ob of (board.onboardPeripherals || [])) {
    if (!state.onboard[ob.id]) continue;
    const baseName = tOnboard(ob, 'name');
    for (const p of (ob.pins || [])) {
      const label = p.roleLabel || (p.roleSuffix ? `${baseName} ${p.roleSuffix}` : baseName);
      used[p.pinId] = {
        onboardId: ob.id,
        name: label,
        dip: p.dip ?? ob.dip ?? null,
        color: ob.accent || '#38bdf8',
        hardwired: Boolean(p.hardwired ?? ob.hardwired)
      };
    }
  }

  if (board.capabilities.hasWirelessSlot) {
    const hasWirelessComp = state.active.some((i) => getCompDef(i.compId)?.onboardWirelessSlot);
    if (state.onboard.onboard_wireless || hasWirelessComp) {
      const wl = t('onboard.wireless');
      used['D6'] = { onboardId: 'onboard_wireless', name: `${wl} RX`, dip: 7, color: '#c084fc', lockedBySlot: hasWirelessComp };
      used['D7'] = { onboardId: 'onboard_wireless', name: `${wl} TX`, dip: 8, color: '#c084fc', lockedBySlot: hasWirelessComp };
    }
  }

  return used;
}

export function getPinUsageCounts(
  excludeInstId: string | null = null,
  excludeCompPinId: string | null = null
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const inst of state.active) {
    for (const [cpId, bpId] of Object.entries(inst.pinMap || {})) {
      if (!bpId) continue;
      if (inst.instanceId === excludeInstId && cpId === excludeCompPinId) continue;
      counts[bpId] = (counts[bpId] || 0) + 1;
    }
  }
  return counts;
}

export function getUsedI2CHeaders(
  excludeInstId: string | null = null,
  extraReservedHeader: string | null = null
): Set<string> {
  const used = new Set<string>();
  for (const inst of state.active) {
    if (inst.instanceId === excludeInstId) continue;
    if (inst.i2cHeader) used.add(inst.i2cHeader);
  }
  if (extraReservedHeader) used.add(extraReservedHeader);
  return used;
}

export function getSharedPinCandidates(
  role: string,
  excludeInstId: string | null = null,
  extraReservedHeader: string | null = null
): string[] {
  const board = getActiveBoard();
  const allPins = board?.pins || {};
  const usedI2c = getUsedI2CHeaders(excludeInstId, extraReservedHeader);
  const out: string[] = [];
  const pushIfValid = (bpId: string): void => {
    const meta = allPins[bpId];
    if (!meta || meta.blocked) return;
    if (!out.includes(bpId)) out.push(bpId);
  };
  const prio: BoardPowerPinPriority = board.powerPinPriority || {
    GND: [],
    POWER_5V: [],
    POWER_3V3: [],
    RESET: []
  };

  const borrowableHeaders = (board.i2cHeaderOrder || []).filter((hk) => board.i2cHeaders[hk]?.supportsBreadboardHub);
  const borrowOrder = borrowableHeaders.length > 1
    ? [...borrowableHeaders.slice(1), borrowableHeaders[0]]
    : borrowableHeaders;

  if (role === 'GND') {
    for (const bpId of (prio.GND || [])) pushIfValid(bpId);
    for (const [bpId, meta] of Object.entries(allPins)) {
      if (meta.blocked || meta.headerId || bpId === 'EXT_GND') continue;
      if ((meta.caps || []).includes('GND')) pushIfValid(bpId);
    }
    for (const hk of borrowOrder) {
      if (!usedI2c.has(hk) && board.i2cHeaders[hk]?.GND) pushIfValid(board.i2cHeaders[hk].GND);
    }
  } else if (role === 'POWER_5V') {
    for (const bpId of (prio.POWER_5V || [])) pushIfValid(bpId);
    for (const [bpId, meta] of Object.entries(allPins)) {
      if (meta.blocked || meta.headerId) continue;
      if ((meta.caps || []).includes('5V')) pushIfValid(bpId);
    }
    for (const hk of borrowOrder) {
      if (!usedI2c.has(hk) && board.i2cHeaders[hk]?.VCC) pushIfValid(board.i2cHeaders[hk].VCC);
    }
  } else if (role === 'POWER_3V3') {
    for (const bpId of (prio.POWER_3V3 || [])) pushIfValid(bpId);
    for (const [bpId, meta] of Object.entries(allPins)) {
      if (meta.blocked) continue;
      if ((meta.caps || []).includes('3V3')) pushIfValid(bpId);
    }
  } else if (role === 'RESET') {
    for (const bpId of (prio.RESET || [])) pushIfValid(bpId);
    for (const [bpId, meta] of Object.entries(allPins)) {
      if (meta.blocked) continue;
      if ((meta.caps || []).includes('RESET')) pushIfValid(bpId);
    }
  }
  return out;
}

export function getPrimarySharedPinForRole(role: string, fallbackPin: string | null = null): string | null {
  const board = getActiveBoard();
  const prioList = isPowerRoleKey(role) ? (board.powerPinPriority?.[role] || []) : [];
  if (prioList.length && board.pins[prioList[0]]) return prioList[0];
  const cands = getSharedPinCandidates(role);
  return cands[0] || fallbackPin;
}

export function pickBestSharedPin(
  role: string,
  fallbackPin: string | null = null,
  pickedThisInst: Set<string> | null = null,
  excludeInstId: string | null = null,
  excludeCompPinId: string | null = null,
  extraReservedHeader: string | null = null
): string | null {
  const board = getActiveBoard();
  const candidates = getSharedPinCandidates(role, excludeInstId, extraReservedHeader);
  if (!candidates.length) return fallbackPin;
  const counts = getPinUsageCounts(excludeInstId, excludeCompPinId);

  if (
    state.powerRailMode === 'rail' &&
    board.breadboard &&
    isPowerRoleKey(role)
  ) {
    const existingRail = candidates.find((bpId) => !board.pins[bpId]?.headerId && (counts[bpId] || 0) >= 1);
    if (existingRail) return existingRail;
    const primaryRail = getPrimarySharedPinForRole(role, fallbackPin);
    return primaryRail && candidates.includes(primaryRail) ? primaryRail : (candidates[0] || fallbackPin);
  }

  for (const bpId of candidates) {
    if ((counts[bpId] || 0) === 0 && (!pickedThisInst || !pickedThisInst.has(bpId))) {
      return bpId;
    }
  }
  const existingRail = candidates.find((bpId) => !board.pins[bpId]?.headerId && (counts[bpId] || 0) >= 2);
  if (existingRail) return existingRail;

  const prioList = isPowerRoleKey(role) ? (board.powerPinPriority?.[role] || []) : [];
  const primary = prioList[0] || fallbackPin;
  return primary && candidates.includes(primary) ? primary : (candidates[0] || fallbackPin);
}

export function relocateBorrowedHeaderPins(
  headerKey: string | null | undefined,
  claimingInstId: string | null = null
): void {
  const board = getActiveBoard();
  const hdr = headerKey ? board.i2cHeaders?.[headerKey] : null;
  if (!hdr || !hdr.supportsBreadboardHub) return;
  const gndPin = hdr.GND;
  const vccPin = hdr.VCC;
  for (const inst of state.active) {
    if (inst.instanceId === claimingInstId || inst.i2cHeader === headerKey) continue;
    const def = getCompDef(inst.compId);
    if (!def) continue;
    for (const p of def.pins) {
      const cur = inst.pinMap[p.id];
      if (cur === gndPin && p.role === 'GND') {
        inst.pinMap[p.id] = pickBestSharedPin('GND', p.defaultPin || 'PWR_GND1', null, inst.instanceId, p.id, headerKey);
      } else if (cur === vccPin && p.role === 'POWER_5V') {
        inst.pinMap[p.id] = pickBestSharedPin('POWER_5V', p.defaultPin || 'PWR_5V', null, inst.instanceId, p.id, headerKey);
      }
    }
  }
}

export function rebalanceOverflowPowerPins(): void {
  if (state.powerRailMode === 'rail') return;
  for (let pass = 0; pass < 24; pass++) {
    const counts = getPinUsageCounts();
    let moved = false;
    for (const inst of state.active) {
      const def = getCompDef(inst.compId);
      if (!def) continue;
      for (const p of def.pins) {
        if (!isRequiredPin(p)) continue;
        if (p.role !== 'GND' && p.role !== 'POWER_5V' && p.role !== 'POWER_3V3') continue;
        if (inst.attachments?.[p.id]?.kind === 'board-breadboard') continue;
        const cur = inst.pinMap[p.id];
        if (!cur || (counts[cur] || 0) < 2) continue;
        const cands = getSharedPinCandidates(p.role, inst.instanceId);
        const freePin = cands.find((bpId) => (counts[bpId] || 0) === 0);
        if (freePin) {
          inst.pinMap[p.id] = freePin;
          moved = true;
          break;
        }
      }
      if (moved) break;
    }
    if (!moved) break;
  }
}

export function getSuitableBoardPins(
  pinSpec: ComponentPinSpec,
  excludeInstId: string | null = null,
  excludeCompPinId: string | null = null,
  compDef: ComponentDef | null = null
): SuitableBoardPin[] {
  const board = getActiveBoard();
  const claims = getExternalPinClaims(excludeInstId, excludeCompPinId);
  const obUsage = getOnboardPinUsage();
  const allPins = board.pins;
  const allowed = [...(pinSpec.allowedTypes || [])];
  if (!allowed.length) {
    if (pinSpec.role === 'I2C_VCC') {
      if (board.electrical.logicVoltage < 5 && (!compDef || moduleSupports3v3(compDef))) allowed.push('3V3');
      allowed.push('5V');
    } else if (pinSpec.role === 'I2C_GND' || pinSpec.role === 'GND') {
      allowed.push('GND');
    } else if (pinSpec.role === 'I2C_SDA') {
      allowed.push('I2C_SDA');
    } else if (pinSpec.role === 'I2C_SCL') {
      allowed.push('I2C_SCL');
    } else if (pinSpec.role === 'POWER_3V3') {
      allowed.push('3V3');
    } else if (pinSpec.role === 'POWER_5V') {
      allowed.push('5V');
    } else if (pinSpec.role === 'RESET') {
      allowed.push('RESET');
    }
  }
  // Dual-voltage (3.3V / 5V) modules can be manually wired to either 3.3V or 5V on ANY board
  if (
    (pinSpec.role === 'POWER_5V' || pinSpec.role === 'POWER_3V3' || pinSpec.role === 'I2C_VCC') &&
    compDef &&
    moduleSupportsDualPower(compDef)
  ) {
    if (!allowed.includes('3V3')) allowed.push('3V3');
    if (!allowed.includes('5V')) allowed.push('5V');
  }

  const results: SuitableBoardPin[] = [];
  const usedI2c = getUsedI2CHeaders(excludeInstId);
  const pinCounts = getPinUsageCounts(excludeInstId, excludeCompPinId);
  const wifiOn = isWifiRadioActive();
  const wantsAnalog = allowed.includes('ANALOG');
  const wantsPureI2c = allowed.includes('I2C_SDA') || allowed.includes('I2C_SCL');

  for (const [bpId, meta] of Object.entries(allPins)) {
    if (meta.blocked) continue;
    const caps = meta.caps || [];
    let matches = allowed.some((cap) => caps.includes(cap));
    if (!matches && meta.headerId && (meta.headerRole === 'GND' || meta.headerRole === 'VCC')) {
      if (!usedI2c.has(meta.headerId)) {
        if (meta.headerRole === 'GND' && allowed.includes('GND')) matches = true;
        if (meta.headerRole === 'VCC' && allowed.includes('5V')) matches = true;
      }
    }
    if (!matches) continue;
    const ob = !meta.shared ? (obUsage[bpId] || null) : null;
    results.push({
      id: bpId,
      label: meta.label,
      takenBy: claims[bpId] || null,
      onboardBy: ob,
      dip: meta.dip || null,
      shared: !!meta.shared,
      usageCount: pinCounts[bpId] || 0,
      strapping: !!meta.strapping,
      adcChannel: meta.adcChannel || null,
      isDefaultI2c: !wantsPureI2c && meta.group === 'i2c'
    });
  }

  // On ATmega328P, auto-deprioritize Timer1 (~D9/~D10) or Timer2 (~D3/~D11) PWM pins when that timer is busy
  const avrAvoidPwmPins = new Set<string>();
  if (board.mcu === 'atmega328p' && pinSpec.role === 'PWM') {
    const isServoOrIrTx = Boolean(compDef && (compDef.id === 'sg90-180' || compDef.id === 'sg90-360' || compDef.id === 'hcsr04-sg90' || compDef.id === 'ir-tx'));
    if (!isServoOrIrTx) {
      const hasTimer1Owner = state.active.some((i) =>
        i.instanceId !== excludeInstId &&
        (i.compId === 'sg90-180' || i.compId === 'sg90-360' || i.compId === 'hcsr04-sg90' || i.compId === 'rf433-tx' || i.compId === 'rf433-rx')
      );
      if (hasTimer1Owner) {
        avrAvoidPwmPins.add('D9');
        avrAvoidPwmPins.add('D10');
      }
      if (state.onboard.onboard_buzzer) {
        avrAvoidPwmPins.add('D3');
        avrAvoidPwmPins.add('D11');
      }
    }
  }

  const pref = pinSpec.preferred || [];
  results.sort((a, b) => {
    const aFree = !a.takenBy && !a.onboardBy;
    const bFree = !b.takenBy && !b.onboardBy;
    if (aFree !== bFree) return aFree ? -1 : 1;
    if (!!a.takenBy !== !!b.takenBy) return a.takenBy ? 1 : -1;

    if (avrAvoidPwmPins.size > 0) {
      const aBusyTimer = avrAvoidPwmPins.has(a.id);
      const bBusyTimer = avrAvoidPwmPins.has(b.id);
      if (aBusyTimer !== bBusyTimer) return aBusyTimer ? 1 : -1;
    }

    if (board.capabilities.hasPinMux) {
      if (Boolean(a.isDefaultI2c) !== Boolean(b.isDefaultI2c)) return a.isDefaultI2c ? 1 : -1;
      if (Boolean(a.strapping) !== Boolean(b.strapping)) return a.strapping ? 1 : -1;
      if (wantsAnalog) {
        const aScore = a.adcChannel === 'ADC1' ? 0 : (a.adcChannel === 'ADC2' ? (wifiOn ? 3 : 1) : 2);
        const bScore = b.adcChannel === 'ADC1' ? 0 : (b.adcChannel === 'ADC2' ? (wifiOn ? 3 : 1) : 2);
        if (aScore !== bScore) return aScore - bScore;
      }
    }

    if (a.shared && b.shared && (a.usageCount === 0) !== (b.usageCount === 0)) {
      return a.usageCount === 0 ? -1 : 1;
    }

    const pa = pref.indexOf(a.id);
    const pb = pref.indexOf(b.id);
    if (pa !== -1 && pb !== -1) return pa - pb;
    if (pa !== -1) return -1;
    if (pb !== -1) return 1;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
  return results;
}

export function pickDefaultI2CHeader(): string | null {
  const board = getActiveBoard();
  const order = board.i2cHeaderOrder || Object.keys(board.i2cHeaders || {});
  if (!order.length) return null;
  if (order.length === 1) return order[0];

  const used = getUsedI2CHeaders();
  const counts = getPinUsageCounts();
  for (const h of order) {
    if (!used.has(h) && !counts[`${h}_VCC`] && !counts[`${h}_GND`]) return h;
  }
  for (const h of order) {
    if (!used.has(h)) return h;
  }
  return order[order.length - 1];
}

export function applyI2CHeaderMapping(
  inst: ActiveComponentInstance,
  def: ComponentDef,
  headerKey: string
): void {
  const board = getActiveBoard();
  relocateBorrowedHeaderPins(headerKey, inst.instanceId);
  inst.i2cHeader = headerKey;
  const hdr = board.i2cHeaders?.[headerKey];
  if (!hdr) return;

  const is3v3Board = board.electrical.logicVoltage < 5;
  for (const p of def.pins) {
    if (p.role === 'I2C_VCC') {
      if (is3v3Board) {
        const powerRole = moduleSupports3v3(def) ? 'POWER_3V3' : 'POWER_5V';
        inst.pinMap[p.id] = pickBestSharedPin(powerRole, hdr.VCC, null, inst.instanceId, p.id);
      } else {
        inst.pinMap[p.id] = hdr.VCC;
      }
    }
    if (p.role === 'I2C_GND') {
      inst.pinMap[p.id] = is3v3Board ? pickBestSharedPin('GND', hdr.GND, null, inst.instanceId, p.id) : hdr.GND;
    }
    if (p.role === 'I2C_SCL') inst.pinMap[p.id] = hdr.SCL;
    if (p.role === 'I2C_SDA') inst.pinMap[p.id] = hdr.SDA;
  }
}

export function getPendingPins(): PendingPinEntry[] {
  const pending: PendingPinEntry[] = [];
  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def) continue;
    for (const p of def.pins) {
      if (!p.selectable || !isRequiredPin(p)) continue;
      if (inst.pinMap[p.id]) continue;
      const cands = getSuitableBoardPins(p, inst.instanceId, p.id);
      const eligibleOnboard = cands.filter(
        (c) => !c.takenBy && c.onboardBy && !c.onboardBy.lockedBySlot && !c.onboardBy.hardwired
      );
      pending.push({ inst, def, pinSpec: p, eligibleOnboard });
    }
  }
  return pending;
}

export function autoConnectPendingPins(): string[] {
  const connected: string[] = [];
  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def) continue;
    for (const p of def.pins) {
      if (!p.selectable || !isRequiredPin(p) || inst.pinMap[p.id]) continue;
      const cands = getSuitableBoardPins(p, inst.instanceId, p.id);
      const freePin = cands.find((c) => !c.takenBy && !c.onboardBy);
      if (freePin) {
        inst.pinMap[p.id] = freePin.id;
        connected.push(`${getDisplayLabel(def)} (${p.id}) → ${freePin.id}`);
      }
    }
  }
  return connected;
}
