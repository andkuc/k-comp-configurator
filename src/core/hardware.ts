// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Declarative Multi-Board Hardware Constraint Engine (K-Comp V2 & ESP32-S3)
import { state, showToast, isMobileViewport, loadComponentSvg, getActiveOnboardDefs, formatRamAmount } from './state';
import { computeCodeBlocksSram } from './code-blocks';
import { t, tComp, tOnboard, tDipName } from '../i18n/index';
import { getActiveBoard } from '../boards';
import type { DipSwitchState, UartAssignment } from '../types';
import { appBus } from '../store/bus';

export function getCompDef(compId) {
  return state.catalog.components.find((c) => c.id === compId);
}

export function countActiveByCompId(compId) {
  return state.active.filter((a) => a.compId === compId).length;
}

export function getDisplayLabel(def) {
  return tComp(def, 'friendlyName') || def.friendlyName || def.name;
}

export function canAddComponent(compId) {
  const def = getCompDef(compId);
  if (!def) return false;
  const max = def.maxPerDesign ?? 1;
  return countActiveByCompId(compId) < max;
}

export function getInstanceAddress(inst) {
  const def = getCompDef(inst.compId);
  if (!def || !def.i2cAddr) return null;
  if (inst.compId === 'tb6612fng') {
    const shields = state.active.filter((a) => a.compId === 'tb6612fng');
    return shields.findIndex((a) => a.instanceId === inst.instanceId) === 1 ? (def.secondI2cAddr || '0x2F') : def.i2cAddr;
  }
  return def.i2cAddr;
}


const HIGH_BAUD_UART_IDS = new Set(['ld2410c', 'ld2450', 'as608']);

export function getUartDefaultBaud(compId: string): number {
  if (compId === 'ld2410c' || compId === 'ld2450') return 256000;
  if (compId === 'as608') return 57600;
  return 9600;
}

/**
 * Assigns each active UART module deterministically to a Hardware UART (HW-UART1 / HW-UART2 on ESP32-S3)
 * or Software UART (SW-UART fallback on 3rd+ ESP32-S3 UART or all external K-Comp V2 UARTs).
 * High-baud modules (LD2410C, LD2450, AS608) receive priority for hardware UART controllers.
 */
export function computeUartAssignments(): Record<string, UartAssignment> {
  const board = getActiveBoard();
  const freeHwUarts = Math.max(0, (board.capabilities.hardwareUartCount || 1) - 1);
  const uartInsts = state.active.filter((i) => {
    const d = getCompDef(i.compId);
    return d && (d.interface === 'UART' || d.onboardWirelessSlot);
  });
  if (!uartInsts.length) return {};

  // Prioritize high-baud modules for hardware UARTs while keeping stable order within each priority tier
  const ordered = [...uartInsts].sort((a, b) => {
    const ah = HIGH_BAUD_UART_IDS.has(a.compId) ? 0 : 1;
    const bh = HIGH_BAUD_UART_IDS.has(b.compId) ? 0 : 1;
    return ah - bh;
  });

  const out: Record<string, UartAssignment> = {};
  let hwNext = 1;
  let swNext = 1;

  for (const inst of ordered) {
    const highBaud = HIGH_BAUD_UART_IDS.has(inst.compId);
    const baud = getUartDefaultBaud(inst.compId);
    if (hwNext <= freeHwUarts) {
      const ch = hwNext++;
      out[inst.instanceId] = {
        kind: 'hw',
        channel: ch,
        shortTag: `HW-U${ch}`,
        badgeLabel: `HW-UART${ch}`,
        serialObj: `Serial${ch}`,
        highBaud,
        baud
      };
    } else {
      const ch = swNext++;
      out[inst.instanceId] = {
        kind: 'sw',
        channel: ch,
        shortTag: 'SW',
        badgeLabel: 'SW-UART',
        serialObj: swNext === 2 ? 'swSerial' : `swSerial${ch}`,
        highBaud,
        baud
      };
    }
  }
  return out;
}

export function isWifiRadioActive(): boolean {
  const board = getActiveBoard();
  if (!board.capabilities.hasWifi) return false;
  return !!state.onboard.onboard_wifi;
}

export function moduleSupports3v3(def: any): boolean {
  if (!def) return false;
  const v = String(def.voltage || '');
  return /3\.3V/i.test(v) || def.id === 'dc-motor';
}

export function moduleRequires5vLogicWarning(def: any): boolean {
  const board = getActiveBoard();
  if (!def || board.electrical.logicVoltage >= 5) return false;
  if (def.id === 'dc-motor' || def.onboardWirelessSlot) return false;
  return !moduleSupports3v3(def);
}

