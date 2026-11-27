// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Headless L0 Hardware Self-Test Spec Derivation & Standalone @KTEST Sketch Generator (Zero kcomp_*.h Dependencies)
import type {
  ActiveComponentInstance,
  BoardProfile,
  CatalogData,
  ComponentDef,
  DipSwitchState,
  ElectricalNetlist
} from '../types';
import {
  KTEST_PREFIX,
  formatHexAddr,
  parseHexAddr,
  type SelfTestActuatorCheck,
  type SelfTestDeadmanPin,
  type SelfTestDipRequirement,
  type SelfTestExpectedI2cDevice,
  type SelfTestPinCheck,
  type SelfTestSpec,
  type SelfTestUnconnectedPin
} from '../services/selftest-runner';

export interface BuildSelfTestSpecInput {
  board: BoardProfile;
  catalog: CatalogData;
  active: ReadonlyArray<ActiveComponentInstance>;
  onboard: Readonly<Record<string, boolean>>;
  dipStates: ReadonlyArray<DipSwitchState>;
  netlist: ElectricalNetlist;
}

const ACTUATOR_COMP_IDS = new Set(['sg90-180', 'sg90-360', 'hcsr04-sg90', 'vib-motor', 'ir-tx']);

/**
 * Translates a canonical board pin ID (e.g. "D5", "A0", "GPIO8") into a valid C/C++ pin expression.
 * Returns null for power/system pins that cannot be addressed as MCU GPIOs.
 */
export function boardPinToMcuExpr(boardPinId: string, board: BoardProfile): string | null {
  const pinMeta = board.pins[boardPinId];
  if (!pinMeta) return null;
  if (board.mcu === 'esp32s3') {
    const m = boardPinId.match(/^GPIO(\d+)$/i);
    if (m) return m[1];
    if (pinMeta.pinNum && /^\d+$/.test(pinMeta.pinNum)) return pinMeta.pinNum;
    return null;
  }
  // ATmega328P / K-Comp V2
  if (/^A[0-7]$/.test(boardPinId)) return boardPinId;
  const dm = boardPinId.match(/^D(\d+)$/);
  if (dm) return dm[1];
  return null;
}

function resolveInstanceI2cAddr(
  inst: ActiveComponentInstance,
  def: ComponentDef,
  active: ReadonlyArray<ActiveComponentInstance>
): number | null {
  if (!def.i2cAddr) return null;
  if (inst.i2cAddrOverride) {
    return parseHexAddr(inst.i2cAddrOverride);
  }
  if (inst.compId === 'tb6612fng') {
    const shields = active.filter((a) => a.compId === 'tb6612fng');
    const isSecond = shields.findIndex((a) => a.instanceId === inst.instanceId) === 1;
    return parseHexAddr(isSecond ? (def.secondI2cAddr || '0x2F') : def.i2cAddr);
  }
  return parseHexAddr(def.i2cAddr);
}

function collectAlternateAddresses(def: ComponentDef, primaryAddr: number): number[] {
  const alts = new Set<number>();
  if (def.i2cAddr) {
    const a = parseHexAddr(def.i2cAddr);
    if (a !== null && a !== primaryAddr) alts.add(a);
  }
  if (def.secondI2cAddr) {
    const a = parseHexAddr(def.secondI2cAddr);
    if (a !== null && a !== primaryAddr) alts.add(a);
  }
  for (const opt of def.i2cAddrOptions || []) {
    const a = parseHexAddr(opt.addr);
    if (a !== null && a !== primaryAddr) alts.add(a);
  }
  return Array.from(alts).sort((a, b) => a - b);
}

/**
 * Pure, DOM-free derivation of the expected Layer-0 hardware self-test specification
 * directly from the active BoardProfile, placed components, onboard toggles, DIP states & ElectricalNetlist.
 */
