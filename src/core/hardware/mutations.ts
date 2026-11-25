// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Workbench Hardware Mutations (Add/Remove/Rewire Modules, Optional Pins, I2C Address & Dual Power Rails)
import { state, isMobileViewport, loadComponentSvg, getActiveOnboardDefs } from '../state';
import { t, tComp, tOnboard, tDipName } from '../../i18n/index';
import { getActiveBoard } from '../../boards';
import { appBus, type ToastOptions } from '../../store/bus';
import type { ActiveComponentInstance, ComponentPinSpec, PowerRailChoice } from '../../types';
import {
  canAddComponent,
  getCompDef,
  getDisplayLabel,
  getInstanceAddress,
  getPrimaryPowerPin,
  isOptionalPin,
  isRequiredPin,
  moduleSupports3v3,
  moduleSupportsDualPower
} from './catalog-queries';
import {
  applyI2CHeaderMapping,
  autoConnectPendingPins,
  getExternalPinClaims,
  getPrimarySharedPinForRole,
  getSuitableBoardPins,
  pickBestSharedPin,
  pickDefaultI2CHeader,
  rebalanceOverflowPowerPins
} from './pin-allocator';

export interface AddComponentOptions {
  skipUndo?: boolean;
  i2cHeader?: string | null;
  i2cAddrOverride?: string | null;
  pinOverrides?: Record<string, string>;
}

export interface PowerRailModeOptions {
  skipUndo?: boolean;
  silent?: boolean;
}

function notifyToast(msg: string, opts: ToastOptions | null = null): void {
  appBus.emit('ui:toast', { msg, opts });
}

