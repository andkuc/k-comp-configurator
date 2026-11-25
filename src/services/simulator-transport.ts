// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Hardware-Aware Demo Serial Transport (Includes 200 Hz ECG + Toggleable 50 Hz Mains Hum for Time & FFT Labs)
import type { BoardProfile, McuArchitecture } from '../types';
import {
  SerialPortStateMachine,
  type DeviceInfo,
  type DeviceTransport,
  type FlashProgress,
  type FlashProtocolId,
  type FlashSegment,
  type PortStateChangeEvent,
  type SerialPortState
} from './device-transport';

export interface SimulatorContextSnapshot {
  boardName: string;
  boardShortName: string;
  mcu: McuArchitecture;
  activeCompIds: string[];
  onboardIds: string[];
}

export class SimulatorTransport implements DeviceTransport {
  readonly id = 'simulator';
  private readonly stateMachine = new SerialPortStateMachine();
  private timer: ReturnType<typeof setInterval> | null = null;
  private tick = 0;
  private baudRate = 115200;
  private intervalMs: number;
  private contextProvider: () => SimulatorContextSnapshot;
  private lineListeners = new Set<(line: string) => void>();
  private byteListeners = new Set<(byteCount: number) => void>();
  private deviceInfo: DeviceInfo | null = null;
  private pausedByCommand = false;
  private ledOn = false;
  private ecgMainsHumEnabled = true;

  constructor(
    contextProvider: () => SimulatorContextSnapshot,
    intervalMs = 120
  ) {
    this.contextProvider = contextProvider;
    this.intervalMs = Math.max(20, intervalMs);
  }

  isSupported(): boolean {
    return true;
  }