export function buildSelfTestSpec(input: BuildSelfTestSpecInput): SelfTestSpec {
  const { board, catalog, active, onboard, dipStates, netlist } = input;
  const compById = new Map<string, ComponentDef>(catalog.components.map((c) => [c.id, c]));

  const sdaPin = board.defaultI2cPins?.sda || (board.mcu === 'esp32s3' ? 'GPIO8' : 'A4');
  const sclPin = board.defaultI2cPins?.scl || (board.mcu === 'esp32s3' ? 'GPIO9' : 'A5');
  const sdaExpr = boardPinToMcuExpr(sdaPin, board) || (board.mcu === 'esp32s3' ? '8' : 'A4');
  const sclExpr = boardPinToMcuExpr(sclPin, board) || (board.mcu === 'esp32s3' ? '9' : 'A5');

  const expectedI2c: SelfTestExpectedI2cDevice[] = [];
  const inputPins: SelfTestPinCheck[] = [];
  const actuators: SelfTestActuatorCheck[] = [];
  const seenInputPins = new Set<string>();
  const seenActuatorPins = new Set<string>();

  const pushInputPin = (pin: SelfTestPinCheck): void => {
    if (seenInputPins.has(pin.boardPinId)) return;
    seenInputPins.add(pin.boardPinId);
    inputPins.push(pin);
  };

  const pushActuator = (act: SelfTestActuatorCheck): void => {
    if (seenActuatorPins.has(act.boardPinId)) return;
    seenActuatorPins.add(act.boardPinId);
    actuators.push(act);
  };

  // 1. Onboard peripherals (I2C, inputs, actuators)
  for (const ob of board.onboardPeripherals) {
    if (!onboard[ob.id]) continue;
    const obAddr = parseHexAddr(ob.i2cAddr);
    if (obAddr !== null) {
      expectedI2c.push({
        id: ob.id,
        label: ob.shortName || ob.name,
        address: obAddr,
        addressHex: formatHexAddr(obAddr),
        alternateAddresses: [],
        source: 'onboard'
      });
      continue;
    }

    if (ob.id === 'onboard_led') {
      const bp = ob.pins?.[0]?.pinId || 'D5';
      const expr = boardPinToMcuExpr(bp, board);
      if (expr) pushActuator({ boardPinId: bp, mcuPinExpr: expr, label: ob.shortName || ob.name, kind: 'led', source: 'onboard' });
    } else if (ob.id === 'onboard_buzzer') {
      const bp = ob.pins?.[0]?.pinId || 'D9';
      const expr = boardPinToMcuExpr(bp, board);
      if (expr) pushActuator({ boardPinId: bp, mcuPinExpr: expr, label: ob.shortName || ob.name, kind: 'buzzer', source: 'onboard' });
    } else if (ob.id === 'onboard_pot') {
      const bp = ob.pins?.[0]?.pinId || 'A0';
      const expr = boardPinToMcuExpr(bp, board);
      if (expr) pushInputPin({ boardPinId: bp, mcuPinExpr: expr, label: ob.shortName || ob.name, mode: 'analog', source: 'onboard' });
    } else if (ob.id === 'onboard_joystick') {
      for (const p of ob.pins || [{ pinId: 'A1', roleLabel: 'Joy X' }, { pinId: 'A2', roleLabel: 'Joy Y' }]) {
        const expr = boardPinToMcuExpr(p.pinId, board);
        if (expr) pushInputPin({ boardPinId: p.pinId, mcuPinExpr: expr, label: p.roleLabel || 'Joystick', mode: 'analog', source: 'onboard' });
      }
    } else if (ob.id === 'onboard_start' || ob.id === 'onboard_select') {
      const bp = ob.pins?.[0]?.pinId || (ob.id === 'onboard_start' ? 'D3' : 'D4');
      const expr = boardPinToMcuExpr(bp, board);
      if (expr) pushInputPin({ boardPinId: bp, mcuPinExpr: expr, label: ob.shortName || ob.name, mode: 'digital-pullup', source: 'onboard' });
    }
  }

  // 2. External components (I2C, wired analog/digital inputs, wired PWM actuators)
  for (const inst of active) {
    const def = compById.get(inst.compId);
    if (!def) continue;

    if (def.interface === 'I2C' && def.i2cAddr) {
      const addr = resolveInstanceI2cAddr(inst, def, active);
      if (addr !== null) {
        expectedI2c.push({
          id: inst.instanceId,
          label: def.friendlyName || def.name,
          address: addr,
          addressHex: formatHexAddr(addr),
          alternateAddresses: collectAlternateAddresses(def, addr),
          source: 'external',
          compId: def.id
        });
      }
      continue;
    }

    for (const pinSpec of def.pins) {
      const bpId = inst.pinMap[pinSpec.id];
      if (!bpId) continue;
      const role = pinSpec.role || '';
      if (role === 'GND' || role === 'POWER_5V' || role === 'POWER_3V3' || role === 'RESET' || role === 'SLOT') {
        continue;
      }
      if (role === 'UART_RX' || role === 'UART_TX') {
        continue;
      }
      const expr = boardPinToMcuExpr(bpId, board);
      if (!expr) continue;

      if (role === 'PWM' && ACTUATOR_COMP_IDS.has(def.id)) {
        pushActuator({
          boardPinId: bpId,
          mcuPinExpr: expr,
          label: `${def.friendlyName || def.name} (${pinSpec.id})`,
          kind: 'pwm',
          source: 'external'
        });
      } else if (role === 'ANALOG') {
        pushInputPin({
          boardPinId: bpId,
          mcuPinExpr: expr,
          label: `${def.friendlyName || def.name} (${pinSpec.id})`,
          mode: 'analog',
          source: 'external'
        });
      } else if (role === 'DIGITAL' || role === 'INT') {
        pushInputPin({
          boardPinId: bpId,
          mcuPinExpr: expr,
          label: `${def.friendlyName || def.name} (${pinSpec.id})`,
          mode: 'digital-in',
          source: 'external'
        });
      }
    }
  }

  // 3. Hardware deadman switch (K-Comp V2 START button on D3 unless D3 is claimed by an external module)
  let deadmanPin: SelfTestDeadmanPin | undefined;
  if (board.id === 'kcomp-v2') {
    const s1Start = dipStates.find((d) => d.id === 4);
    const d3BlockedExternally =
      Boolean(s1Start?.forcedOff) ||
      seenActuatorPins.has('D3') ||
      inputPins.some((p) => p.boardPinId === 'D3' && p.source === 'external');
    if (!d3BlockedExternally) {
      deadmanPin = {
        boardPinId: 'D3',
        mcuPinExpr: '3',
        label: 'START (D3)',
        activeLow: true
      };
    }
  }

  // 4. DIP switch requirements (e.g. S1-1 Auto-Reset ON, plus active onboard DIPs)
  const dipChecks: SelfTestDipRequirement[] = [];
  for (const dip of dipStates) {
    if (dip.lockedOn && !dip.on) {
      dipChecks.push({
        dipId: dip.id,
        name: dip.name,
        pin: dip.pin,
        expectedOn: true,
        actualOn: dip.on
      });
    } else if (dip.forcedOff && dip.on) {
      dipChecks.push({
        dipId: dip.id,
        name: dip.name,
        pin: dip.pin,
        expectedOn: false,
        actualOn: dip.on
      });
    }
  }

  // 5. Unconnected required pins from ElectricalNetlist
  const unconnectedPins: SelfTestUnconnectedPin[] = netlist.unconnectedPins.map((u) => {
    const def = compById.get(u.compId);
    return {
      compName: def?.friendlyName || def?.name || u.compId,
      compPinId: u.compPinId
    };
  });

  return {
    boardId: board.id,
    boardName: board.name,
    boardShortName: board.shortName,
    mcu: board.mcu,
    baudRate: board.targetMeta?.defaultBaud || 115200,
    i2cPins: { sda: sdaPin, scl: sclPin, sdaExpr, sclExpr },
    ...(deadmanPin ? { deadmanPin } : {}),
    expectedI2c,
    inputPins,
    actuators,
    dipChecks,
    unconnectedPins
  };
}