export function setPowerRailMode(mode: 'smart' | 'rail', opts: PowerRailModeOptions = {}): void {
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
        if (!isRequiredPin(p)) continue;
        if (p.role !== 'GND' && p.role !== 'POWER_5V' && p.role !== 'POWER_3V3' && p.role !== 'RESET') continue;
        if (nextMode === 'rail') {
          const primaryPin = getPrimarySharedPinForRole(p.role, p.defaultPin || null);
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

function applyI2cConfigPinForAddress(inst: ActiveComponentInstance, addr: string): void {
  const def = getCompDef(inst.compId);
  if (!def || !def.i2cAddrOptions?.length) return;
  const opt = def.i2cAddrOptions.find((o) => o.addr.toLowerCase() === addr.toLowerCase());
  if (!opt || !opt.configPin) return;
  const cfgPinId = opt.configPin;

  if (!opt.tieTo || opt.tieTo === 'NONE') {
    delete inst.pinMap[cfgPinId];
    if (inst.attachments) delete inst.attachments[cfgPinId];
    return;
  }

  const board = getActiveBoard();
  let targetRole: 'GND' | 'POWER_3V3' | 'POWER_5V' = 'GND';
  if (opt.tieTo === 'VCC') {
    targetRole = board.electrical.logicVoltage < 5 ? 'POWER_3V3' : 'POWER_5V';
  }
  const best = pickBestSharedPin(targetRole, null, null, inst.instanceId, cfgPinId);
  if (best) {
    inst.pinMap[cfgPinId] = best;
    if (inst.attachments) delete inst.attachments[cfgPinId];
  }
}

export async function addComponent(compId: string, opts: AddComponentOptions = {}): Promise<void> {
  const board = getActiveBoard();
  const def = getCompDef(compId);
  if (!def) return;
  if (!canAddComponent(compId)) {
    const existing = state.active.find((a) => a.compId === compId);
    if (existing) {
      state.focusedId = existing.instanceId;
      appBus.emit('workspace:recompute');
    }
    const max = def.maxPerDesign ?? 1;
    notifyToast(t('toast.maxComp', {
      max,
      name: getDisplayLabel(def),
      reason: tComp(def, 'maxReason') || t('toast.hardwareLimit')
    }));
    return;
  }
  if (def.onboardWirelessSlot && !board.capabilities.hasWirelessSlot) {
    notifyToast(t('toast.slotUnsupported', { name: getDisplayLabel(def), board: board.shortName }));
    return;
  }

  if (!opts.skipUndo) appBus.emit('history:push');
  await loadComponentSvg(def.svgFile);
  const inst: ActiveComponentInstance = {
    instanceId: 'inst_' + state.nextInst++,
    compId,
    i2cHeader: null,
    i2cAddrOverride: opts.i2cAddrOverride || null,
    pinMap: {},
    attachments: {},
    customPos: null,
    rotation: 0
  };

  if (def.i2cHeaderSelectable) {
    const chosenHdr = (opts.i2cHeader && board.i2cHeaders?.[opts.i2cHeader])
      ? opts.i2cHeader
      : pickDefaultI2CHeader();
    if (chosenHdr) applyI2CHeaderMapping(inst, def, chosenHdr);
  }

  // If adding a 2nd configurable I2C module and default address is already used, auto-select free alt address!
  if (!inst.i2cAddrOverride && def.i2cAddrOptions && def.i2cAddrOptions.length > 1) {
    const usedAddrs = new Set(
      state.active.map((a) => getInstanceAddress(a)).filter((x): x is string => Boolean(x))
    );
    if (def.i2cAddr && usedAddrs.has(def.i2cAddr)) {
      const freeOpt = def.i2cAddrOptions.find((o) => !usedAddrs.has(o.addr));
      if (freeOpt) {
        inst.i2cAddrOverride = freeOpt.addr;
      }
    }
  }

  const unassignedPins: ComponentPinSpec[] = [];
  const pickedThisInst = new Set<string>();
  const is3v3Board = board.electrical.logicVoltage < 5;

  for (const p of def.pins) {
    if (inst.pinMap[p.id]) continue;
    // Respect explicit pin overrides even for optional/config pins (e.g. presets)
    if (opts.pinOverrides && opts.pinOverrides[p.id] && board.pins[opts.pinOverrides[p.id]]) {
      inst.pinMap[p.id] = opts.pinOverrides[p.id];
      pickedThisInst.add(opts.pinOverrides[p.id]);
      continue;
    }
    // Optional & config pins stay un-wired by default for clean, clutter-free boards!
    if (isOptionalPin(p)) continue;

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
        const best = pickBestSharedPin(targetRole, p.defaultPin || null, pickedThisInst, inst.instanceId, p.id);
        inst.pinMap[p.id] = best;
        if (state.powerRailMode === 'rail' && board.breadboard && inst.attachments) {
          inst.attachments[p.id] = { kind: 'board-breadboard', forceRail: true };
        }
        if (best) pickedThisInst.add(best);
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

  // Wire config pin if an alternate I2C address was auto-selected
  if (inst.i2cAddrOverride && def.i2cAddrOptions?.length) {
    applyI2cConfigPinForAddress(inst, inst.i2cAddrOverride);
  }

  state.active.push(inst);
  state.focusedId = inst.instanceId;
  const i2cHeaderCount = inst.i2cHeader ? state.active.filter((a) => a.i2cHeader === inst.i2cHeader).length : 0;
  if (unassignedPins.length) {
    const needLbl = unassignedPins.map((p) => `${p.id} (${(p.allowedTypes || ['IO']).join('/')})`).join(', ');
    notifyToast(t('toast.actionNeededAdd', { name: getDisplayLabel(def), pins: needLbl }));
    if (isMobileViewport() && state.mobileView !== 'board') state.needsMobileFit = true;
  } else if (board.capabilities.hasBreadboard && i2cHeaderCount >= 2 && !opts.skipUndo) {
    notifyToast(t('toast.i2cExpanded', { header: inst.i2cHeader }));
    if (isMobileViewport() && state.mobileView !== 'board') state.needsMobileFit = true;
  } else if (isMobileViewport() && state.mobileView !== 'board') {
    state.needsMobileFit = true;
    notifyToast(t('toast.addedMobile', { name: getDisplayLabel(def) }));
  }
  appBus.emit('workspace:recompute');
  if (!opts.skipUndo) {
    appBus.emit('target:flash', { instanceId: inst.instanceId, panIfOffscreen: true });
  }
}

export function activateOptionalPin(
  instanceId: string,
  compPinId: string,
  targetBoardPinId: string | null = null
): boolean {
  const board = getActiveBoard();
  const inst = state.active.find((i) => i.instanceId === instanceId);
  const def = inst ? getCompDef(inst.compId) : null;
  if (!inst || !def) return false;
  const pSpec = def.pins.find((p) => p.id === compPinId);
  if (!pSpec || !isOptionalPin(pSpec)) return false;

  let chosenPin = targetBoardPinId && board.pins[targetBoardPinId] ? targetBoardPinId : null;
  if (!chosenPin) {
    const cands = getSuitableBoardPins(pSpec, inst.instanceId, pSpec.id, def);
    const freePin = cands.find((c) => !c.takenBy && !c.onboardBy);
    chosenPin = freePin ? freePin.id : null;
  }

  if (!chosenPin) {
    notifyToast(t('toast.optPinNoFree', { comp: getDisplayLabel(def), pin: compPinId }));
    return false;
  }

  appBus.emit('history:push');
  inst.pinMap[compPinId] = chosenPin;
  if (inst.attachments?.[compPinId]) delete inst.attachments[compPinId];
  notifyToast(t('toast.optPinActivated', {
    comp: getDisplayLabel(def),
    pin: compPinId,
    dest: board.pins[chosenPin]?.label || chosenPin
  }));
  appBus.emit('workspace:recompute');
  appBus.emit('target:flash', { instanceId, pinId: chosenPin, panIfOffscreen: true });
  return true;
}

export function deactivateOptionalPin(instanceId: string, compPinId: string): boolean {
  const inst = state.active.find((i) => i.instanceId === instanceId);
  const def = inst ? getCompDef(inst.compId) : null;
  if (!inst || !def) return false;
  const pSpec = def.pins.find((p) => p.id === compPinId);
  if (!pSpec || !isOptionalPin(pSpec) || !inst.pinMap[compPinId]) return false;

  appBus.emit('history:push');
  delete inst.pinMap[compPinId];
  if (inst.attachments?.[compPinId]) delete inst.attachments[compPinId];
  autoConnectPendingPins();
  notifyToast(t('toast.optPinDeactivated', { comp: getDisplayLabel(def), pin: compPinId }));
  appBus.emit('workspace:recompute');
  return true;
}

export function setInstancePowerRail(instanceId: string, rail: PowerRailChoice): boolean {
  const board = getActiveBoard();
  const inst = state.active.find((i) => i.instanceId === instanceId);
  const def = inst ? getCompDef(inst.compId) : null;
  if (!inst || !def || !moduleSupportsDualPower(def)) return false;

  const pwrPin = getPrimaryPowerPin(def);
  if (!pwrPin) return false;

  let targetPin: string | null = null;
  if (rail === '3V3') {
    targetPin = pickBestSharedPin('POWER_3V3', null, null, inst.instanceId, pwrPin.id);
  } else {
    // On K-Comp V2 I2C modules, prefer restoring the assigned I2C header's 5V VCC pin cleanly
    if (pwrPin.role === 'I2C_VCC' && inst.i2cHeader && board.i2cHeaders[inst.i2cHeader]?.VCC) {
      const hdrVcc = board.i2cHeaders[inst.i2cHeader].VCC;
      if (board.pins[hdrVcc]?.caps?.includes('5V')) {
        targetPin = hdrVcc;
      }
    }
    if (!targetPin) {
      targetPin = pickBestSharedPin('POWER_5V', null, null, inst.instanceId, pwrPin.id);
    }
  }
  if (!targetPin) return false;

  appBus.emit('history:push');
  inst.pinMap[pwrPin.id] = targetPin;
  if (inst.attachments?.[pwrPin.id]) {
    delete inst.attachments[pwrPin.id];
  }
  notifyToast(t('toast.powerRailSwitched', {
    comp: getDisplayLabel(def),
    rail: rail === '3V3' ? '3.3V' : '5V'
  }));
  appBus.emit('workspace:recompute');
  appBus.emit('target:flash', { instanceId, pinId: targetPin, panIfOffscreen: true });
  return true;
}

export function setInstanceI2CAddress(instanceId: string, addr: string): boolean {
  const inst = state.active.find((i) => i.instanceId === instanceId);
  const def = inst ? getCompDef(inst.compId) : null;
  if (!inst || !def || !def.i2cAddrOptions?.length) return false;

  const opt = def.i2cAddrOptions.find((o) => o.addr.toLowerCase() === addr.toLowerCase());
  if (!opt) return false;

  appBus.emit('history:push');
  inst.i2cAddrOverride = opt.addr === def.i2cAddr ? null : opt.addr;
  applyI2cConfigPinForAddress(inst, opt.addr);
  notifyToast(t('toast.i2cAddrChanged', { comp: getDisplayLabel(def), addr: opt.addr }));
  appBus.emit('workspace:recompute');
  return true;
}

export function removeComponent(instanceId: string): void {
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
  notifyToast(msg, { actionLabel: t('toast.undoBtn'), onAction: () => appBus.emit('history:undo') });
  appBus.emit('workspace:recompute');
}

export function reassignComponentPin(instanceId: string, compPinId: string, newPinId: string): boolean {
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
  notifyToast(t('toast.rewired', {
    comp: getDisplayLabel(def),
    pin: compPinId,
    dest: board.pins[newPinId].label || newPinId
  }));
  appBus.emit('workspace:recompute');
  appBus.emit('target:flash', { instanceId, pinId: newPinId, panIfOffscreen: true });
  return true;
}

export function toggleDipSwitch(dipNum: number): void {
  const board = getActiveBoard();
  const dip = (board.dipSwitches || []).find((d) => d.id === dipNum);
  if (!dip) return;
  if (dip.lockedOn) {
    notifyToast(t('toast.dipAutoResetLocked'));
    return;
  }

  const extClaims = getExternalPinClaims();
  if (dip.id === 7 || dip.id === 8) {
    const hasWirelessComp = state.active.some((i) => getCompDef(i.compId)?.onboardWirelessSlot);
    if (hasWirelessComp) {
      notifyToast(t('toast.dipWirelessLocked'));
      return;
    }
    if (extClaims['D6'] || extClaims['D7']) {
      const who = (extClaims['D6'] || extClaims['D7']).compName;
      notifyToast(t('toast.dipWirelessExternal', { who }));
      return;
    }
    appBus.emit('history:push');
    state.onboard.onboard_wireless = !state.onboard.onboard_wireless;
    const autoConn = !state.onboard.onboard_wireless ? autoConnectPendingPins() : [];
    if (autoConn.length) notifyToast(t('toast.autoConnected', { list: autoConn.join(', ') }));
    appBus.emit('workspace:recompute');
    return;
  }

  if (extClaims[dip.pin]) {
    notifyToast(t('toast.dipPinExternal', { pin: dip.pin, who: extClaims[dip.pin].compName, name: tDipName(dip) }));
    return;
  }
  if (dip.onboardId && state.onboard[dip.onboardId] !== undefined) {
    appBus.emit('history:push');
    state.onboard[dip.onboardId] = !state.onboard[dip.onboardId];
    const autoConn = !state.onboard[dip.onboardId] ? autoConnectPendingPins() : [];
    if (autoConn.length) notifyToast(t('toast.autoConnected', { list: autoConn.join(', ') }));
    appBus.emit('workspace:recompute');
  }
}

export function toggleOnboardComponent(obId: string): void {
  const board = getActiveBoard();
  if (obId === 'onboard_wireless' && board.capabilities.hasDipSwitches) {
    toggleDipSwitch(7);
    return;
  }
  const ob = getActiveOnboardDefs().find((o) => o.id === obId);
  if (!ob) return;
  if (ob.dip && board.capabilities.hasDipSwitches) {
    toggleDipSwitch(ob.dip);
    return;
  }

  if (!state.onboard[obId] && Array.isArray(ob.pins)) {
    const extClaims = getExternalPinClaims();
    for (const p of ob.pins) {
      if (extClaims[p.pinId]) {
        notifyToast(t('toast.dipPinExternal', { pin: p.pinId, who: extClaims[p.pinId].compName, name: tOnboard(ob, 'name') }));
        return;
      }
    }
  }

  appBus.emit('history:push');
  state.onboard[obId] = !state.onboard[obId];
  const autoConn = !state.onboard[obId] ? autoConnectPendingPins() : [];
  if (autoConn.length) notifyToast(t('toast.autoConnected', { list: autoConn.join(', ') }));
  appBus.emit('workspace:recompute');
}