export function getExternalPinClaims(excludeInstId: any = null, excludeCompPinId: any = null) {
  const board = getActiveBoard();
  const claims = {};
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
      const bMeta = board.pins[bpId as string];
      if (bMeta && !bMeta.shared) {
        claims[bpId as string] = { instanceId: inst.instanceId, compName: def.name, compPinId: cpId };
      }
    }
  }
  return claims;
}

export function getOnboardPinUsage() {
  const board = getActiveBoard();
  const used = {};

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

export function getPinUsageCounts(excludeInstId: any = null, excludeCompPinId: any = null) {
  const counts = {};
  for (const inst of state.active) {
    for (const [cpId, bpId] of Object.entries(inst.pinMap || {})) {
      if (!bpId) continue;
      if (inst.instanceId === excludeInstId && cpId === excludeCompPinId) continue;
      counts[bpId as string] = (counts[bpId as string] || 0) + 1;
    }
  }
  return counts;
}

export function getUsedI2CHeaders(excludeInstId: any = null, extraReservedHeader: any = null) {
  const used = new Set();
  for (const inst of state.active) {
    if (inst.instanceId === excludeInstId) continue;
    if (inst.i2cHeader) used.add(inst.i2cHeader);
  }
  if (extraReservedHeader) used.add(extraReservedHeader);
  return used;
}

export function getSharedPinCandidates(role: string, excludeInstId: any = null, extraReservedHeader: any = null) {
  const board = getActiveBoard();
  const allPins = board?.pins || {};
  const usedI2c = getUsedI2CHeaders(excludeInstId, extraReservedHeader);
  const out = [];
  const pushIfValid = (bpId) => {
    const meta = allPins[bpId];
    if (!meta || meta.blocked) return;
    if (!out.includes(bpId)) out.push(bpId);
  };
  const prio = board.powerPinPriority || { GND: [], POWER_5V: [], POWER_3V3: [], RESET: [] };

  const borrowableHeaders = (board.i2cHeaderOrder || []).filter((hk) => board.i2cHeaders[hk]?.supportsBreadboardHub);
  // Borrow power pins from secondary I2C headers first (primary header last so I2C modules prefer it cleanly)
  const borrowOrder = borrowableHeaders.length > 1 ? [...borrowableHeaders.slice(1), borrowableHeaders[0]] : borrowableHeaders;

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

export function getPrimarySharedPinForRole(role: string, fallbackPin: any = null) {
  const board = getActiveBoard();
  const prioList = board.powerPinPriority?.[role] || [];
  if (prioList.length && board.pins[prioList[0]]) return prioList[0];
  const cands = getSharedPinCandidates(role);
  return cands[0] || fallbackPin;
}

export function pickBestSharedPin(role: string, fallbackPin: any, pickedThisInst: any = null, excludeInstId: any = null, excludeCompPinId: any = null, extraReservedHeader: any = null) {
  const board = getActiveBoard();
  const candidates = getSharedPinCandidates(role, excludeInstId, extraReservedHeader);
  if (!candidates.length) return fallbackPin;
  const counts = getPinUsageCounts(excludeInstId, excludeCompPinId);

  // When user selects "Breadboard Rail" mode on a board with an onboard breadboard,
  // consolidate shared power/GND pins directly onto the common breadboard rail!
  if (state.powerRailMode === 'rail' && board.breadboard && (role === 'GND' || role === 'POWER_5V' || role === 'POWER_3V3' || role === 'RESET')) {
    const existingRail = candidates.find((bpId) => !board.pins[bpId]?.headerId && (counts[bpId] || 0) >= 1);
    if (existingRail) return existingRail;
    const primaryRail = getPrimarySharedPinForRole(role, fallbackPin);
    return candidates.includes(primaryRail) ? primaryRail : (candidates[0] || fallbackPin);
  }

  for (const bpId of candidates) {
    if ((counts[bpId] || 0) === 0 && (!pickedThisInst || !pickedThisInst.has(bpId))) {
      return bpId;
    }
  }
  const existingRail = candidates.find((bpId) => !board.pins[bpId]?.headerId && (counts[bpId] || 0) >= 2);
  if (existingRail) return existingRail;

  const prioList = board.powerPinPriority?.[role] || [];
  const primary = prioList[0] || fallbackPin;
  return candidates.includes(primary) ? primary : (candidates[0] || fallbackPin);
}

export function setPowerRailMode(mode: 'smart' | 'rail', opts: any = {}) {
  const nextMode: 'smart' | 'rail' = mode === 'rail' ? 'rail' : 'smart';
  if (!opts.skipUndo) appBus.emit('history:push');
  state.powerRailMode = nextMode;
  const board = getActiveBoard();

  if (board.breadboard) {
    for (const inst of state.active) {
      const def = getCompDef(inst.compId);
      if (!def || def.onboardWirelessSlot) continue;
      if (!inst.attachments) inst.attachments = {};
      for (const p of def.pins) {
        if (p.role !== 'GND' && p.role !== 'POWER_5V' && p.role !== 'POWER_3V3' && p.role !== 'RESET') continue;
        if (nextMode === 'rail') {
          const primaryPin = getPrimarySharedPinForRole(p.role, p.defaultPin);
          if (primaryPin) {
            inst.pinMap[p.id] = primaryPin;
            inst.attachments[p.id] = { kind: 'board-breadboard', forceRail: true };
          }
        } else {
          delete inst.attachments[p.id];
        }
      }
    }
    if (nextMode === 'smart') {
      rebalanceOverflowPowerPins();
    }
  }
  if (!opts.silent) {
    appBus.emit('workspace:recompute');
  }
}

export function relocateBorrowedHeaderPins(headerKey: any, claimingInstId: any = null) {
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

export function rebalanceOverflowPowerPins() {
  if (state.powerRailMode === 'rail') return;
  for (let pass = 0; pass < 24; pass++) {
    const counts = getPinUsageCounts();
    let moved = false;
    for (const inst of state.active) {
      const def = getCompDef(inst.compId);
      if (!def) continue;
      for (const p of def.pins) {
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

export function getSuitableBoardPins(pinSpec: any, excludeInstId: any = null, excludeCompPinId: any = null, compDef: any = null) {
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
  // Dual-voltage (3.3V / 5V) modules on a 3.3V board can be wired to 3.3V or 5V
  if (board.electrical.logicVoltage < 5 && (pinSpec.role === 'POWER_5V' || pinSpec.role === 'I2C_VCC') && compDef && moduleSupports3v3(compDef)) {
    if (!allowed.includes('3V3')) allowed.push('3V3');
  }
  const results = [];

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

  const pref = pinSpec.preferred || [];
  results.sort((a, b) => {
    const aFree = !a.takenBy && !a.onboardBy;
    const bFree = !b.takenBy && !b.onboardBy;
    if (aFree !== bFree) return aFree ? -1 : 1;
    if (!!a.takenBy !== !!b.takenBy) return a.takenBy ? 1 : -1;

    if (board.capabilities.hasPinMux) {
      if (a.isDefaultI2c !== b.isDefaultI2c) return a.isDefaultI2c ? 1 : -1;
      if (a.strapping !== b.strapping) return a.strapping ? 1 : -1;
      if (wantsAnalog) {
        const aScore = a.adcChannel === 'ADC1' ? 0 : (a.adcChannel === 'ADC2' ? (wifiOn ? 3 : 1) : 2);
        const bScore = b.adcChannel === 'ADC1' ? 0 : (b.adcChannel === 'ADC2' ? (wifiOn ? 3 : 1) : 2);
        if (aScore !== bScore) return aScore - bScore;
      }
    }

    if (a.shared && b.shared && (a.usageCount === 0) !== (b.usageCount === 0)) {
      return a.usageCount === 0 ? -1 : 1;
    }

    const pa = pref.indexOf(a.id), pb = pref.indexOf(b.id);
    if (pa !== -1 && pb !== -1) return pa - pb;
    if (pa !== -1) return -1;
    if (pb !== -1) return 1;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
  return results;
}

export function pickDefaultI2CHeader() {
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

export function applyI2CHeaderMapping(inst, def, headerKey) {
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

export function getPendingPins() {
  const pending = [];
  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def) continue;
    for (const p of def.pins) {
      if (!p.selectable) continue;
      if (inst.pinMap[p.id]) continue;
      const cands = getSuitableBoardPins(p, inst.instanceId, p.id);
      const eligibleOnboard = cands.filter((c) => !c.takenBy && c.onboardBy && !c.onboardBy.lockedBySlot && !c.onboardBy.hardwired);
      pending.push({ inst, def, pinSpec: p, eligibleOnboard });
    }
  }
  return pending;
}

export function autoConnectPendingPins() {
  const connected = [];
  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def) continue;
    for (const p of def.pins) {
      if (!p.selectable || inst.pinMap[p.id]) continue;
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

export async function addComponent(compId: string, opts: any = {}) {
  const board = getActiveBoard();
  const def = getCompDef(compId);
  if (!def) return;
  if (!canAddComponent(compId)) {
    const existing = state.active.find((a) => a.compId === compId);
    if (existing) { state.focusedId = existing.instanceId; appBus.emit('workspace:recompute'); }
    const max = def.maxPerDesign ?? 1;
    showToast(t('toast.maxComp', { max, name: getDisplayLabel(def), reason: tComp(def, 'maxReason') || t('toast.hardwareLimit') }));
    return;
  }
  if (def.onboardWirelessSlot && !board.capabilities.hasWirelessSlot) {
    showToast(t('toast.slotUnsupported', { name: getDisplayLabel(def), board: board.shortName }));
    return;
  }

  if (!opts.skipUndo) appBus.emit('history:push');
  await loadComponentSvg(def.svgFile);
  const inst = { instanceId: 'inst_' + state.nextInst++, compId, i2cHeader: null, pinMap: {}, attachments: {}, customPos: null, rotation: 0 };

  if (def.i2cHeaderSelectable) {
    const chosenHdr = (opts.i2cHeader && board.i2cHeaders?.[opts.i2cHeader]) ? opts.i2cHeader : pickDefaultI2CHeader();
    if (chosenHdr) applyI2CHeaderMapping(inst, def, chosenHdr);
  }

  const unassignedPins = [];
  const pickedThisInst = new Set();
  const is3v3Board = board.electrical.logicVoltage < 5;

  for (const p of def.pins) {
    if (inst.pinMap[p.id]) continue;
    if (opts.pinOverrides && opts.pinOverrides[p.id] && board.pins[opts.pinOverrides[p.id]]) {
      inst.pinMap[p.id] = opts.pinOverrides[p.id];
      pickedThisInst.add(opts.pinOverrides[p.id]);
      continue;
    }
    if (p.fixedPin && board.pins[p.fixedPin]) {
      inst.pinMap[p.id] = p.fixedPin;
      continue;
    }
    if (p.defaultPin || p.role === 'GND' || p.role === 'POWER_5V' || p.role === 'POWER_3V3' || p.role === 'RESET') {
      let targetRole = p.role;
      if (is3v3Board && p.role === 'POWER_5V' && moduleSupports3v3(def)) {
        targetRole = 'POWER_3V3';
      }
      if (targetRole === 'GND' || targetRole === 'POWER_5V' || targetRole === 'POWER_3V3' || targetRole === 'RESET') {
        const best = pickBestSharedPin(targetRole, p.defaultPin, pickedThisInst, inst.instanceId, p.id);
        inst.pinMap[p.id] = best;
        if (state.powerRailMode === 'rail' && board.breadboard) {
          inst.attachments[p.id] = { kind: 'board-breadboard', forceRail: true };
        }
        pickedThisInst.add(best);
        continue;
      }
      if (p.defaultPin && board.pins[p.defaultPin]) {
        inst.pinMap[p.id] = p.defaultPin;
        continue;
      }
    }
    if (p.selectable) {
      const cands = getSuitableBoardPins(p).filter((c) => c.shared || !pickedThisInst.has(c.id));
      const trulyFree = cands.find((c) => !c.takenBy && !c.onboardBy);
      if (trulyFree) {
        inst.pinMap[p.id] = trulyFree.id;
        if (!trulyFree.shared) pickedThisInst.add(trulyFree.id);
      } else {
        inst.pinMap[p.id] = null;
        unassignedPins.push(p);
      }
    }
  }

  state.active.push(inst);
  state.focusedId = inst.instanceId;
  const i2cHeaderCount = inst.i2cHeader ? state.active.filter((a) => a.i2cHeader === inst.i2cHeader).length : 0;
  if (unassignedPins.length) {
    const needLbl = unassignedPins.map((p) => `${p.id} (${(p.allowedTypes || ['IO']).join('/')})`).join(', ');
    showToast(t('toast.actionNeededAdd', { name: getDisplayLabel(def), pins: needLbl }));
    if (isMobileViewport() && state.mobileView !== 'board') state.needsMobileFit = true;
  } else if (board.capabilities.hasBreadboard && i2cHeaderCount >= 2 && !opts.skipUndo) {
    showToast(t('toast.i2cExpanded', { header: inst.i2cHeader }));
    if (isMobileViewport() && state.mobileView !== 'board') state.needsMobileFit = true;
  } else if (isMobileViewport() && state.mobileView !== 'board') {
    state.needsMobileFit = true;
    showToast(t('toast.addedMobile', { name: getDisplayLabel(def) }));
  }
  appBus.emit('workspace:recompute');
  if (!opts.skipUndo) {
    appBus.emit('target:flash', { instanceId: inst.instanceId, panIfOffscreen: true });
  }
}

export function removeComponent(instanceId) {
  const inst = state.active.find((i) => i.instanceId === instanceId);
  const def = inst ? getCompDef(inst.compId) : null;
  const removedName = def ? getDisplayLabel(def) : '';
  appBus.emit('history:push');
  state.active = state.active.filter((i) => i.instanceId !== instanceId);
  if (state.focusedId === instanceId) state.focusedId = null;
  rebalanceOverflowPowerPins();
  const autoConn = autoConnectPendingPins();
  const msg = autoConn.length
    ? t('toast.autoConnected', { list: autoConn.join(', ') })
    : (removedName ? t('toast.removedComp', { name: removedName }) : t('toast.removedGeneric'));
  showToast(msg, { actionLabel: t('toast.undoBtn'), onAction: () => appBus.emit('history:undo') });
  appBus.emit('workspace:recompute');
}


export function reassignComponentPin(instanceId: string, compPinId: string, newPinId: string) {
  const board = getActiveBoard();
  const inst = state.active.find((i) => i.instanceId === instanceId);
  const def = inst ? getCompDef(inst.compId) : null;
  if (!inst || !def || !board.pins[newPinId]) return false;

  appBus.emit('history:push');
  inst.pinMap[compPinId] = newPinId;
  if (inst.attachments && inst.attachments[compPinId]) {
    delete inst.attachments[compPinId];
  }
  autoConnectPendingPins();
  showToast(t('toast.rewired', {
    comp: getDisplayLabel(def),
    pin: compPinId,
    dest: board.pins[newPinId].label || newPinId
  }));
  appBus.emit('workspace:recompute');
  appBus.emit('target:flash', { instanceId, pinId: newPinId, panIfOffscreen: true });
  return true;
}

export function toggleDipSwitch(dipNum) {
  const board = getActiveBoard();
  const dip = (board.dipSwitches || []).find((d) => d.id === dipNum);
  if (!dip) return;
  if (dip.lockedOn) {
    showToast(t('toast.dipAutoResetLocked'));
    return;
  }

  const extClaims = getExternalPinClaims();
  if (dip.id === 7 || dip.id === 8) {
    const hasWirelessComp = state.active.some((i) => getCompDef(i.compId)?.onboardWirelessSlot);
    if (hasWirelessComp) {
      showToast(t('toast.dipWirelessLocked'));
      return;
    }
    if (extClaims['D6'] || extClaims['D7']) {
      const who = (extClaims['D6'] || extClaims['D7']).compName;
      showToast(t('toast.dipWirelessExternal', { who }));
      return;
    }
    appBus.emit('history:push');
    state.onboard.onboard_wireless = !state.onboard.onboard_wireless;
    const autoConn = !state.onboard.onboard_wireless ? autoConnectPendingPins() : [];
    if (autoConn.length) showToast(t('toast.autoConnected', { list: autoConn.join(', ') }));
    appBus.emit('workspace:recompute');
    return;
  }

  if (extClaims[dip.pin]) {
    showToast(t('toast.dipPinExternal', { pin: dip.pin, who: extClaims[dip.pin].compName, name: tDipName(dip) }));
    return;
  }
  if (dip.onboardId && state.onboard[dip.onboardId] !== undefined) {
    appBus.emit('history:push');
    state.onboard[dip.onboardId] = !state.onboard[dip.onboardId];
    const autoConn = !state.onboard[dip.onboardId] ? autoConnectPendingPins() : [];
    if (autoConn.length) showToast(t('toast.autoConnected', { list: autoConn.join(', ') }));
    appBus.emit('workspace:recompute');
  }
}

export function toggleOnboardComponent(obId) {
  const board = getActiveBoard();
  if (obId === 'onboard_wireless' && board.capabilities.hasDipSwitches) { toggleDipSwitch(7); return; }
  const ob = getActiveOnboardDefs().find((o) => o.id === obId);
  if (!ob) return;
  if (ob.dip && board.capabilities.hasDipSwitches) { toggleDipSwitch(ob.dip); return; }

  if (!state.onboard[obId] && Array.isArray(ob.pins)) {
    const extClaims = getExternalPinClaims();
    for (const p of ob.pins) {
      if (extClaims[p.pinId]) {
        showToast(t('toast.dipPinExternal', { pin: p.pinId, who: extClaims[p.pinId].compName, name: tOnboard(ob, 'name') }));
        return;
      }
    }
  }

  appBus.emit('history:push');
  state.onboard[obId] = !state.onboard[obId];
  const autoConn = !state.onboard[obId] ? autoConnectPendingPins() : [];
  if (autoConn.length) showToast(t('toast.autoConnected', { list: autoConn.join(', ') }));
  appBus.emit('workspace:recompute');
}

export function computeDipStates(): DipSwitchState[] {
  const board = getActiveBoard();
  if (!board.dipSwitches || !board.dipSwitches.length) return [];
  const extClaims = getExternalPinClaims();
  const hasWirelessComp = state.active.some((i) => getCompDef(i.compId)?.onboardWirelessSlot);

  return board.dipSwitches.map((d) => {
    if (d.lockedOn) return { ...d, on: true, reason: t('dip.autoResetLocked') };
    if (d.id === 7 || d.id === 8) {
      if (hasWirelessComp) return { ...d, on: true, reason: t('dip.wirelessActive') };
      if (extClaims[d.pin]) return { ...d, on: false, forcedOff: true, reason: t('dip.external', { comp: extClaims[d.pin].compName }) };
      const wOn = !!state.onboard.onboard_wireless;
      return { ...d, on: wOn, reason: wOn ? t('dip.wirelessEnabled') : t('dip.off') };
    }
    if (extClaims[d.pin]) {
      return { ...d, on: false, forcedOff: true, reason: t('dip.external', { comp: extClaims[d.pin].compName }) };
    }
    const obOn = !!state.onboard[d.onboardId];
    return { ...d, on: obOn, reason: obOn ? t('dip.active', { name: tDipName(d) }) : t('dip.off') };
  });
}

export function computeCriticalWarnings() {
  const board = getActiveBoard();
  const warns = [];
  const extClaims = getExternalPinClaims();

  // 1. I2C Address Collisions
  const addrMap = {};
  const addrInst = {};
  for (const ob of (board.onboardPeripherals || [])) {
    if (ob.i2cAddr && state.onboard[ob.id]) {
      if (!addrMap[ob.i2cAddr]) addrMap[ob.i2cAddr] = [];
      addrMap[ob.i2cAddr].push(ob.shortName || ob.name);
      if (!addrInst[ob.i2cAddr]) addrInst[ob.i2cAddr] = null;
    }
  }
  for (const inst of state.active) {
    const addr = getInstanceAddress(inst);
    if (addr) {
      if (!addrMap[addr]) addrMap[addr] = [];
      addrMap[addr].push(getCompDef(inst.compId).name);
      addrInst[addr] = inst.instanceId;
    }
  }
  for (const [addr, names] of Object.entries(addrMap)) {
    if ((names as string[]).length > 1) {
      warns.push({
        critical: true,
        text: t('warn.i2cCollision', { addr, names: (names as string[]).join(' + ') }),
        target: addrInst[addr] ? { instanceId: addrInst[addr], panIfOffscreen: true } : { onboardId: 'onboard_oled' }
      });
    }
  }

  // 2. Wireless Slot Conflict
  const wirelessInsts = state.active.filter((i) => getCompDef(i.compId)?.onboardWirelessSlot);
  if (wirelessInsts.length > 1) {
    warns.push({
      critical: true,
      text: t('warn.wirelessConflict'),
      target: { instanceId: wirelessInsts[1].instanceId, onboardId: 'onboard_wireless', panIfOffscreen: true }
    });
  }

  // 3. Direct DC Motor without Driver
  const dcMotorInst = state.active.find((i) => i.compId === 'dc-motor');
  if (dcMotorInst && !state.active.some((i) => i.compId === 'tb6612fng')) {
    warns.push({
      critical: true,
      text: t('warn.dcNeedsDriver'),
      target: { instanceId: dcMotorInst.instanceId, panIfOffscreen: true }
    });
  }

  // 4. Declarative Onboard Peripheral Pin Conflict Checks (e.g. K-Comp V2 Ultrasonic D10/D11)
  for (const ob of (board.onboardPeripherals || [])) {
    if (!state.onboard[ob.id] || !ob.conflictPins?.length) continue;
    const hitPin = ob.conflictPins.find((pid) => Boolean(extClaims[pid]));
    if (hitPin) {
      const claim = extClaims[hitPin];
      warns.push({
        critical: true,
        text: t(ob.conflictWarningKey || 'warn.ultrasonicConflict'),
        target: { instanceId: claim.instanceId, pinId: hitPin, onboardId: ob.id, panIfOffscreen: true }
      });
    }
  }

  // 5. UART / SoftwareSerial Check (Board-Aware)
  const uartInsts = state.active.filter((i) => {
    const d = getCompDef(i.compId);
    return d && (d.interface === 'UART' || d.onboardWirelessSlot);
  });
  const freeHwUarts = Math.max(0, (board.capabilities.hardwareUartCount || 1) - 1);
  if (freeHwUarts === 0 && uartInsts.length > 1) {
    const txOnlyIds = new Set(['ch9329']);
    const txInsts = uartInsts.filter((i) => txOnlyIds.has(i.compId));
    const rxInsts = uartInsts.filter((i) => !txOnlyIds.has(i.compId));
    if (txInsts.length > 0 && rxInsts.length <= 1) {
      const names = uartInsts.map((i) => getCompDef(i.compId)?.name || i.compId).join(' + ');
      const txName = getCompDef(txInsts[0].compId)?.name || 'CH9329';
      warns.push({
        critical: false,
        advisory: true,
        text: t('warn.multiUartTxOnly', { count: uartInsts.length, names, txName }),
        target: { instanceId: txInsts[0].instanceId, panIfOffscreen: true }
      });
    } else {
      warns.push({
        critical: true,
        text: t('warn.multiUart', { count: uartInsts.length }),
        target: { instanceId: (rxInsts[1] || uartInsts[1]).instanceId, panIfOffscreen: true }
      });
    }
  } else if (freeHwUarts > 0 && uartInsts.length > freeHwUarts) {
    const assigns = computeUartAssignments();
    const swInsts = uartInsts.filter((i) => assigns[i.instanceId]?.kind === 'sw');
    const highBaudOnSw = swInsts.find((i) => assigns[i.instanceId]?.highBaud);
    if (highBaudOnSw) {
      const defHb = getCompDef(highBaudOnSw.compId);
      warns.push({
        critical: true,
        text: t('warn.swUartHighBaud', {
          name: defHb ? getDisplayLabel(defHb) : highBaudOnSw.compId,
          baud: assigns[highBaudOnSw.instanceId].baud,
          max: freeHwUarts
        }),
        target: { instanceId: highBaudOnSw.instanceId, panIfOffscreen: true }
      });
    } else if (swInsts.length > 0) {
      const swNames = swInsts.map((i) => getDisplayLabel(getCompDef(i.compId))).join(' + ');
      warns.push({
        critical: false,
        advisory: true,
        text: t('warn.espSwUartAdvisory', {
          count: uartInsts.length,
          max: freeHwUarts,
          names: swNames
        }),
        target: { instanceId: swInsts[0].instanceId, panIfOffscreen: true }
      });
    }
  }

  // 6. 3.3V Logic-Level Warning
  if (board.electrical.logicVoltage < 5) {
    for (const inst of state.active) {
      const def = getCompDef(inst.compId);
      if (moduleRequires5vLogicWarning(def)) {
        warns.push({
          critical: true,
          text: t('warn.logicLevel3v3', { name: getDisplayLabel(def), board: board.shortName }),
          target: { instanceId: inst.instanceId, panIfOffscreen: true }
        });
      }
    }
  }

  // 7. Strapping-Pin Advisory (with 1-click Move-to-Safe-GPIO quick action)
  const strappingSet = new Set(board.capabilities.strappingPins || []);
  if (strappingSet.size) {
    for (const inst of state.active) {
      const def = getCompDef(inst.compId);
      if (!def) continue;
      for (const p of def.pins) {
        const bpId = inst.pinMap[p.id];
        if (bpId && strappingSet.has(bpId)) {
          const safeCand = getSuitableBoardPins(p, inst.instanceId, p.id, def)
            .find((c) => !c.takenBy && !c.onboardBy && !c.strapping && !c.isDefaultI2c);
          warns.push({
            critical: false,
            advisory: true,
            text: t('warn.strappingPin', { pin: bpId, name: getDisplayLabel(def) }),
            quickActions: safeCand ? [{
              pinReassign: { instanceId: inst.instanceId, compPinId: p.id, newPinId: safeCand.id },
              label: t('warn.moveToPinBtn', { pin: safeCand.id })
            }] : [],
            target: { instanceId: inst.instanceId, pinId: bpId, panIfOffscreen: true }
          });
        }
      }
    }
  }

  // 8. ADC2 + Wi-Fi Conflict Check (with 1-click Move-to-ADC1 quick action)
  const adc2Set = new Set(board.capabilities.adc2WifiConflictPins || []);
  const adc1Set = new Set(board.capabilities.adc1Pins || []);
  if (adc2Set.size && isWifiRadioActive()) {
    for (const inst of state.active) {
      const def = getCompDef(inst.compId);
      if (!def) continue;
      for (const p of def.pins) {
        const bpId = inst.pinMap[p.id];
        if (bpId && p.role === 'ANALOG' && adc2Set.has(bpId)) {
          const safeAdc1 = getSuitableBoardPins(p, inst.instanceId, p.id, def)
            .find((c) => !c.takenBy && !c.onboardBy && !c.strapping && !c.isDefaultI2c && adc1Set.has(c.id));
          warns.push({
            critical: true,
            text: t('warn.adc2WifiConflict', { pin: bpId, name: getDisplayLabel(def) }),
            quickActions: safeAdc1 ? [{
              pinReassign: { instanceId: inst.instanceId, compPinId: p.id, newPinId: safeAdc1.id },
              label: t('warn.moveToAdc1Btn', { pin: safeAdc1.id })
            }] : [],
            target: { instanceId: inst.instanceId, pinId: bpId, onboardId: 'onboard_wifi', panIfOffscreen: true }
          });
        }
      }
    }
  }

  // 9. Pending / Unassigned Pins
  const pending = getPendingPins();
  for (const pp of pending) {
    const capStr = (pp.pinSpec.allowedTypes || ['IO']).join('/');
    const seenOb = new Set();
    const quickBtns = [];
    for (const c of pp.eligibleOnboard) {
      if (!c.onboardBy || seenOb.has(c.onboardBy.onboardId)) continue;
      seenOb.add(c.onboardBy.onboardId);
      quickBtns.push({
        onboardId: c.onboardBy.onboardId,
        label: `${c.onboardBy.name}${c.onboardBy.dip ? ' (S1-' + c.onboardBy.dip + ')' : ''} → ${c.id}`
      });
    }
    const firstElig = pp.eligibleOnboard[0];
    warns.push({
      critical: true,
      actionNeeded: true,
      text: t('warn.actionNeeded', { name: getDisplayLabel(pp.def), pin: pp.pinSpec.id, caps: capStr }),
      quickActions: quickBtns.slice(0, 4),
      target: {
        instanceId: pp.inst.instanceId,
        pinId: firstElig ? firstElig.id : null,
        dipNum: firstElig && firstElig.onboardBy ? firstElig.onboardBy.dip : null,
        panIfOffscreen: true
      }
    });
  }

  // 10. 5V USB Power Budget Check
  const cur = computeUsbCurrent();
  const maxMa = board.electrical.usbMaxMa;
  if (cur.total >= Math.round(maxMa * 0.9)) {
    let topInst = null;
    let topMa = -1;
    for (const inst of state.active) {
      const m = getCompDef(inst.compId)?.currentMa || 0;
      if (m > topMa) { topMa = m; topInst = inst; }
    }
    warns.push({
      critical: true,
      text: t('warn.usbPower', { total: cur.total, max: maxMa }),
      target: topInst ? { instanceId: topInst.instanceId, panIfOffscreen: true } : null
    });
  }

  return warns;
}

export function computeSramBreakdown() {
  const board = getActiveBoard();
  const base = board.electrical.sramBaseOverheadBytes;
  const total = board.electrical.sramBytes;
  let used = base;
  const fmtBase = formatRamAmount(base, total).usedStr;
  const breakdown = [t('sram.base', { bytes: total >= 16384 ? fmtBase : `${base} B` }).replace(' B B', ' B')];

  for (const ob of getActiveOnboardDefs()) {
    if (!state.onboard[ob.id]) continue;
    if (ob.id === 'onboard_oled') {
      const b = state.oledPaged ? ob.sramPaged : ob.sram;
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
  const blkBytes = computeCodeBlocksSram();
  if (blkBytes > 0) {
    used += blkBytes;
    breakdown.push(t('sram.blocksItem', { bytes: blkBytes }));
  }
  if (board.onboardPeripherals.some((o) => o.modeToggle && state.onboard[o.id]) && !state.oledPaged) {
    breakdown.push(t('sram.oledSaveTip'));
  }
  return { used, total, breakdown };
}

export function computeSram() {
  return computeSramBreakdown().used;
}

export function computeUsbCurrent() {
  const board = getActiveBoard();
  const base = board.electrical.baseCurrentMa;
  let onboardMa = 0;
  const breakdown = [t('current.base', { ma: base })];
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
