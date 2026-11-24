// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// K-Comp V2 Hardware Constraint Engine (Pin Allocation, DIP S1, SRAM & 5V Current)
import { state, hooks, showToast, isMobileViewport, loadComponentSvg } from './state.js?v=0.1.0';
import { computeCodeBlocksSram } from './code-blocks.js?v=0.1.0';
import { t, tComp, tOnboard, tDipName } from '../i18n/index.js?v=0.1.0';

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
  if (!def.i2cAddr) return null;
  if (inst.compId === 'tb6612fng') {
    const shields = state.active.filter((a) => a.compId === 'tb6612fng');
    return shields.findIndex((a) => a.instanceId === inst.instanceId) === 1 ? (def.secondI2cAddr || '0x2F') : def.i2cAddr;
  }
  return def.i2cAddr;
}

export function getExternalPinClaims(excludeInstId = null, excludeCompPinId = null) {
  const claims = {};
  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (def.onboardWirelessSlot) {
      claims['D6'] = { instanceId: inst.instanceId, compName: def.name, compPinId: 'TX' };
      claims['D7'] = { instanceId: inst.instanceId, compName: def.name, compPinId: 'RX' };
    }
    for (const [cpId, bpId] of Object.entries(inst.pinMap)) {
      if (inst.instanceId === excludeInstId && cpId === excludeCompPinId) continue;
      const bMeta = window.KCOMP_BOARD.pins[bpId];
      if (bMeta && !bMeta.shared) {
        claims[bpId] = { instanceId: inst.instanceId, compName: def.name, compPinId: cpId };
      }
    }
  }
  return claims;
}

export function getOnboardPinUsage() {
  const used = {};
  const hasWirelessComp = state.active.some((i) => getCompDef(i.compId).onboardWirelessSlot);
  const obById = {};
  for (const ob of (state.catalog?.onboard || [])) obById[ob.id] = ob;
  const obName = (id, fallback) => (obById[id] ? tOnboard(obById[id], 'name') : fallback);

  if (state.onboard.onboard_led)    used['D5'] = { onboardId: 'onboard_led',    name: obName('onboard_led', 'Red LED'),          dip: 2, color: '#ef4444' };
  if (state.onboard.onboard_pot)    used['A0'] = { onboardId: 'onboard_pot',    name: obName('onboard_pot', 'Potentiometer'),    dip: 3, color: '#fbbf24' };
  if (state.onboard.onboard_start)  used['D3'] = { onboardId: 'onboard_start',  name: obName('onboard_start', 'START Button'),   dip: 4, color: '#22c55e' };
  if (state.onboard.onboard_select) used['D4'] = { onboardId: 'onboard_select', name: obName('onboard_select', 'SELECT Button'), dip: 5, color: '#0ea5e9' };
  if (state.onboard.onboard_buzzer) used['D9'] = { onboardId: 'onboard_buzzer', name: obName('onboard_buzzer', 'Buzzer'),        dip: 6, color: '#facc15' };
  if (state.onboard.onboard_wireless || hasWirelessComp) {
    const wl = t('onboard.wireless');
    used['D6'] = { onboardId: 'onboard_wireless', name: `${wl} RX`, dip: 7, color: '#c084fc', lockedBySlot: hasWirelessComp };
    used['D7'] = { onboardId: 'onboard_wireless', name: `${wl} TX`, dip: 8, color: '#c084fc', lockedBySlot: hasWirelessComp };
  }
  if (state.onboard.onboard_distance) {
    const us = obName('onboard_distance', 'Ultrasonic');
    used['D10'] = { onboardId: 'onboard_distance', name: `${us} TRIG`, dip: null, color: '#38bdf8' };
    used['D11'] = { onboardId: 'onboard_distance', name: `${us} ECHO`, dip: null, color: '#38bdf8' };
  }
  if (state.onboard.onboard_joystick) {
    const js = obName('onboard_joystick', 'Joystick');
    used['A1'] = { onboardId: 'onboard_joystick', name: `${js} VRX`, dip: null, color: '#34d399', hardwired: true };
    used['A2'] = { onboardId: 'onboard_joystick', name: `${js} VRY`, dip: null, color: '#34d399', hardwired: true };
  }
  return used;
}

export function getPinUsageCounts(excludeInstId = null, excludeCompPinId = null) {
  const counts = {};
  for (const inst of state.active) {
    for (const [cpId, bpId] of Object.entries(inst.pinMap || {})) {
      if (!bpId) continue;
      if (inst.instanceId === excludeInstId && cpId === excludeCompPinId) continue;
      counts[bpId] = (counts[bpId] || 0) + 1;
    }
  }
  return counts;
}

