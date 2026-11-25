// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Extensible Code Profile Registry & Driver Compatibility Engine
import type { BoardProfile, CodeProfileId, CodeProfileMeta, ComponentDef, DriverCompat, UartAssignment } from '../types';

export const CODE_PROFILES: Record<CodeProfileId, CodeProfileMeta> = {
  'kcomp-avr': {
    id: 'kcomp-avr',
    labelKey: 'codeProfile.kcompAvr',
    descKey: 'codeProfile.kcompAvrDesc',
    available: true,
    fileExt: '.ino'
  },
  'generic-scaffold': {
    id: 'generic-scaffold',
    labelKey: 'codeProfile.genericScaffold',
    descKey: 'codeProfile.genericScaffoldDesc',
    available: true,
    fileExt: '.ino'
  },
  'kcomp-portable': {
    id: 'kcomp-portable',
    labelKey: 'codeProfile.kcompPortable',
    descKey: 'codeProfile.kcompPortableDesc',
    available: true,
    beta: true,
    fileExt: '.ino'
  },
  'oss-standard': {
    id: 'oss-standard',
    labelKey: 'codeProfile.ossStandard',
    descKey: 'codeProfile.ossStandardDesc',
    available: false,
    fileExt: '.ino'
  },
  'bare-metal': {
    id: 'bare-metal',
    labelKey: 'codeProfile.bareMetal',
    descKey: 'codeProfile.bareMetalDesc',
    available: false,
    fileExt: '.c'
  },
  'python-node': {
    id: 'python-node',
    labelKey: 'codeProfile.pythonNode',
    descKey: 'codeProfile.pythonNodeDesc',
    available: false,
    fileExt: '.py'
  }
};

const ESP32_COMPAT_MAP: Record<string, DriverCompat> = {
  bmp280: 'portable-untested',
  aht10: 'portable-untested',
  max30102: 'portable-untested',
  gy302: 'portable-untested',
  paj7620u2: 'portable-untested',
  bmi160: 'portable-untested',
  as7343: 'portable-untested',
  as7331: 'portable-untested',
  sps30: 'portable-untested',
  vl53l1x: 'portable-untested',
  ina219: 'portable-untested',
  tcs34725: 'portable-untested',
  tb6612fng: 'portable-untested',
  drv2605l: 'portable-untested',
  pn532: 'portable-untested',
  cardkb: 'verified',
  'tft-gc9a01': 'verified',
  ad8232: 'verified',
  'dc-motor': 'verified',
  mq135: 'portable-untested',
  mq2: 'portable-untested',
  mq3: 'portable-untested',
  mq7: 'portable-untested',
  'soil-moisture': 'portable-untested',
  ky039: 'portable-untested',
  'vib-motor': 'portable-untested',
  ds18b20: 'portable-untested',
  hx711: 'portable-untested',
  'gy-neo6m': 'avr-only',
  ch9329: 'avr-only',
  as608: 'avr-only',
  ld2410c: 'avr-only',
  ld2450: 'avr-only',
  hc12: 'avr-only',
  hc05: 'avr-only',
  esp8266: 'avr-only',
  'sg90-180': 'avr-only',
  'sg90-360': 'avr-only',
  'hcsr04-sg90': 'avr-only',
  'ir-rx': 'avr-only',
  'ir-tx': 'avr-only',
  'rf433-tx': 'avr-only',
  'rf433-rx': 'avr-only',
  onboard_oled: 'avr-only',
  oled_grid: 'avr-only',
  onboard_joystick: 'avr-only',
  onboard_led: 'avr-only',
  onboard_pot: 'avr-only',
  onboard_start: 'avr-only',
  onboard_select: 'avr-only',
  onboard_buzzer: 'avr-only',
  onboard_distance: 'avr-only',
  onboard_wifi: 'verified',
  onboard_rgb_led: 'verified'
};

export function getDriverCompat(compKey: string, board: BoardProfile): DriverCompat {
  if (board.mcu === 'atmega328p') return 'verified';
  return ESP32_COMPAT_MAP[compKey] || 'portable-untested';
}

export function getSupportedProfiles(board: BoardProfile): CodeProfileMeta[] {
  return (board.supportedCodeProfiles || ['generic-scaffold'])
    .map((id) => CODE_PROFILES[id])
    .filter((m) => !!m && m.available);
}

export function normalizeCodeProfile(profileId: string | null | undefined, board: BoardProfile): CodeProfileId {
  if (profileId && board.supportedCodeProfiles.includes(profileId as CodeProfileId)) {
    return profileId as CodeProfileId;
  }
  return board.defaultCodeProfile;
}