/**
 * Generates a 100% standalone, zero-library-dependency Layer-0 hardware diagnostic sketch
 * (uses only `<Wire.h>` and standard GPIO/ADC calls — no `kcomp_*.h` headers required).
 * Outputs structured `@KTEST {...}` JSON lines on boot and on `SCAN` / `ACT` serial commands.
 */
export function generateSelfTestSketch(spec: SelfTestSpec): string {
  const lines: string[] = [];
  const wireBeginStmt =
    spec.mcu === 'esp32s3'
      ? `Wire.begin(${spec.i2cPins.sdaExpr}, ${spec.i2cPins.sclExpr});`
      : 'Wire.begin();';

  lines.push(`// K-Comp Layer-0 Hardware Self-Test (${spec.boardName})`);
  lines.push('// Standalone diagnostic sketch: zero external kcomp_*.h dependencies.');
  lines.push(`// Protocol: ${KTEST_PREFIX} JSON @ ${spec.baudRate} baud | Commands: SCAN, ACT`);
  lines.push('#include <Wire.h>');
  lines.push('');

  if (spec.deadmanPin) {
    lines.push(`static const int KTEST_DEADMAN_PIN = ${spec.deadmanPin.mcuPinExpr}; // ${spec.deadmanPin.label}`);
  }
  lines.push('static unsigned long ktestLastActMs = 0;');
  lines.push('static const unsigned long KTEST_ACT_COOLDOWN_MS = 1500;');
  lines.push('');

  // Emit emitKTestReport(bool actTriggered)
  lines.push('void emitKTestReport(bool actTriggered) {');
  lines.push(`  Serial.print(F("${KTEST_PREFIX} {\\"v\\":1,\\"board\\":\\"${spec.boardId}\\",\\"i2c\\":["));`);
  lines.push('  bool firstAddr = true;');
  lines.push('  for (uint8_t addr = 0x03; addr <= 0x77; addr++) {');
  lines.push('    Wire.beginTransmission(addr);');
  lines.push('    if (Wire.endTransmission() == 0) {');
  lines.push("      if (!firstAddr) Serial.print(',');");
  lines.push('      Serial.print(addr);');
  lines.push('      firstAddr = false;');
  lines.push('    }');
  lines.push('  }');
  lines.push('  Serial.print(F("],\\"pins\\":{"));');

  spec.inputPins.forEach((pin, idx) => {
    const comma = idx > 0 ? ',' : '';
    const readExpr = pin.mode === 'analog' ? `analogRead(${pin.mcuPinExpr})` : `digitalRead(${pin.mcuPinExpr})`;
    lines.push(`  Serial.print(F("${comma}\\"${pin.boardPinId}\\":"));`);
    lines.push(`  Serial.print(${readExpr});`);
  });

  lines.push('  Serial.print(F("},\\"act\\":"));');
  lines.push('  Serial.print(actTriggered ? 1 : 0);');
  lines.push('  Serial.println(F("}"));');
  lines.push('}');
  lines.push('');

  // Safe actuator pulse helper (off at boot, capped with hard cooldown)
  lines.push('void runSafeActuatorPulse() {');
  lines.push('  unsigned long now = millis();');
  lines.push('  if (ktestLastActMs != 0 && (now - ktestLastActMs) < KTEST_ACT_COOLDOWN_MS) {');
  lines.push('    emitKTestReport(false);');
  lines.push('    return;');
  lines.push('  }');
  lines.push('  ktestLastActMs = now;');
  if (spec.actuators.length === 0) {
    lines.push('  emitKTestReport(false);');
  } else {
    for (const act of spec.actuators) {
      if (act.kind === 'buzzer') {
        lines.push(`  tone(${act.mcuPinExpr}, 880, 120); // ${act.label}`);
        lines.push('  delay(140);');
        lines.push(`  noTone(${act.mcuPinExpr});`);
      } else if (act.kind === 'led') {
        lines.push(`  digitalWrite(${act.mcuPinExpr}, HIGH); // ${act.label}`);
        lines.push('  delay(180);');
        lines.push(`  digitalWrite(${act.mcuPinExpr}, LOW);`);
      } else {
        lines.push(`  analogWrite(${act.mcuPinExpr}, 64); // ${act.label}`);
        lines.push('  delay(150);');
        lines.push(`  analogWrite(${act.mcuPinExpr}, 0);`);
      }
    }
    lines.push('  emitKTestReport(true);');
  }
  lines.push('}');
  lines.push('');

  // setup()
  lines.push('void setup() {');
  lines.push(`  Serial.begin(${spec.baudRate});`);
  if (spec.mcu === 'esp32s3') {
    lines.push('  delay(250);');
  }
  lines.push(`  ${wireBeginStmt}`);
  if (spec.deadmanPin) {
    lines.push(`  pinMode(KTEST_DEADMAN_PIN, ${spec.deadmanPin.activeLow ? 'INPUT_PULLUP' : 'INPUT'});`);
  }
  for (const pin of spec.inputPins) {
    if (pin.mode === 'digital-pullup') {
      lines.push(`  pinMode(${pin.mcuPinExpr}, INPUT_PULLUP); // ${pin.label}`);
    } else if (pin.mode === 'digital-in') {
      lines.push(`  pinMode(${pin.mcuPinExpr}, INPUT); // ${pin.label}`);
    }
  }
  for (const act of spec.actuators) {
    lines.push(`  pinMode(${act.mcuPinExpr}, OUTPUT); // ${act.label}`);
    lines.push(`  digitalWrite(${act.mcuPinExpr}, LOW);`);
  }
  lines.push('  delay(80);');
  lines.push('  emitKTestReport(false);');
  lines.push('}');
  lines.push('');

  // loop()
  lines.push('void loop() {');
  lines.push('  static char cmdBuf[16];');
  lines.push('  static uint8_t cmdLen = 0;');
  lines.push('  while (Serial.available() > 0) {');
  lines.push('    char c = (char)Serial.read();');
  lines.push("    if (c == '\\n' || c == '\\r') {");
  lines.push('      cmdBuf[cmdLen] = 0;');
  lines.push('      if (cmdLen > 0) {');
  lines.push('        if (strcmp(cmdBuf, "SCAN") == 0 || strcmp(cmdBuf, "scan") == 0) {');
  lines.push('          emitKTestReport(false);');
  lines.push('        } else if (strcmp(cmdBuf, "ACT") == 0 || strcmp(cmdBuf, "act") == 0) {');
  lines.push('          runSafeActuatorPulse();');
  lines.push('        }');
  lines.push('      }');
  lines.push('      cmdLen = 0;');
  lines.push('    } else if (cmdLen < sizeof(cmdBuf) - 1) {');
  lines.push('      cmdBuf[cmdLen++] = c;');
  lines.push('    }');
  lines.push('  }');
  if (spec.deadmanPin && spec.actuators.length > 0) {
    const activeExpr = spec.deadmanPin.activeLow
      ? 'digitalRead(KTEST_DEADMAN_PIN) == LOW'
      : 'digitalRead(KTEST_DEADMAN_PIN) == HIGH';
    lines.push(`  if (${activeExpr}) {`);
    lines.push('    runSafeActuatorPulse();');
    lines.push('  }');
  }
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}