export function getUsedI2CHeaders(excludeInstId = null, extraReservedHeader = null) {
  const used = new Set();
  for (const inst of state.active) {
    if (inst.instanceId === excludeInstId) continue;
    if (inst.i2cHeader) used.add(inst.i2cHeader);
  }
  if (extraReservedHeader) used.add(extraReservedHeader);
  return used;
}

export function getSharedPinCandidates(role, excludeInstId = null, extraReservedHeader = null) {
  const allPins = window.KCOMP_BOARD?.pins || {};
  const usedI2c = getUsedI2CHeaders(excludeInstId, extraReservedHeader);
  const out = [];
  const pushIfValid = (bpId) => {
    const meta = allPins[bpId];
    if (!meta || meta.blocked) return;
    if (!out.includes(bpId)) out.push(bpId);
  };

  if (role === 'GND') {
    // 1. Dedicated board GND pins first (POWER header + top digital header)
    for (const bpId of ['PWR_GND1', 'PWR_GND2', 'TOP_GND']) pushIfValid(bpId);
    // Any other non-I2C, non-external-barrel GND pin present in pinmap
    for (const [bpId, meta] of Object.entries(allPins)) {
      if (meta.blocked || /^H[1-3]_/.test(bpId) || bpId === 'EXT_GND') continue;
      if ((meta.caps || []).includes('GND')) pushIfValid(bpId);
    }
    // 2. Unused I²C header GND pins (H1 / H3 / H2 — H2 last since I²C modules prefer H2 first)
    for (const hk of ['H1', 'H3', 'H2']) {
      if (!usedI2c.has(hk)) pushIfValid(`${hk}_GND`);
    }
  } else if (role === 'POWER_5V') {
    // 1. Dedicated board 5V pin first
    pushIfValid('PWR_5V');
    for (const [bpId, meta] of Object.entries(allPins)) {
      if (meta.blocked || /^H[1-3]_/.test(bpId)) continue;
      if ((meta.caps || []).includes('5V')) pushIfValid(bpId);
    }
    // 2. Unused I²C header VCC (+5V) pins
    for (const hk of ['H1', 'H3', 'H2']) {
      if (!usedI2c.has(hk)) pushIfValid(`${hk}_VCC`);
    }
  }
  return out;
}

export function pickBestSharedPin(role, fallbackPin, pickedThisInst = null, excludeInstId = null, excludeCompPinId = null, extraReservedHeader = null) {
  const candidates = getSharedPinCandidates(role, excludeInstId, extraReservedHeader);
  if (!candidates.length) return fallbackPin;

  const counts = getPinUsageCounts(excludeInstId, excludeCompPinId);

  // Pass 1: Always prefer a completely FREE physical board pin (0 wires) -> avoids breadboard completely!
  for (const bpId of candidates) {
    if ((counts[bpId] || 0) === 0 && (!pickedThisInst || !pickedThisInst.has(bpId))) {
      return bpId;
    }
  }

  // Pass 2: All physical pins are already in use -> consolidate onto ONE existing breadboard rail (or primary pin)
  const existingRail = candidates.find((bpId) => !/^H[1-3]_/.test(bpId) && (counts[bpId] || 0) >= 2);
  if (existingRail) return existingRail;

  const primary = role === 'GND' ? 'PWR_GND1' : (role === 'POWER_5V' ? 'PWR_5V' : fallbackPin);
  return candidates.includes(primary) ? primary : (fallbackPin || candidates[0]);
}

