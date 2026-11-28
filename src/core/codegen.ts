// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// K-Comp V2 .ino Structure-Aware Generator (Hardware Init + Program Structure Blocks + Dark+/Light+ Highlighter)
import { APP_VERSION } from './constants';
import { state, $, escapeHtml, getCleanProjectName, getActiveOnboardDefs } from './state';
import { getCompDef, countActiveByCompId, computeUartAssignments } from './hardware';
import {
  clampInt, cleanIdent, toUpperMacro, parseStateList, parseCharList,
  resolveParserSource
} from './code-blocks';
import { getActiveBoard } from '../boards';
import { buildGenericScaffoldForComponent, getDriverCompat, normalizeCodeProfile } from './code-profiles';

function makeLine(text, blockId = null, hwId = null) {
  const trimmed = String(text).trim();
  const isTodo = /^\/\/\s*TODO\b/i.test(trimmed) || /\/\*\s*TODO\b/i.test(trimmed);
  return { text, blockId, hwId, isTodo };
}

function capFirst(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : '';
}

export function buildSketchModel(dipStates) {
  const hints = state.codeHints !== false;
  const blocks = state.codeBlocks || [];
  const hasBlocks = blocks.length > 0;

  const findBlock = (type) => blocks.find((b) => b.type === type) || null;
  const findBlocks = (type) => blocks.filter((b) => b.type === type);

  const evaBlk = findBlock('eva');
  const fsmBlk = findBlock('fsm');
  const toggleBlk = findBlock('toggle');
  const timerBlks = findBlocks('timer');
  const oneshotBlks = findBlocks('oneshot');
  const debugBlk = findBlock('debug_tick');
  const btnBlk = findBlock('btn_callbacks');
  const gridBlk = findBlock('oled_grid');
  const parserBlk = findBlock('char_parser');
  const joyBlk = findBlock('joy_4way');
  const irBlk = findBlock('ir_switch');
  const motorBlk = findBlock('motor_seq');
  const hidBlk = findBlock('hid_guard');

  // Section buffers: each entry is { text, blockId, isTodo }
  const includes = [];
  const includeSet = new Set();
  const defines = [];
  const globals = [];
  const globalsSet = new Set();
  const helpers = [];
  const setupLines = [];
  const serviceLoop = [];
  const serviceSet = new Set();
  const hwCommentLoop = [];
  const hwCommentSet = new Set();

  let wireBegun = false;
  const pushInclude = (line, blockId = null, hwId = null) => {
    if (!includeSet.has(line)) {
      includeSet.add(line);
      includes.push(makeLine(line, blockId, hwId));
    }
  };
  const pushDefine = (line, blockId = null, hwId = null) => defines.push(makeLine(line, blockId, hwId));
  const pushGlobal = (line, blockId = null, hwId = null) => {
    if (line === '') { globals.push(makeLine('', blockId, hwId)); return; }
    if (!globalsSet.has(line)) {
      globalsSet.add(line);
      globals.push(makeLine(line, blockId, hwId));
    }
  };
  const pushSetup = (line, blockId = null, hwId = null) => {
    if (line.trim() === 'Wire.begin();') {
      if (wireBegun) return;
      wireBegun = true;
    }
    setupLines.push(makeLine(line, blockId, hwId));
  };
  const pushService = (line, blockId = null, hwId = null) => {
    if (!serviceSet.has(line)) {
      serviceSet.add(line);
      serviceLoop.push(makeLine(line, blockId, hwId));
    }
  };
  const pushHwLoop = (line, blockId = null, hwId = null) => {
    if (!line.trim().startsWith('//')) {
      pushService(line, blockId, hwId);
    } else if (!hwCommentSet.has(line)) {
      hwCommentSet.add(line);
      hwCommentLoop.push(makeLine(line, blockId, hwId));
    }
  };

  const board = getActiveBoard();
  const activeProfile = normalizeCodeProfile(state.codeProfile, board);
  const isAvrKcomp = board.mcu === 'atmega328p' && activeProfile === 'kcomp-avr';
  const activeOnboards = getActiveOnboardDefs();

  // Helper to check if an onboard peripheral is active (enabled + DIP ON)
  const isOnboardActive = (obId) => {
    if (!state.onboard[obId]) return false;
    const ob = activeOnboards.find((o) => o.id === obId);
    if (!ob) return false;
    const dip = ob.dip ? dipStates.find((d) => d.id === ob.dip) : null;
    return !dip || dip.on;
  };

  // =========================================================================
  // 1. ONBOARD HARDWARE INITIALIZATION
  // =========================================================================
  for (const ob of activeOnboards) {
    if (!isOnboardActive(ob.id)) continue;
    const tpl = ob.id === 'onboard_oled' ? (state.oledPaged ? ob.codePaged : ob.codeFull) : (ob.code || {});
    (tpl.includes || []).forEach((i) => pushInclude(i, null, ob.id));
    (tpl.defines || []).forEach((d) => pushDefine(d, null, ob.id));
    (tpl.setup || []).forEach((s) => pushSetup(s, null, ob.id));
    (tpl.loop || []).forEach((l) => pushHwLoop(l, null, ob.id));
  }

  // On pin-mux boards (e.g. ESP32-S3), emit explicit I2C bus pin defines & Wire.begin(SDA, SCL) if any I2C device is connected
  const hasAnyI2c = state.active.some((i) => getCompDef(i.compId)?.interface === 'I2C');
  if (board.capabilities.hasPinMux && hasAnyI2c && board.defaultI2cPins) {
    const sdaPin = board.pins[board.defaultI2cPins.sda]?.pinNum || board.defaultI2cPins.sda;
    const sclPin = board.pins[board.defaultI2cPins.scl]?.pinNum || board.defaultI2cPins.scl;
    pushInclude('#include <Wire.h>');
    pushDefine(`#define I2C_SDA_PIN ${sdaPin}`);
    pushDefine(`#define I2C_SCL_PIN ${sclPin}`);
    wireBegun = true;
    setupLines.push(makeLine('Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);'));
  }

  // =========================================================================
  // 2. EXTERNAL MODULES INITIALIZATION
  // =========================================================================
  let servoSlotIdx = 0;
  const resolveVars = (str, inst, def, suffixStr, servoSlot) => {
    let out = str;
    for (const p of def.pins) {
      if (!p.codeKey) continue;
      const bpId = inst.pinMap[p.id];
      const pinVal = bpId && getActiveBoard().pins[bpId] ? (getActiveBoard().pins[bpId].pinNum || bpId) : bpId;
      out = out.replaceAll(`{{PIN_${p.codeKey}}}`, pinVal || '/* unassigned */');
    }
    out = out.replaceAll('{{SUFFIX}}', suffixStr);
    out = out.replaceAll('{{SERVO_SLOT}}', String(servoSlot));
    return out;
  };

  const motorShieldCount = countActiveByCompId('tb6612fng');
  const hasRfTx = state.active.some((i) => i.compId === 'rf433-tx');
  const hasRfRx = state.active.some((i) => i.compId === 'rf433-rx');
  const combinedRf433 = hasRfTx && hasRfRx;
  let motorEmitted = false;
  let rfCombinedEmitted = false;
  const seenCounts = {};
  const uartAssigns = computeUartAssignments();

  for (const inst of state.active) {
    const def = getCompDef(inst.compId);
    if (!def) continue;
    const c = def.code || {};
    seenCounts[inst.compId] = (seenCounts[inst.compId] || 0) + 1;
    const suffixStr = countActiveByCompId(inst.compId) > 1 ? `_${seenCounts[inst.compId]}` : '';
    const isServo = inst.compId === 'sg90-180' || inst.compId === 'sg90-360' || inst.compId === 'hcsr04-sg90';
    const thisServoSlot = isServo ? servoSlotIdx++ : 0;
    const hwId = inst.instanceId;

    // Non-AVR CodeProfile Resolution ('generic-scaffold' or 'kcomp-portable' with auto-fallback for avr-only drivers)
    if (!isAvrKcomp) {
      const compat = getDriverCompat(def.id, board);
      const usePortableKcomp = activeProfile === 'kcomp-portable' && compat !== 'avr-only';
      if (!usePortableKcomp) {
        const gen = buildGenericScaffoldForComponent(def, inst, board, suffixStr, uartAssigns[inst.instanceId] || null);
        if (activeProfile === 'kcomp-portable' && compat === 'avr-only') {
          pushGlobal(`// NOTE: ${def.name} K-Comp header is ATmega328P-only — using ${board.shortName} pin/bus scaffold`, null, hwId);
        }
        gen.includes.forEach((i) => pushInclude(i, null, hwId));
        gen.defines.forEach((d) => pushDefine(d, null, hwId));
        gen.globals.forEach((g) => pushGlobal(g, null, hwId));
        gen.setup.forEach((s) => pushSetup(s, null, hwId));
        gen.loop.forEach((l) => pushHwLoop(l, null, hwId));
        continue;
      }
      if (compat === 'portable-untested') {
        pushGlobal(`// BETA: ${def.name} K-Comp C-API header not yet verified on ${board.shortName}`, null, hwId);
      }
    }

    if (inst.compId === 'tb6612fng') {
      if (motorEmitted) continue;
      motorEmitted = true;
      (c.includes || []).forEach((i) => pushInclude(i, null, hwId));
      const stLines = motorShieldCount >= 2 && c.setupDual ? c.setupDual : (c.setup || []);
      stLines.forEach((s) => pushSetup(s, null, hwId));
      (c.loop || []).forEach((l) => pushHwLoop(l, null, hwId));
      continue;
    }

    if (inst.compId === 'dc-motor' && motorShieldCount > 0) continue;

    if (combinedRf433 && (inst.compId === 'rf433-tx' || inst.compId === 'rf433-rx')) {
      (c.includes || []).forEach((i) => pushInclude(i, null, hwId));
      (c.defines || []).forEach((d) => pushDefine(resolveVars(d, inst, def, suffixStr, thisServoSlot), null, hwId));
      if (!rfCombinedEmitted) {
        rfCombinedEmitted = true;
        pushGlobal('RH_ASK rfDriver(2000, RF433_RX_PIN, RF433_TX_PIN, 0);', null, hwId);
        pushSetup('if (!rfDriver.init()) {', null, hwId);
        pushSetup('  Serial.println(F("CRITICAL ERROR: 433MHz RF driver init failed! Check wiring."));', null, hwId);
        pushSetup('  while (1);', null, hwId);
        pushSetup('}', null, hwId);
        pushHwLoop('// rfDriver.send((uint8_t*)msg, strlen(msg)); rfDriver.waitPacketSent();', null, hwId);
        pushHwLoop('// uint8_t buf[12]; uint8_t len = sizeof(buf); if (rfDriver.recv(buf, &len)) { /* handle */ }', null, hwId);
      }
      continue;
    }

    (c.includes || []).forEach((i) => pushInclude(i, null, hwId));
    (c.defines || []).forEach((d) => pushDefine(resolveVars(d, inst, def, suffixStr, thisServoSlot), null, hwId));
    if (inst.i2cAddrOverride && def.i2cAddr && inst.i2cAddrOverride !== def.i2cAddr) {
      const mBase = def.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + suffixStr;
      pushDefine(`#define ${mBase}_I2C_ADDR ${inst.i2cAddrOverride} // Configured via address pin`, null, hwId);
    }
    for (const optPin of def.pins) {
      if (optPin.tier !== 'optional' || !inst.pinMap[optPin.id]) continue;
      const bpId = inst.pinMap[optPin.id];
      const pinVal = board.pins[bpId]?.pinNum || bpId;
      const mBase = def.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + suffixStr;
      const pMacro = `${mBase}_${optPin.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_PIN`;
      pushDefine(`#define ${pMacro} ${pinVal} // Optional ${optPin.id}`, null, hwId);
      const isOut = optPin.id === 'LED' || optPin.id === 'SET' || optPin.id === 'SDN' || optPin.role === 'PWM';
      pushSetup(`pinMode(${pMacro}, ${isOut ? 'OUTPUT' : (optPin.role === 'INT' ? 'INPUT_PULLUP' : 'INPUT')}); // ${def.name} optional ${optPin.id}`, null, hwId);
    }
    (c.globals || []).forEach((g) => pushGlobal(resolveVars(g, inst, def, suffixStr, thisServoSlot), null, hwId));
    (c.setup || []).forEach((s) => pushSetup(resolveVars(s, inst, def, suffixStr, thisServoSlot), null, hwId));
    (c.loop || []).forEach((l) => pushHwLoop(resolveVars(l, inst, def, suffixStr, thisServoSlot), null, hwId));
  }

  // =========================================================================
  // 3. PROGRAM STRUCTURE BLOCKS (100% FLAT C, ZERO STUDENT ARRAYS)
  // =========================================================================
  const inputSection = [];
  const logicSection = [];
  const outputSection = [];

  const pushHint = (arr, text, bid) => {
    if (hints) arr.push(makeLine(text, bid));
  };

  // --- A. State Machine (FSM) ---
  const fsmStates = fsmBlk ? parseStateList(fsmBlk.config?.states) : [];
  if (fsmBlk) {
    const bid = fsmBlk.blockId;
    pushHint(globals, '// [State Machine]', bid);
    fsmStates.forEach((st, idx) => {
      pushGlobal(`#define STATE_${st} ${idx}`, bid);
    });
    pushGlobal(`uint8_t gameState = STATE_${fsmStates[0]};`, bid);
  }

  // --- B. Active / Pause Toggle ---
  const toggleVar = toggleBlk ? cleanIdent(toggleBlk.config?.varName, 'isRunning') : 'isRunning';
  if (toggleBlk) {
    const bid = toggleBlk.blockId;
    pushHint(globals, '// [Active / Pause Toggle]', bid);
    pushGlobal(`bool ${toggleVar} = false;`, bid);
  }

  // --- C. Deadman Clutch (CH9329 HID Guard) ---
  if (hidBlk) {
    const bid = hidBlk.blockId;
    pushHint(globals, '// [CH9329 Deadman Safety Guard]', bid);
    pushGlobal('bool hidEnabled = false;', bid);
  }

  // --- D. Interval Timers (supports multiple instances with unique variable names) ---
  const usedTimerNames = new Set();
  const timerMeta = timerBlks.map((blk, idx) => {
    let base = cleanIdent(blk.config?.name, idx === 0 ? 'tick' : `timer${idx + 1}`);
    if (usedTimerNames.has(base)) base = `${base}${idx + 1}`;
    usedTimerNames.add(base);
    const ms = clampInt(blk.config?.intervalMs, 10, 60000, 250);
    const macro = `${toUpperMacro(base, 'TICK')}_INTERVAL_MS`;
    const varName = `last${capFirst(base)}Time`;
    return { blk, base, ms, macro, varName };
  });
  for (const tm of timerMeta) {
    const bid = tm.blk.blockId;
    pushHint(globals, `// [Interval Timer: ${tm.base} (${tm.ms} ms)]`, bid);
    pushGlobal(`const uint16_t ${tm.macro} = ${tm.ms};`, bid);
    pushGlobal(`unsigned long ${tm.varName} = 0;`, bid);
  }

  // --- E. One-Shot / Splash Timers ---
  const usedOneshotNames = new Set();
  const oneshotMeta = oneshotBlks.map((blk, idx) => {
    let base = cleanIdent(blk.config?.name, idx === 0 ? 'splash' : `oneshot${idx + 1}`);
    if (usedOneshotNames.has(base)) base = `${base}${idx + 1}`;
    usedOneshotNames.add(base);
    const ms = clampInt(blk.config?.durationMs, 50, 60000, 2500);
    const macro = `${toUpperMacro(base, 'SPLASH')}_DURATION_MS`;
    const startVar = `${base}StartTime`;
    const activeVar = `${base}Active`;
    return { blk, base, ms, macro, startVar, activeVar };
  });
  for (const os of oneshotMeta) {
    const bid = os.blk.blockId;
    pushHint(globals, `// [One-Shot Timer: ${os.base} (${os.ms} ms)]`, bid);
    pushGlobal(`const uint16_t ${os.macro} = ${os.ms};`, bid);
    pushGlobal(`unsigned long ${os.startVar} = 0;`, bid);
    pushGlobal(`bool ${os.activeVar} = true;`, bid);
    pushSetup(`${os.startVar} = millis();`, bid);
  }

  // --- F. Serial Debug Heartbeat ---
  if (debugBlk) {
    const bid = debugBlk.blockId;
    const ms = clampInt(debugBlk.config?.intervalMs, 100, 10000, 500);
    pushHint(globals, `// [Serial Debug Heartbeat (${ms} ms)]`, bid);
    pushGlobal(`const uint16_t DEBUG_INTERVAL_MS = ${ms};`, bid);
    pushGlobal('unsigned long lastDebugTime = 0;', bid);
  }

  // --- G. 4-Way Joystick ---
  if (joyBlk) {
    const bid = joyBlk.blockId;
    pushHint(globals, '// [4-Way Joystick Lock]', bid);
    pushGlobal('bool joyNeutral = true;', bid);
  }

  // --- H. Motor Step Sequence ---
  if (motorBlk) {
    const bid = motorBlk.blockId;
    pushHint(globals, '// [Motor Step Sequence]', bid);
    pushGlobal('uint8_t driveStep = 0;', bid);
  }

  // --- I. OLED Grid Engine ---
  if (gridBlk) {
    const bid = gridBlk.blockId;
    const cols = clampInt(gridBlk.config?.cols, 2, 16, 3);
    const rows = clampInt(gridBlk.config?.rows, 2, 8, 3);
    const cell = clampInt(gridBlk.config?.cellSize, 6, 30, 20);
    const showCursor = gridBlk.config?.cursor !== false;
    const offX = Math.max(0, Math.floor((128 - cols * cell) / 2));
    const offY = Math.max(0, Math.floor((64 - rows * cell) / 2));

    pushInclude('#include <kcomp_oled_grid.h>', bid);
    pushHint(globals, `// [OLED Grid Engine (${cols}x${rows})]`, bid);
    pushGlobal(`uint8_t gameMemory[GRID_MEM_SIZE(${cols}, ${rows})] = {0};`, bid);

    pushHint(helpers, `// [OLED Grid Engine] Draw each cell value (0 = empty, 1..n = pieces)`, bid);
    helpers.push(makeLine('void drawPieces(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t cellState) {', bid));
    helpers.push(makeLine('  if (cellState == 1) {', bid));
    pushHint(helpers, '    // TODO: Draw piece 1 (e.g. drawLine / fillRect)', bid);
    helpers.push(makeLine('  } else if (cellState == 2) {', bid));
    pushHint(helpers, '    // TODO: Draw piece 2 (e.g. drawCircle)', bid);
    helpers.push(makeLine('  }', bid));
    helpers.push(makeLine('}', bid));
    helpers.push(makeLine('', bid));

    if (showCursor) {
      helpers.push(makeLine('void drawCursor(int16_t x, int16_t y, int16_t w, int16_t h) {', bid));
      helpers.push(makeLine('  drawRect(x + 1, y + 1, w - 2, h - 2, OLED_COLOR_INVERT);', bid));
      helpers.push(makeLine('}', bid));
      helpers.push(makeLine('', bid));
    }

    pushSetup(`initGrid(${cols}, ${rows}, ${cell}, ${cell}, ${offX}, ${offY}, gameMemory);`, bid);
    pushSetup('attachGridRender(drawPieces);', bid);
    if (showCursor) {
      pushSetup('attachCursorRender(drawCursor);', bid);
      pushSetup('enableCursor(true);', bid);
    }
  }

  // --- J. Button Callbacks (START / SELECT) ---
  const needStartCb = (btnBlk && (btnBlk.config?.buttons || 'both') !== 'select') || !!hidBlk;
  const needSelectCb = btnBlk && (btnBlk.config?.buttons || 'both') !== 'start';
  if (needStartCb || needSelectCb) {
    const startOwner = btnBlk ? btnBlk.blockId : hidBlk.blockId;
    if (needStartCb) {
      pushInclude('#include <kcomp_button_start.h>', startOwner);
      if (!setupLines.some((l) => l.text.includes('initButtonStart()'))) {
        pushSetup('initButtonStart();', startOwner);
      }
      pushSetup('attachButtonStartClick(onStartClicked);', startOwner);
      pushService('pollStartButton();', startOwner);

      pushHint(helpers, '// [Button Callback: START]', startOwner);
      helpers.push(makeLine('void onStartClicked() {', startOwner));
      if (hidBlk) {
        helpers.push(makeLine('  hidEnabled = !hidEnabled;', hidBlk.blockId));
        pushHint(helpers, '  // Safety: press START to enable/pause USB mouse & keyboard output', hidBlk.blockId);
      }
      if (toggleBlk) {
        helpers.push(makeLine(`  ${toggleVar} = !${toggleVar};`, toggleBlk.blockId));
      }
      if (fsmBlk && fsmStates.length >= 2) {
        pushHint(helpers, `  // TODO: Switch state (e.g. gameState = STATE_${fsmStates[1]};)`, startOwner);
      } else if (!hidBlk && !toggleBlk) {
        pushHint(helpers, '  // TODO: Action when START is clicked (e.g. start or reset)', startOwner);
      }
      helpers.push(makeLine('}', startOwner));
      helpers.push(makeLine('', startOwner));
    }

    if (needSelectCb) {
      const selOwner = btnBlk.blockId;
      pushInclude('#include <kcomp_button_select.h>', selOwner);
      if (!setupLines.some((l) => l.text.includes('initButtonSelect()'))) {
        pushSetup('initButtonSelect();', selOwner);
      }
      pushSetup('attachButtonSelectClick(onSelectClicked);', selOwner);
      pushService('pollSelectButton();', selOwner);

      pushHint(helpers, '// [Button Callback: SELECT]', selOwner);
      helpers.push(makeLine('void onSelectClicked() {', selOwner));
      if (gridBlk) {
        helpers.push(makeLine('  uint8_t row = getCursorRow();', selOwner));
        helpers.push(makeLine('  uint8_t col = getCursorCol();', selOwner));
        helpers.push(makeLine('  if (getGridCell(row, col) == 0) {', selOwner));
        pushHint(helpers, '    // TODO: Place piece -> setGridCell(row, col, 1);', selOwner);
        helpers.push(makeLine('  }', selOwner));
      } else {
        pushHint(helpers, '  // TODO: Action when SELECT is clicked (confirm / trigger)', selOwner);
      }
      helpers.push(makeLine('}', selOwner));
      helpers.push(makeLine('', selOwner));
    }
  }

  // --- K. Input Section Blocks (Single-Char Parser, 4-Way Joystick, IR Switch) ---
  if (parserBlk) {
    const bid = parserBlk.blockId;
    const src = resolveParserSource(parserBlk.config?.source);
    const chars = parseCharList(parserBlk.config?.chars);
    pushHint(inputSection, `// [Single-Char Parser: ${src} (array-free)]`, bid);

    if (src === 'cardkb') {
      inputSection.push(makeLine('Wire.requestFrom(CARDKB_ADDR, 1);', bid));
      inputSection.push(makeLine('if (Wire.available()) {', bid));
      inputSection.push(makeLine('  char cmd = Wire.read();', bid));
      inputSection.push(makeLine('  if (cmd != 0) {', bid));
      inputSection.push(makeLine('    switch (cmd) {', bid));
      chars.forEach((ch) => {
        inputSection.push(makeLine(`      case '${ch}':`, bid));
        pushHint(inputSection, `        // TODO: Handle key '${ch}'`, bid);
        inputSection.push(makeLine('        break;', bid));
      });
      inputSection.push(makeLine('    }', bid));
      inputSection.push(makeLine('  }', bid));
      inputSection.push(makeLine('}', bid));
    } else {
      const streamName = src === 'hc12' ? 'hc12' : (src === 'bt' ? 'btSerial' : 'Serial');
      inputSection.push(makeLine(`if (${streamName}.available()) {`, bid));
      inputSection.push(makeLine(`  char cmd = ${streamName}.read();`, bid));
      inputSection.push(makeLine('  switch (cmd) {', bid));
      chars.forEach((ch) => {
        inputSection.push(makeLine(`    case '${ch}':`, bid));
        pushHint(inputSection, `      // TODO: Handle command '${ch}'`, bid);
        inputSection.push(makeLine('      break;', bid));
      });
      inputSection.push(makeLine('  }', bid));
      inputSection.push(makeLine('}', bid));
    }
    inputSection.push(makeLine('', bid));
  }

  if (irBlk) {
    const bid = irBlk.blockId;
    pushHint(inputSection, '// [IR Remote Switch (21-Button NEC)]', bid);
    inputSection.push(makeLine('if (isIRAvailable()) {', bid));
    inputSection.push(makeLine('  uint32_t irCmd = getIRCommand();', bid));
    inputSection.push(makeLine('  switch (irCmd) {', bid));
    ['IR_BTN_POWER', 'IR_BTN_PLAY', 'IR_BTN_VOL_UP', 'IR_BTN_VOL_DOWN'].forEach((btnMacro) => {
      inputSection.push(makeLine(`    case ${btnMacro}:`, bid));
      pushHint(inputSection, `      // TODO: Action for ${btnMacro}`, bid);
      inputSection.push(makeLine('      break;', bid));
    });
    inputSection.push(makeLine('  }', bid));
    inputSection.push(makeLine('}', bid));
    inputSection.push(makeLine('', bid));
  }

  if (joyBlk) {
    const bid = joyBlk.blockId;
    const thr = clampInt(joyBlk.config?.threshold, 50, 480, 250);
    pushHint(inputSection, '// [4-Way Joystick (1 step per tilt)]', bid);
    inputSection.push(makeLine('int joyX = getJoystickXValue();', bid));
    inputSection.push(makeLine('int joyY = getJoystickYValue();', bid));
    inputSection.push(makeLine(`if (joyNeutral) {`, bid));
    inputSection.push(makeLine(`  if (joyY < -${thr}) {`, bid));
    inputSection.push(makeLine(gridBlk ? '    moveCursor(-1, 0);' : '    // TODO: UP action', bid));
    inputSection.push(makeLine('    joyNeutral = false;', bid));
    inputSection.push(makeLine(`  } else if (joyY > ${thr}) {`, bid));
    inputSection.push(makeLine(gridBlk ? '    moveCursor(1, 0);' : '    // TODO: DOWN action', bid));
    inputSection.push(makeLine('    joyNeutral = false;', bid));
    inputSection.push(makeLine(`  } else if (joyX < -${thr}) {`, bid));
    inputSection.push(makeLine(gridBlk ? '    moveCursor(0, -1);' : '    // TODO: LEFT action', bid));
    inputSection.push(makeLine('    joyNeutral = false;', bid));
    inputSection.push(makeLine(`  } else if (joyX > ${thr}) {`, bid));
    inputSection.push(makeLine(gridBlk ? '    moveCursor(0, 1);' : '    // TODO: RIGHT action', bid));
    inputSection.push(makeLine('    joyNeutral = false;', bid));
    inputSection.push(makeLine('  }', bid));
    inputSection.push(makeLine(`} else if (joyX > -${Math.round(thr * 0.6)} && joyX < ${Math.round(thr * 0.6)} && joyY > -${Math.round(thr * 0.6)} && joyY < ${Math.round(thr * 0.6)}) {`, bid));
    inputSection.push(makeLine('  joyNeutral = true;', bid));
    inputSection.push(makeLine('}', bid));
    inputSection.push(makeLine('', bid));
  }

  // --- L. Logic Section Blocks (One-Shot, FSM, Toggle, Interval Timers, Motor Sequence, HID Guard) ---
  for (const os of oneshotMeta) {
    const bid = os.blk.blockId;
    pushHint(logicSection, `// [One-Shot Timer: ${os.base}]`, bid);
    logicSection.push(makeLine(`if (${os.activeVar} && millis() - ${os.startVar} >= ${os.macro}) {`, bid));
    logicSection.push(makeLine(`  ${os.activeVar} = false;`, bid));
    if (fsmBlk && fsmStates.length >= 2 && os.base === 'splash') {
      logicSection.push(makeLine(`  gameState = STATE_${fsmStates[1]};`, bid));
    } else {
      pushHint(logicSection, `  // TODO: Action when ${os.base} timer finishes`, bid);
    }
    logicSection.push(makeLine('}', bid));
    logicSection.push(makeLine('', bid));
  }

  if (fsmBlk) {
    const bid = fsmBlk.blockId;
    pushHint(logicSection, '// [State Machine]', bid);
    logicSection.push(makeLine('switch (gameState) {', bid));
    fsmStates.forEach((st, idx) => {
      logicSection.push(makeLine(`  case STATE_${st}:`, bid));
      if (idx === 1 && timerMeta.length > 0) {
        // Place primary interval timer naturally inside the active state
        const tm = timerMeta[0];
        logicSection.push(makeLine(`    if (millis() - ${tm.varName} >= ${tm.macro}) {`, tm.blk.blockId));
        logicSection.push(makeLine(`      ${tm.varName} = millis();`, tm.blk.blockId));
        pushHint(logicSection, `      // TODO: Periodic action in STATE_${st} (every ${tm.ms} ms)`, tm.blk.blockId);
        logicSection.push(makeLine('    }', tm.blk.blockId));
      } else {
        pushHint(logicSection, `    // TODO: Logic for STATE_${st}`, bid);
      }
      logicSection.push(makeLine('    break;', bid));
    });
    logicSection.push(makeLine('}', bid));
    logicSection.push(makeLine('', bid));
  }

  if (toggleBlk) {
    const bid = toggleBlk.blockId;
    pushHint(logicSection, '// [Active / Pause Toggle]', bid);
    logicSection.push(makeLine(`if (${toggleVar}) {`, bid));
    pushHint(logicSection, '  // TODO: Code while ACTIVE', bid);
    logicSection.push(makeLine('} else {', bid));
    pushHint(logicSection, '  // TODO: Code while PAUSED / STANDBY', bid);
    logicSection.push(makeLine('}', bid));
    logicSection.push(makeLine('', bid));
  }

  // Emit remaining interval timers (or all timers if no FSM placed timer[0] inside a state)
  const startTimerIdx = (fsmBlk && fsmStates.length >= 2) ? 1 : 0;
  for (let i = startTimerIdx; i < timerMeta.length; i++) {
    const tm = timerMeta[i];
    const bid = tm.blk.blockId;
    pushHint(logicSection, `// [Interval Timer: ${tm.base} (${tm.ms} ms)]`, bid);
    logicSection.push(makeLine(`if (millis() - ${tm.varName} >= ${tm.macro}) {`, bid));
    logicSection.push(makeLine(`  ${tm.varName} = millis();`, bid));
    pushHint(logicSection, `  // TODO: Runs every ${tm.ms} ms without blocking delay()`, bid);
    logicSection.push(makeLine('}', bid));
    logicSection.push(makeLine('', bid));
  }

  if (motorBlk) {
    const bid = motorBlk.blockId;
    const steps = clampInt(motorBlk.config?.steps, 2, 8, 4);
    pushHint(logicSection, '// [Motor Step Sequence (non-blocking)]', bid);
    logicSection.push(makeLine('if (!isMotorBusy()) {', bid));
    logicSection.push(makeLine('  switch (driveStep) {', bid));
    for (let s = 0; s < steps; s++) {
      const nextStep = (s + 1) % steps;
      logicSection.push(makeLine(`    case ${s}:`, bid));
      pushHint(logicSection, s % 2 === 0 ? '      // TODO: e.g. driveForward(100, 1000);' : '      // TODO: e.g. turnRight(80, 500);', bid);
      logicSection.push(makeLine(`      driveStep = ${nextStep};`, bid));
      logicSection.push(makeLine('      break;', bid));
    }
    logicSection.push(makeLine('  }', bid));
    logicSection.push(makeLine('}', bid));
    logicSection.push(makeLine('', bid));
  }

  if (hidBlk) {
    const bid = hidBlk.blockId;
    pushHint(logicSection, '// [CH9329 Deadman Safety Guard]', bid);
    logicSection.push(makeLine('if (hidEnabled) {', bid));
    pushHint(logicSection, '  // TODO: Send moveMouse(dx, dy) / clickMouse() safely while enabled', bid);
    logicSection.push(makeLine('}', bid));
    logicSection.push(makeLine('', bid));
  }

  // --- M. Output Section Blocks (OLED Grid Full/Paged + Serial Debug Heartbeat) ---
  if (gridBlk) {
    const bid = gridBlk.blockId;
    pushHint(outputSection, `// [OLED Grid Engine (${state.oledPaged ? 'Paged' : 'Full'} mode)]`, bid);
    if (state.oledPaged) {
      outputSection.push(makeLine('firstPage();', bid));
      outputSection.push(makeLine('do {', bid));
      outputSection.push(makeLine('  renderGrid();', bid));
      pushHint(outputSection, '  // TODO: Draw HUD text here (no logic inside paging loop!)', bid);
      outputSection.push(makeLine('} while (nextPage());', bid));
    } else {
      outputSection.push(makeLine('clearDisplay();', bid));
      outputSection.push(makeLine('renderGrid();', bid));
      pushHint(outputSection, '  // TODO: Draw status text (setCursor / printText / printInt)', bid);
      outputSection.push(makeLine('updateDisplay();', bid));
    }
    outputSection.push(makeLine('', bid));
  } else if (evaBlk && isOnboardActive('onboard_oled')) {
    const bid = evaBlk.blockId;
    if (state.oledPaged) {
      outputSection.push(makeLine('firstPage();', bid));
      outputSection.push(makeLine('do {', bid));
      pushHint(outputSection, '  // TODO: Draw on OLED (Paged mode)', bid);
      outputSection.push(makeLine('} while (nextPage());', bid));
    } else {
      outputSection.push(makeLine('clearDisplay();', bid));
      pushHint(outputSection, '// TODO: Draw on OLED (setCursor / printText)', bid);
      outputSection.push(makeLine('updateDisplay();', bid));
    }
    outputSection.push(makeLine('', bid));
  }

  if (debugBlk) {
    const bid = debugBlk.blockId;
    pushHint(outputSection, '// [Serial Debug Heartbeat]', bid);
    outputSection.push(makeLine('if (millis() - lastDebugTime >= DEBUG_INTERVAL_MS) {', bid));
    outputSection.push(makeLine('  lastDebugTime = millis();', bid));
    pushHint(outputSection, '  // TODO: Serial.println(...); (clean output without flooding)', bid);
    outputSection.push(makeLine('}', bid));
    outputSection.push(makeLine('', bid));
  }

  // Trim trailing empty lines inside sections
  const trimEnd = (arr) => {
    while (arr.length && arr[arr.length - 1].text === '') arr.pop();
    return arr;
  };
  trimEnd(inputSection);
  trimEnd(logicSection);
  trimEnd(outputSection);
  trimEnd(helpers);

  // =========================================================================
  // 4. ASSEMBLE FINAL SKETCH LINES
  // =========================================================================
  const out = [];
  const dipSummary = dipStates.map((d) => `S1-${d.id}:${d.on ? 'ON' : 'OFF'}`).join(' ');
  // The name sits inside the header comment, so a "*/" or a line break in it
  // would end the comment early and break the sketch.
  const projTitle = getCleanProjectName().replace(/[\r\n\t]+/g, ' ').replace(/\*\//g, '* /');

  out.push(makeLine('/*'));
  if (projTitle) out.push(makeLine(` * Project: ${projTitle}`));
  out.push(makeLine(hasBlocks ? ` * ${board.shortName} Hardware Initialization + Program Structure` : ` * ${board.shortName} Hardware Initialization`));
  if (board.capabilities.hasDipSwitches && dipStates.length) {
    out.push(makeLine(` * DIP S1: ${dipSummary}`));
  } else {
    out.push(makeLine(` * Target: ${board.name} (${board.electrical.logicVoltage}V Logic) | Profile: ${activeProfile}`));
  }
  if (hasBlocks) {
    out.push(makeLine(` * Structure Blocks: ${blocks.map((b) => b.type.toUpperCase()).join(' | ')}`));
  }
  out.push(makeLine(' * Program halts (while (1);) if any module fails to initialize.'));
  out.push(makeLine(` * Generated with K-Comp Configurator ${APP_VERSION}`));
  out.push(makeLine(' */'));
  out.push(makeLine(''));

  if (includes.length) {
    out.push(...includes, makeLine(''));
  }
  if (defines.length) {
    out.push(...defines, makeLine(''));
  }
  if (globals.length) {
    out.push(...globals, makeLine(''));
  }
  if (helpers.length) {
    out.push(...helpers, makeLine(''));
  }

  // Optional EVA helper functions when [EVA Functions] block is active
  if (evaBlk) {
    const ebid = evaBlk.blockId;
    out.push(makeLine('void readInputs() {', ebid));
    if (inputSection.length) {
      inputSection.forEach((l) => out.push(makeLine(l.text ? '  ' + l.text : '', l.blockId || ebid)));
    } else {
      pushHint(out, '  // TODO: Read sensors & buttons here', ebid);
    }
    out.push(makeLine('}', ebid));
    out.push(makeLine('', ebid));

    out.push(makeLine('void updateLogic() {', ebid));
    if (logicSection.length) {
      logicSection.forEach((l) => out.push(makeLine(l.text ? '  ' + l.text : '', l.blockId || ebid)));
    } else {
      pushHint(out, '  // TODO: Process data, rules & timers here', ebid);
    }
    out.push(makeLine('}', ebid));
    out.push(makeLine('', ebid));

    out.push(makeLine('void renderOutputs() {', ebid));
    if (outputSection.length) {
      outputSection.forEach((l) => out.push(makeLine(l.text ? '  ' + l.text : '', l.blockId || ebid)));
    } else {
      pushHint(out, '  // TODO: Update display, LED, buzzer & actuators here', ebid);
    }
    out.push(makeLine('}', ebid));
    out.push(makeLine(''));
  }

  // setup()
  out.push(makeLine('void setup() {'));
  out.push(makeLine('  Serial.begin(115200);'));
  setupLines.forEach((l) => out.push(makeLine('  ' + l.text, l.blockId, l.hwId)));
  out.push(makeLine(board.mcu === 'atmega328p'
    ? '  Serial.println(F("All K-Comp V2 modules initialized."));'
    : `  Serial.println("All ${board.shortName} modules initialized.");`));
  out.push(makeLine('}'));
  out.push(makeLine(''));

  // loop()
  out.push(makeLine('void loop() {'));
  if (evaBlk) {
    const ebid = evaBlk.blockId;
    if (serviceLoop.length) {
      serviceLoop.forEach((l) => out.push(makeLine('  ' + l.text, l.blockId, l.hwId)));
      out.push(makeLine(''));
    }
    out.push(makeLine('  readInputs();', ebid));
    out.push(makeLine('  updateLogic();', ebid));
    out.push(makeLine('  renderOutputs();', ebid));
  } else if (hasBlocks) {
    let emittedAny = false;
    if (serviceLoop.length) {
      serviceLoop.forEach((l) => out.push(makeLine('  ' + l.text, l.blockId, l.hwId)));
      emittedAny = true;
    }
    if (inputSection.length) {
      if (emittedAny) out.push(makeLine(''));
      inputSection.forEach((l) => out.push(makeLine(l.text ? '  ' + l.text : '', l.blockId)));
      emittedAny = true;
    }
    if (logicSection.length) {
      if (emittedAny) out.push(makeLine(''));
      logicSection.forEach((l) => out.push(makeLine(l.text ? '  ' + l.text : '', l.blockId)));
      emittedAny = true;
    }
    if (outputSection.length) {
      if (emittedAny) out.push(makeLine(''));
      outputSection.forEach((l) => out.push(makeLine(l.text ? '  ' + l.text : '', l.blockId)));
      emittedAny = true;
    }
    if (!emittedAny) {
      out.push(makeLine('  // Add your logic here'));
    }
  } else {
    const combined = [...serviceLoop, ...hwCommentLoop];
    if (combined.length) {
      combined.forEach((l) => out.push(makeLine('  ' + l.text, l.blockId, l.hwId)));
    } else {
      out.push(makeLine('  // Add your logic here'));
    }
  }
  out.push(makeLine('}'));

  const plainText = out.map((l) => l.text).join('\n');
  return { lines: out, plainText };
}

export function buildSketchString(dipStates) {
  return buildSketchModel(dipStates).plainText;
}

export function renderSketchCode(dipStates) {
  const model = buildSketchModel(dipStates);
  state.latestSketch = model.plainText;
  const codeEl = $('#codeOutput code');
  if (!codeEl) return;

  // Render per-line spans with line numbers, Multi-Spot Hover Highlighting, TODO zones & jump anchors
  let seenInc = false;
  const html = model.lines.map((ln, idx) => {
    const inner = ln.text ? highlightCppCode(ln.text) : '';
    const cls = `code-line${ln.isTodo ? ' is-todo' : ''}${ln.hwId ? ' has-hw-link' : ''}`;
    const attr = ln.blockId ? ` data-block-id="${escapeHtml(ln.blockId)}"` : '';
    const hwAttr = ln.hwId ? ` data-hw-id="${escapeHtml(ln.hwId)}"` : '';
    const trimmed = (ln.text || '').trim();
    let jumpAttr = '';
    if (!seenInc && trimmed.startsWith('#include')) { seenInc = true; jumpAttr = ' data-jump="includes"'; }
    else if (trimmed.startsWith('void setup()')) { jumpAttr = ' data-jump="setup"'; }
    else if (trimmed.startsWith('void loop()')) { jumpAttr = ' data-jump="loop"'; }
    return `<span class="${cls}" data-ln="${idx + 1}"${attr}${hwAttr}${jumpAttr}>${inner}</span>`;
  }).join('\n');

  codeEl.innerHTML = html;
}

const CPP_KEYWORDS_RE = /^(?:void|int|bool|float|double|char|byte|long|short|unsigned|signed|const|static|struct|class|if|else|for|while|do|switch|case|default|break|continue|return|true|false|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t|uint|ulong|float_t)$/;

export function highlightCppCode(src) {
  const tokenRe = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(^[ \t]*#[a-zA-Z_]+)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(<[A-Za-z0-9_./-]+\.h>)|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?[fFuUlL]*\b)|(\b(?:void|int|bool|float|double|char|byte|long|short|unsigned|signed|const|static|struct|class|if|else|for|while|do|switch|case|default|break|continue|return|true|false|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t|uint|ulong|float_t)\b)|(\b(?:Serial|Wire|SoftwareSerial|RH_ASK|F|BMI160Data|GPSData|GPSCardinal|AS7343Data|GY302Mode|joystickState|GridRenderCallback|GridCursorCallback|[A-Za-z][A-Za-z0-9_]*_t)\b)|(\b[A-Z][A-Z0-9_]{2,}\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\())/gm;
  let out = '';
  let lastIdx = 0;
  let m;
  while ((m = tokenRe.exec(src)) !== null) {
    if (m.index > lastIdx) {
      out += escapeHtml(src.slice(lastIdx, m.index));
    }
    const txt = escapeHtml(m[0]);
    let cls = '';
    if (m[1]) cls = 'tok-com';
    else if (m[2]) cls = 'tok-prep';
    else if (m[3]) cls = 'tok-str';
    else if (m[4]) cls = 'tok-hdr';
    else if (m[5]) cls = 'tok-num';
    else if (m[6]) cls = 'tok-kw';
    else if (m[7]) cls = 'tok-type';
    else if (m[8]) cls = 'tok-const';
    else if (m[9]) cls = 'tok-fn';
    out += cls ? `<span class="${cls}">${txt}</span>` : txt;
    lastIdx = tokenRe.lastIndex;
  }
  if (lastIdx < src.length) {
    out += escapeHtml(src.slice(lastIdx));
  }
  return out;
}

// Highlights C/C++ function & macro prototypes including parameter variable names (.tok-var)
export function highlightCppSignature(sig) {
  const openIdx = sig.indexOf('(');
  const closeIdx = sig.lastIndexOf(')');
  if (openIdx === -1 || closeIdx <= openIdx) {
    return highlightCppCode(sig);
  }
  const head = highlightCppCode(sig.slice(0, openIdx));
  const paramStr = sig.slice(openIdx + 1, closeIdx);
  const tail = highlightCppCode(sig.slice(closeIdx + 1));

  if (!paramStr.trim()) {
    return `${head}()${tail}`;
  }

  const paramsHtml = paramStr.split(',').map((raw) => {
    const lead = raw.match(/^\s*/)[0];
    const trail = raw.match(/\s*$/)[0];
    const p = raw.trim();
    if (!p || p === 'void') return `${escapeHtml(lead)}${highlightCppCode(p)}${escapeHtml(trail)}`;

    // Highlight last identifier (the parameter variable name) as .tok-var unless it's a macro/keyword/number
    const vm = p.match(/^([\s\S]*?)([a-zA-Z_][a-zA-Z0-9_]*)(\[\])?(\s*=\s*[\s\S]+)?$/);
    if (!vm) return `${escapeHtml(lead)}${highlightCppCode(p)}${escapeHtml(trail)}`;

    const [, prefix, name, brackets = '', defVal = ''] = vm;
    const isMacroOrKw = /^[A-Z][A-Z0-9_]{2,}$/.test(name) || CPP_KEYWORDS_RE.test(name);
    const nameHtml = isMacroOrKw
      ? highlightCppCode(name)
      : `<span class="tok-var">${escapeHtml(name)}</span>`;
    return `${escapeHtml(lead)}${highlightCppCode(prefix)}${nameHtml}${escapeHtml(brackets)}${defVal ? highlightCppCode(defVal) : ''}${escapeHtml(trail)}`;
  }).join(',');

  return `${head}(${paramsHtml})${tail}`;
}