function toMacroPrefix(id: string): string {
  return id.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export interface ResolvedComponentCode {
  includes: string[];
  defines: string[];
  globals: string[];
  setup: string[];
  loop: string[];
  usedFallback?: boolean;
  compat: DriverCompat;
}

export function buildGenericScaffoldForComponent(
  def: ComponentDef,
  inst: any,
  board: BoardProfile,
  suffixStr: string,
  uartAssign?: UartAssignment | null
): ResolvedComponentCode {
  const macroBase = `${toMacroPrefix(def.id)}${suffixStr}`;
  const includes: string[] = [];
  const defines: string[] = [];
  const globals: string[] = [];
  const setup: string[] = [];
  const loop: string[] = [];
  const compat = getDriverCompat(def.id, board);

  const getPinVal = (p: any): string => {
    const bpId = inst.pinMap?.[p.id];
    const meta = bpId ? board.pins[bpId] : null;
    return meta?.pinNum || bpId || '/* unassigned */';
  };

  if (def.id === 'dc-motor') {
    globals.push('// Drive DC motor via external H-bridge / TB6612FNG driver (never directly from GPIO)');
    return { includes, defines, globals, setup, loop, usedFallback: true, compat };
  }

  const appendActiveOptionalPins = (): void => {
    for (const p of def.pins) {
      if (p.tier !== 'optional') continue;
      if (!inst.pinMap?.[p.id]) continue;
      const pMacro = `${macroBase}_${toMacroPrefix(p.id)}_PIN`;
      defines.push(`#define ${pMacro} ${getPinVal(p)}`);
      if (p.role === 'INT') {
        setup.push(`pinMode(${pMacro}, INPUT_PULLUP); // Optional ${p.id} interrupt (${def.name})`);
      } else if (p.id === 'LED' || p.id === 'SET' || p.id === 'SDN' || p.role === 'PWM') {
        setup.push(`pinMode(${pMacro}, OUTPUT); // Optional ${p.id} control (${def.name})`);
      } else {
        setup.push(`pinMode(${pMacro}, INPUT); // Optional ${p.id} signal (${def.name})`);
      }
    }
  };

  if (def.interface === 'I2C') {
    includes.push('#include <Wire.h>');
    const addr = inst.i2cAddrOverride || def.i2cAddr || '0x00';
    const addrMacro = `${macroBase}_ADDR`;
    defines.push(`#define ${addrMacro} ${addr}`);
    setup.push(`Wire.beginTransmission(${addrMacro});`);
    setup.push(`if (Wire.endTransmission() != 0) {`);
    setup.push(`  Serial.println("${def.name} (${addr}) not found on I2C bus!");`);
    setup.push(`  while (1) { delay(10); }`);
    setup.push(`}`);
    appendActiveOptionalPins();
    loop.push(`// TODO: Read/control ${def.name} over I2C (${addrMacro})`);
    return { includes, defines, globals, setup, loop, usedFallback: true, compat };
  }

  if (def.interface === 'UART') {
    const rxPinSpec = def.pins.find((p) => p.role === 'UART_RX');
    const txPinSpec = def.pins.find((p) => p.role === 'UART_TX');
    const rxMacro = `${macroBase}_RX_PIN`;
    const txMacro = `${macroBase}_TX_PIN`;
    if (rxPinSpec) defines.push(`#define ${rxMacro} ${getPinVal(rxPinSpec)}`);
    if (txPinSpec) defines.push(`#define ${txMacro} ${getPinVal(txPinSpec)}`);

    const baud = uartAssign?.baud || (def.id === 'as608' ? 57600 : (def.id === 'ld2410c' || def.id === 'ld2450' ? 256000 : 9600));
    if (uartAssign && uartAssign.kind === 'sw') {
      const swObj = uartAssign.serialObj;
      includes.push('#include <SoftwareSerial.h> // EspSoftwareSerial (fallback beyond HW-UART1/2)');
      globals.push(`EspSoftwareSerial::UART ${swObj}; // SW-UART (${def.name})`);
      setup.push(`${swObj}.begin(${baud}, SWSERIAL_8N1, ${rxPinSpec ? rxMacro : '-1'}, ${txPinSpec ? txMacro : '-1'}); // ${def.name} (SW-UART)`);
      loop.push(`// if (${swObj}.available()) { uint8_t b = ${swObj}.read(); } // ${def.name} (SW-UART)`);
    } else {
      const serialObj = uartAssign?.serialObj || 'Serial1';
      setup.push(`${serialObj}.begin(${baud}, SERIAL_8N1, ${rxPinSpec ? rxMacro : '-1'}, ${txPinSpec ? txMacro : '-1'}); // ${def.name} (${uartAssign?.badgeLabel || 'HW-UART1'})`);
      loop.push(`// if (${serialObj}.available()) { uint8_t b = ${serialObj}.read(); } // ${def.name} (${uartAssign?.badgeLabel || 'HW-UART1'})`);
    }
    appendActiveOptionalPins();
    return { includes, defines, globals, setup, loop, usedFallback: true, compat };
  }

  const signalPins = def.pins.filter((p) =>
    p.tier !== 'optional' && p.tier !== 'config' && p.tier !== 'unused' &&
    !['GND', 'POWER_5V', 'POWER_3V3', 'RESET', 'I2C_VCC', 'I2C_GND', 'I2C_SCL', 'I2C_SDA', 'SLOT'].includes(p.role || '')
  );

  for (const p of signalPins) {
    const pMacro = `${macroBase}_${toMacroPrefix(p.id)}_PIN`;
    defines.push(`#define ${pMacro} ${getPinVal(p)}`);
    if (p.role === 'ANALOG') {
      setup.push(`pinMode(${pMacro}, INPUT); // 12-bit ADC (0..4095, max 3.3V!)`);
      loop.push(`// int raw_${toMacroPrefix(def.id).toLowerCase()} = analogRead(${pMacro});`);
    } else if (p.role === 'PWM') {
      setup.push(`pinMode(${pMacro}, OUTPUT); // PWM / LEDC output (${def.name})`);
      loop.push(`// analogWrite(${pMacro}, 128); // or LEDC / servo driver (${def.name})`);
    } else if (p.role === 'INT') {
      setup.push(`pinMode(${pMacro}, INPUT_PULLUP); // Interrupt input (use IRAM_ATTR ISR)`);
      loop.push(`// Handle interrupt event for ${def.name}`);
    } else {
      const mode = p.id === 'TRIG' || p.id === 'SCK' || (p.id === 'DATA' && def.id === 'rf433-tx') ? 'OUTPUT' : 'INPUT';
      setup.push(`pinMode(${pMacro}, ${mode}); // ${def.name} (${p.id})`);
    }
  }
  appendActiveOptionalPins();
  if (!loop.length) loop.push(`// TODO: Poll or drive ${def.name}`);
  return { includes, defines, globals, setup, loop, usedFallback: true, compat };
}