export function relocateBorrowedHeaderPins(headerKey, claimingInstId = null) {
  if (!headerKey) return;
  const gndPin = `${headerKey}_GND`;
  const vccPin = `${headerKey}_VCC`;
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
  // Eliminates unnecessary breadboard GND/5V rails whenever free physical pins exist on the board
  for (let pass = 0; pass < 24; pass++) {
    const counts = getPinUsageCounts();
    let moved = false;
    for (const inst of state.active) {
      const def = getCompDef(inst.compId);
      if (!def) continue;
      for (const p of def.pins) {
        if (p.role !== 'GND' && p.role !== 'POWER_5V') continue;
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

export function getSuitableBoardPins(pinSpec, excludeInstId = null, excludeCompPinId = null) {
  const claims = getExternalPinClaims(excludeInstId, excludeCompPinId);
  const obUsage = getOnboardPinUsage();
  const allPins = window.KCOMP_BOARD.pins;
  const allowed = pinSpec.allowedTypes || [];
  const results = [];

  const usedI2c = getUsedI2CHeaders(excludeInstId);
  const pinCounts = getPinUsageCounts(excludeInstId, excludeCompPinId);

  for (const [bpId, meta] of Object.entries(allPins)) {
    if (meta.blocked) continue;
    const caps = meta.caps || [];
    let matches = allowed.some((cap) => caps.includes(cap));
    // Also allow unused I²C header GND/VCC pins when manually dragging a GND or 5V wire
    if (!matches && /^H([1-3])_(GND|VCC)$/.test(bpId)) {
      const [, hNum, hKind] = bpId.match(/^H([1-3])_(GND|VCC)$/);
      if (!usedI2c.has(`H${hNum}`)) {
        if (hKind === 'GND' && allowed.includes('GND')) matches = true;
        if (hKind === 'VCC' && allowed.includes('5V')) matches = true;
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
      usageCount: pinCounts[bpId] || 0
    });
  }

  const pref = pinSpec.preferred || [];
  results.sort((a, b) => {
    const aFree = !a.takenBy && !a.onboardBy;
    const bFree = !b.takenBy && !b.onboardBy;
    if (aFree !== bFree) return aFree ? -1 : 1;

    if (!!a.takenBy !== !!b.takenBy) return a.takenBy ? 1 : -1;
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
  const used = getUsedI2CHeaders();
  const counts = getPinUsageCounts();
  // Pass 1: Prefer an I²C header that has neither an I²C module nor borrowed VCC/GND wires
  for (const h of ['H2', 'H1', 'H3']) {
    if (!used.has(h) && !counts[`${h}_VCC`] && !counts[`${h}_GND`]) return h;
  }
  // Pass 2: Any header without an I²C module (borrowed VCC/GND wires will be auto-relocated)
  for (const h of ['H2', 'H1', 'H3']) {
    if (!used.has(h)) return h;
  }
  // 4th+ I²C module shares H3, which automatically expands onto the bottom half of the red Breadboard!
  return 'H3';
}

export function applyI2CHeaderMapping(inst, def, headerKey) {
  relocateBorrowedHeaderPins(headerKey, inst.instanceId);
  inst.i2cHeader = headerKey;
  const hdr = window.KCOMP_BOARD.i2cHeaders[headerKey];
  for (const p of def.pins) {
    if (p.role === 'I2C_VCC') inst.pinMap[p.id] = hdr.VCC;
    if (p.role === 'I2C_GND') inst.pinMap[p.id] = hdr.GND;
    if (p.role === 'I2C_SCL') inst.pinMap[p.id] = hdr.SCL;
    if (p.role === 'I2C_SDA') inst.pinMap[p.id] = hdr.SDA;
  }
}

export function getPendingPins() {
  const pending = [];
  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
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

export async function addComponent(compId, opts = {}) {
  const def = getCompDef(compId);
  if (!def) return;
  if (!canAddComponent(compId)) {
    const existing = state.active.find((a) => a.compId === compId);
    if (existing) { state.focusedId = existing.instanceId; hooks.recomputeAndRender(); }
    const max = def.maxPerDesign ?? 1;
    showToast(t('toast.maxComp', { max, name: getDisplayLabel(def), reason: tComp(def, 'maxReason') || t('toast.hardwareLimit') }));
    return;
  }

  if (!opts.skipUndo) hooks.pushUndoState();
  await loadComponentSvg(def.svgFile);
  const inst = { instanceId: 'inst_' + state.nextInst++, compId, i2cHeader: null, pinMap: {}, customPos: null, rotation: 0 };

  if (def.i2cHeaderSelectable) {
    applyI2CHeaderMapping(inst, def, opts.i2cHeader || pickDefaultI2CHeader());
  }

  const unassignedPins = [];
  const pickedThisInst = new Set();

  for (const p of def.pins) {
    if (inst.pinMap[p.id]) continue;
    if (opts.pinOverrides && opts.pinOverrides[p.id]) {
      inst.pinMap[p.id] = opts.pinOverrides[p.id];
      pickedThisInst.add(opts.pinOverrides[p.id]);
      continue;
    }
    if (p.fixedPin) { inst.pinMap[p.id] = p.fixedPin; continue; }
    if (p.defaultPin) {
      if (p.role === 'GND' || p.role === 'POWER_5V') {
        const best = pickBestSharedPin(p.role, p.defaultPin, pickedThisInst, inst.instanceId, p.id);
        inst.pinMap[p.id] = best;
        pickedThisInst.add(best);
      } else {
        inst.pinMap[p.id] = p.defaultPin;
      }
      continue;
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
  } else if (i2cHeaderCount >= 2 && !opts.skipUndo) {
    showToast(t('toast.i2cExpanded', { header: inst.i2cHeader }));
    if (isMobileViewport() && state.mobileView !== 'board') state.needsMobileFit = true;
  } else if (isMobileViewport() && state.mobileView !== 'board') {
    state.needsMobileFit = true;
    showToast(t('toast.addedMobile', { name: getDisplayLabel(def) }));
  }
  hooks.recomputeAndRender();
  if (!opts.skipUndo) {
    hooks.flashTarget({ instanceId: inst.instanceId, panIfOffscreen: true });
  }
}

export function removeComponent(instanceId) {
  const inst = state.active.find((i) => i.instanceId === instanceId);
  const def = inst ? getCompDef(inst.compId) : null;
  const removedName = def ? getDisplayLabel(def) : '';
  hooks.pushUndoState();
  state.active = state.active.filter((i) => i.instanceId !== instanceId);
  if (state.focusedId === instanceId) state.focusedId = null;
  rebalanceOverflowPowerPins();
  const autoConn = autoConnectPendingPins();
  const msg = autoConn.length
    ? t('toast.autoConnected', { list: autoConn.join(', ') })
    : (removedName ? t('toast.removedComp', { name: removedName }) : t('toast.removedGeneric'));
  showToast(msg, { actionLabel: t('toast.undoBtn'), onAction: () => hooks.performUndo() });
  hooks.recomputeAndRender();
}

export function toggleDipSwitch(dipNum) {
  const dip = window.KCOMP_BOARD.dipSwitches.find((d) => d.id === dipNum);
  if (!dip) return;
  if (dip.lockedOn) {
    showToast(t('toast.dipAutoResetLocked'));
    return;
  }

  const extClaims = getExternalPinClaims();
  if (dip.id === 7 || dip.id === 8) {
    const hasWirelessComp = state.active.some((i) => getCompDef(i.compId).onboardWirelessSlot);
    if (hasWirelessComp) {
      showToast(t('toast.dipWirelessLocked'));
      return;
    }
    if (extClaims['D6'] || extClaims['D7']) {
      const who = (extClaims['D6'] || extClaims['D7']).compName;
      showToast(t('toast.dipWirelessExternal', { who }));
      return;
    }
    hooks.pushUndoState();
    state.onboard.onboard_wireless = !state.onboard.onboard_wireless;
    const autoConn = !state.onboard.onboard_wireless ? autoConnectPendingPins() : [];
    if (autoConn.length) showToast(t('toast.autoConnected', { list: autoConn.join(', ') }));
    hooks.recomputeAndRender();
    return;
  }

  if (extClaims[dip.pin]) {
    showToast(t('toast.dipPinExternal', { pin: dip.pin, who: extClaims[dip.pin].compName, name: tDipName(dip) }));
    return;
  }
  if (dip.onboardId && state.onboard[dip.onboardId] !== undefined) {
    hooks.pushUndoState();
    state.onboard[dip.onboardId] = !state.onboard[dip.onboardId];
    const autoConn = !state.onboard[dip.onboardId] ? autoConnectPendingPins() : [];
    if (autoConn.length) showToast(t('toast.autoConnected', { list: autoConn.join(', ') }));
    hooks.recomputeAndRender();
  }
}

export function toggleOnboardComponent(obId) {
  if (obId === 'onboard_wireless') { toggleDipSwitch(7); return; }
  const ob = state.catalog.onboard.find((o) => o.id === obId);
  if (!ob) return;
  if (ob.dip) { toggleDipSwitch(ob.dip); return; }
  hooks.pushUndoState();
  state.onboard[obId] = !state.onboard[obId];
  const autoConn = !state.onboard[obId] ? autoConnectPendingPins() : [];
  if (autoConn.length) showToast(t('toast.autoConnected', { list: autoConn.join(', ') }));
  hooks.recomputeAndRender();
}

export function computeDipStates() {
  const extClaims = getExternalPinClaims();
  const hasWirelessComp = state.active.some((i) => getCompDef(i.compId).onboardWirelessSlot);

  return window.KCOMP_BOARD.dipSwitches.map((d) => {
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
  const warns = [];
  const extClaims = getExternalPinClaims();

  const addrMap = {};
  const addrInst = {};
  if (state.onboard.onboard_oled) addrMap['0x3C'] = ['OLED'];
  for (const inst of state.active) {
    const addr = getInstanceAddress(inst);
    if (addr) {
      if (!addrMap[addr]) addrMap[addr] = [];
      addrMap[addr].push(getCompDef(inst.compId).name);
      addrInst[addr] = inst.instanceId;
    }
  }
  for (const [addr, names] of Object.entries(addrMap)) {
    if (names.length > 1) {
      warns.push({
        critical: true,
        text: t('warn.i2cCollision', { addr, names: names.join(' + ') }),
        target: addrInst[addr] ? { instanceId: addrInst[addr], panIfOffscreen: true } : { onboardId: 'onboard_oled' }
      });
    }
  }

  const wirelessInsts = state.active.filter((i) => getCompDef(i.compId).onboardWirelessSlot);
  if (wirelessInsts.length > 1) {
    warns.push({
      critical: true,
      text: t('warn.wirelessConflict'),
      target: { instanceId: wirelessInsts[1].instanceId, onboardId: 'onboard_wireless', panIfOffscreen: true }
    });
  }
  const dcMotorInst = state.active.find((i) => i.compId === 'dc-motor');
  if (dcMotorInst && !state.active.some((i) => i.compId === 'tb6612fng')) {
    warns.push({
      critical: true,
      text: t('warn.dcNeedsDriver'),
      target: { instanceId: dcMotorInst.instanceId, panIfOffscreen: true }
    });
  }
  if (state.onboard.onboard_distance && (extClaims['D10'] || extClaims['D11'])) {
    const claim = extClaims['D10'] || extClaims['D11'];
    warns.push({
      critical: true,
      text: t('warn.ultrasonicConflict'),
      target: { instanceId: claim.instanceId, pinId: extClaims['D10'] ? 'D10' : 'D11', onboardId: 'onboard_distance', panIfOffscreen: true }
    });
  }
  const uartInsts = state.active.filter((i) => {
    const d = getCompDef(i.compId);
    return d && (d.interface === 'UART' || d.onboardWirelessSlot);
  });
  if (uartInsts.length > 1) {
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
  }

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

  const cur = computeUsbCurrent();
  const maxMa = state.catalog.usbCurrentMaxMa || 500;
  if (cur.total >= 450) {
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
  const base = window.KCOMP_BOARD.sramBaseOverhead;
  const total = window.KCOMP_BOARD.sramTotal;
  let used = base;
  const breakdown = [t('sram.base', { bytes: base })];

  for (const ob of state.catalog.onboard) {
    if (!state.onboard[ob.id]) continue;
    if (ob.id === 'onboard_oled') {
      const b = state.oledPaged ? ob.sramPaged : ob.sram;
      used += b;
      const modeLbl = state.oledPaged ? t('bottom.oledShortPaged') : t('bottom.oledShortFull');
      breakdown.push(t('sram.oledItem', { mode: modeLbl, bytes: b }));
    } else {
      const b = ob.sram || 0;
      used += b;
      if (b > 0) breakdown.push(`${tOnboard(ob, 'shortName')}: ${b} B`);
    }
  }
  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    const b = def.sram || 0;
    used += b;
    if (b > 0) breakdown.push(`${getDisplayLabel(def)}: ${b} B`);
  }
  const blkBytes = computeCodeBlocksSram();
  if (blkBytes > 0) {
    used += blkBytes;
    breakdown.push(t('sram.blocksItem', { bytes: blkBytes }));
  }
  if (state.onboard.onboard_oled && !state.oledPaged) {
    breakdown.push(t('sram.oledSaveTip'));
  }
  return { used, total, breakdown };
}

export function computeSram() {
  return computeSramBreakdown().used;
}

export function computeUsbCurrent() {
  const base = state.catalog.baseCurrentMa || 45;
  let onboardMa = 0;
  const breakdown = [t('current.base', { ma: base })];
  for (const ob of state.catalog.onboard) {
    if (!state.onboard[ob.id]) continue;
    const m = ob.currentMa || 0;
    onboardMa += m;
    if (m >= 10) breakdown.push(t('current.onboard', { name: tOnboard(ob, 'shortName'), ma: m }));
  }
  let extMa = 0;
  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    const m = def.currentMa || 0;
    extMa += m;
    if (m > 0) breakdown.push(`${getDisplayLabel(def)}: ${m} mA`);
  }
  return { total: base + onboardMa + extMa, base, onboardMa, extMa, breakdown };
}