  getState(): SerialPortState {
    return this.stateMachine.getState();
  }

  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo ? { ...this.deviceInfo } : null;
  }

  onStateChange(listener: (ev: PortStateChangeEvent) => void): () => void {
    return this.stateMachine.onStateChange(listener);
  }

  onBytesReceived(listener: (byteCount: number) => void): () => void {
    this.byteListeners.add(listener);
    return () => {
      this.byteListeners.delete(listener);
    };
  }

  onLine(listener: (line: string) => void): () => void {
    this.lineListeners.add(listener);
    return () => {
      this.lineListeners.delete(listener);
    };
  }

  private emitLine(line: string): void {
    const byteLen = line.length + 2;
    for (const fn of Array.from(this.byteListeners)) fn(byteLen);
    for (const fn of Array.from(this.lineListeners)) fn(line);
  }

  private isHighRateEcgMode(): boolean {
    return this.contextProvider().activeCompIds.includes('ad8232');
  }

  private buildNextTelemetryLine(sampleStepMs: number): string {
    const ctx = this.contextProvider();
    const tMs = Math.round(this.tick * sampleStepMs);
    const tSec = tMs / 1000;
    const comps = new Set(ctx.activeCompIds);
    const onboard = new Set(ctx.onboardIds);

    // 1. AD8232 ECG waveform (72 BPM = 1.2 Hz QRS + realistic toggleable 50 Hz mains hum, 200 Hz hardware clock)
    if (comps.has('ad8232')) {
      const phase = (tSec * 1.2) % 1;
      let mv = 512 + Math.sin(2 * Math.PI * 0.25 * tSec) * 8; // gentle respiration baseline wander
      if (phase > 0.14 && phase < 0.20) {
        mv += Math.sin(((phase - 0.14) / 0.06) * Math.PI) * 44; // P-wave
      } else if (phase >= 0.22 && phase < 0.245) {
        mv -= 58; // Q dip
      } else if (phase >= 0.245 && phase < 0.275) {
        mv += Math.sin(((phase - 0.245) / 0.03) * Math.PI) * 365; // sharp R peak
      } else if (phase >= 0.275 && phase < 0.305) {
        mv -= 88; // S dip
      } else if (phase >= 0.42 && phase < 0.56) {
        mv += Math.sin(((phase - 0.42) / 0.14) * Math.PI) * 92; // T-wave
      }
      if (this.ecgMainsHumEnabled) {
        mv += Math.sin(2 * Math.PI * 50 * tSec) * 24; // 50 Hz power-line interference (visible in FFT!)
      }
      return `t:${tMs}, ecg:${Math.round(mv)}`;
    }

    // 2. BMI160 3-axis accelerometer
    if (comps.has('bmi160')) {
      const ax = Math.sin(2 * Math.PI * 1.2 * tSec) * 0.45 + Math.sin(2 * Math.PI * 3.6 * tSec) * 0.12;
      const ay = Math.cos(2 * Math.PI * 0.9 * tSec) * 0.35;
      const az = 1.0 + Math.sin(2 * Math.PI * 2.1 * tSec) * 0.08;
      return `ax:${ax.toFixed(2)}, ay:${ay.toFixed(2)}, az:${az.toFixed(2)}`;
    }

    // 3. Environmental sensors (AHT10 / BMP280 / DS18B20)
    if (comps.has('aht10') || comps.has('bmp280') || comps.has('ds18b20')) {
      const temp = 22.8 + Math.sin(tSec * 0.4) * 1.6;
      if (comps.has('aht10')) {
        const hum = 48.5 + Math.cos(tSec * 0.3) * 4.2;
        return `temp:${temp.toFixed(1)}, hum:${hum.toFixed(1)}`;
      }
      if (comps.has('bmp280')) {
        const hpa = 1013.2 + Math.sin(tSec * 0.25) * 1.8;
        return `temp:${temp.toFixed(1)}, hPa:${hpa.toFixed(1)}`;
      }
      return `temp:${temp.toFixed(2)}`;
    }

    // 4. Light sensor / Distance / MQ gas sensors
    if (comps.has('gy302')) {
      const lux = 320 + Math.sin(tSec * 0.9) * 180;
      return `lux:${Math.max(0, Math.round(lux))}`;
    }
    if (comps.has('vl53l1x') || onboard.has('onboard_distance')) {
      const mm = 280 + Math.sin(tSec * 1.3) * 160;
      return `dist_mm:${Math.max(20, Math.round(mm))}`;
    }
    if (comps.has('mq2') || comps.has('mq135') || comps.has('mq3') || comps.has('mq7')) {
      const ppm = 240 + Math.sin(tSec * 0.7) * 95 + Math.cos(tSec * 2.1) * 18;
      return `gas_raw:${Math.max(0, Math.round(ppm))}`;
    }

    // 5. Onboard joystick / pot or clean 2-channel reference telemetry
    if (onboard.has('onboard_joystick')) {
      const vx = Math.round(512 + Math.sin(tSec * 1.6) * 420);
      const vy = Math.round(512 + Math.cos(tSec * 1.2) * 420);
      return `joyX:${vx}, joyY:${vy}`;
    }
    if (onboard.has('onboard_pot')) {
      const pot = Math.round(512 + Math.sin(tSec * 0.8) * 490);
      return `pot:${pot}`;
    }

    const s1 = 50 + Math.sin(2 * Math.PI * 1.0 * tSec) * 35;
    const s2 = 50 + Math.cos(2 * Math.PI * 2.5 * tSec) * 28;
    return `sigA:${s1.toFixed(1)}, sigB:${s2.toFixed(1)}`;
  }

  /** Emits one deterministic sample immediately (useful in unit tests). */
  stepOnce(): string {
    const stepMs = this.isHighRateEcgMode() ? 5 : this.intervalMs;
    const line = this.buildNextTelemetryLine(stepMs);
    this.tick++;
    this.emitLine(line);
    return line;
  }

  async connect(baudRate: number): Promise<DeviceInfo> {
    if (this.stateMachine.getState() !== 'disconnected' && this.stateMachine.getState() !== 'error') {
      await this.disconnect();
    }
    this.baudRate = baudRate;
    this.tick = 0;
    this.pausedByCommand = false;
    this.stateMachine.transition('connecting');

    const ctx = this.contextProvider();
    const ecgMode = this.isHighRateEcgMode();
    const info: DeviceInfo = {
      portLabel: `Demo Simulator (${ctx.boardShortName})`,
      baudRate
    };
    this.deviceInfo = info;
    this.stateMachine.transition('monitoring');

    this.emitLine(`[SIM] ${ctx.boardName} connected at ${baudRate} baud.`);
    if (ecgMode) {
      this.emitLine('[SIM] AD8232 ECG demo @ 200 Hz (72 BPM + 50 Hz mains hum). Send HUM to toggle 50 Hz noise!');
    } else {
      this.emitLine('[SIM] Commands: HELP, STATUS, LED, PAUSE, RESUME, RESET');
    }

    if (ecgMode) {
      // Emit 4 samples at 5 ms spacing every 20 ms -> exact jitter-free 200 Hz ECG stream!
      this.timer = setInterval(() => {
        if (this.pausedByCommand) return;
        for (let k = 0; k < 4; k++) {
          this.stepOnce();
        }
      }, 20);
    } else {
      const tickMs = this.intervalMs === 120 ? 50 : this.intervalMs;
      this.intervalMs = tickMs;
      this.timer = setInterval(() => {
        if (!this.pausedByCommand) {
          this.stepOnce();
        }
      }, tickMs);
    }

    return info;
  }

  async disconnect(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.stateMachine.getState() === 'monitoring' && this.stateMachine.canTransition('releasing')) {
      this.stateMachine.transition('releasing');
    }
    this.deviceInfo = null;
    if (this.stateMachine.canTransition('disconnected')) {
      this.stateMachine.transition('disconnected');
    }
  }

  async writeText(text: string): Promise<void> {
    if (this.stateMachine.getState() !== 'monitoring') {
      throw new Error('Simulator is not connected.');
    }
    const clean = text.trim();
    const upper = clean.toUpperCase();
    if (!clean) return;

    if (upper === 'HELP' || upper === '?') {
      this.emitLine('[SIM] Available commands: HELP, STATUS, LED, HUM, PAUSE, RESUME, RESET, or any single char.');
    } else if (upper === 'STATUS') {
      const ctx = this.contextProvider();
      this.emitLine(`[SIM] Board=${ctx.boardShortName} MCU=${ctx.mcu} Modules=${ctx.activeCompIds.length} LED=${this.ledOn ? 'ON' : 'OFF'} HUM50=${this.ecgMainsHumEnabled ? 'ON' : 'OFF'}`);
    } else if (upper === 'LED') {
      this.ledOn = !this.ledOn;
      this.emitLine(`[SIM] Onboard LED -> ${this.ledOn ? 'ON' : 'OFF'}`);
    } else if (upper === 'HUM') {
      this.ecgMainsHumEnabled = !this.ecgMainsHumEnabled;
      this.emitLine(`[SIM] 50 Hz mains hum -> ${this.ecgMainsHumEnabled ? 'ON (unshielded)' : 'OFF (filtered)'}`);
    } else if (upper === 'PAUSE' || upper === 'X') {
      this.pausedByCommand = true;
      this.emitLine('[SIM] Telemetry stream paused (send RESUME or S to continue).');
    } else if (upper === 'RESUME' || upper === 'S') {
      this.pausedByCommand = false;
      this.emitLine('[SIM] Telemetry stream resumed.');
    } else if (upper === 'RESET') {
      await this.resetBoard();
    } else {
      this.emitLine(`[SIM] RX "${clean}" -> ACK`);
    }
  }

  async resetBoard(): Promise<void> {
    if (this.stateMachine.getState() !== 'monitoring') return;
    this.tick = 0;
    this.pausedByCommand = false;
    const ctx = this.contextProvider();
    this.emitLine(`--- [${ctx.boardShortName} RESET @ ${this.baudRate} baud] ---`);
  }

  async flash(
    _protocol: FlashProtocolId,
    _segments: FlashSegment[],
    _onProgress?: (p: FlashProgress) => void
  ): Promise<void> {
    throw new Error('Flashing is not applicable to the demo simulator.');
  }
}

export function buildSimulatorContextFromBoard(
  board: BoardProfile,
  activeCompIds: string[],
  onboardMap: Record<string, boolean>
): SimulatorContextSnapshot {
  return {
    boardName: board.name,
    boardShortName: board.shortName,
    mcu: board.mcu,
    activeCompIds: [...activeCompIds],
    onboardIds: Object.entries(onboardMap).filter(([, on]) => Boolean(on)).map(([id]) => id)
  };
}
