// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// 3-Stage MCU Auto-Reset Cascade: MCP2221 WebHID (GP3 via S1-1, 1:1 EasyMCP2221 sequence) -> CDC DTR/RTS -> Manual RESET
import type { BoardResetStrategyId } from '../../types';
import {
  getNavigatorHid,
  type WebHidDeviceLike,
  type WebHidInputReportEvent,
  type WebHidNavigatorApi
} from './web-hid-types';
import {
  sleepAbortable,
  throwIfAborted,
  type FlashResetPreference,
  type ResetAttemptResult,
  type ResetContext,
  type ResetStrategy
} from './types';

export const MCP2221_VID = 0x04d8;
export const MCP2221_PID = 0x00dd;
export const MCP2221_REPORT_LEN = 64;

export interface Mcp2221PairResult {
  readonly ok: boolean;
  readonly deviceName?: string;
  readonly error?: string;
}

/** Returns true when the USB serial port is a Microchip MCP2221 / MCP2221A bridge. */
export function isMcp2221UsbPort(info: { usbVendorId?: number; usbProductId?: number }): boolean {
  return info.usbVendorId === MCP2221_VID && info.usbProductId === MCP2221_PID;
}

/** Checks whether the browser already holds a granted WebHID permission for the MCP2221 chip. */
export async function hasPairedMcp2221WebHid(
  hidApi?: WebHidNavigatorApi | null
): Promise<boolean> {
  const hid = hidApi !== undefined ? hidApi : getNavigatorHid();
  if (!hid) return false;
  try {
    const existing = await hid.getDevices();
    return existing.some((d) => d.vendorId === MCP2221_VID && d.productId === MCP2221_PID);
  } catch (_) {
    return false;
  }
}

/**
 * Opens Chrome/Edge's WebHID chooser SYNCHRONOUSLY inside a direct click handler
 * (zero preceding `await` calls so transient browser user activation is never lost).
 */
export async function requestMcp2221WebHidPairing(
  hidApi?: WebHidNavigatorApi | null
): Promise<Mcp2221PairResult> {
  const hid = hidApi !== undefined ? hidApi : getNavigatorHid();
  if (!hid) {
    return { ok: false, error: 'WebHID API is not available in this browser (use Chrome/Edge on localhost or HTTPS).' };
  }
  try {
    // IMPORTANT: Call requestDevice() before ANY await to preserve Chrome transient user activation!
    const granted = await hid.requestDevice({
      filters: [{ vendorId: MCP2221_VID, productId: MCP2221_PID }]
    });
    const dev = granted.find((d) => d.vendorId === MCP2221_VID && d.productId === MCP2221_PID);
    if (!dev) {
      return { ok: false, error: 'No MCP2221 HID device selected in browser dialog.' };
    }
    return { ok: true, deviceName: dev.productName || 'MCP2221 USB-I2C/UART' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return { ok: false, error: msg };
  }
}

/** Backwards-compatible boolean helper wrapping requestMcp2221WebHidPairing(). */
export async function preauthorizeMcp2221WebHid(
  hidApi?: WebHidNavigatorApi | null
): Promise<boolean> {
  const res = await requestMcp2221WebHidPairing(hidApi);
  return res.ok;
}

/** Builds MCP2221 64-byte Get SRAM Settings (0x61) HID report. */
export function buildMcp2221GetSramReport(): Uint8Array {
  const report = new Uint8Array(MCP2221_REPORT_LEN);
  report[0] = 0x61;
  return report;
}

/**
 * Builds MCP2221 64-byte Set SRAM Settings (0x60) HID report for GP3 while preserving GP0..GP2.
 * - `0x10`: GP3 GPIO Output HIGH (bit4=1, bit3=0 Output, bits2..0=000 GPIO)
 * - `0x08`: GP3 GPIO Input / Hi-Z (bit4=0, bit3=1 Input, bits2..0=000 GPIO — exact EasyMCP2221 GPIO_IN)
 */
export function buildMcp2221ConfigureGp3Report(gp0 = 0x00, gp1 = 0x00, gp2 = 0x00, gp3 = 0x10): Uint8Array {
  const report = new Uint8Array(MCP2221_REPORT_LEN);
  report[0] = 0x60; // Set SRAM Settings
  report[7] = 0x80; // Bit 7 = Alter GPIO configuration (GP0..GP3)
  report[8] = gp0 & 0xff;
  report[9] = gp1 & 0xff;
  report[10] = gp2 & 0xff;
  report[11] = gp3 & 0xff;
  return report;
}

/** Builds MCP2221 64-byte Set SRAM Settings (0x60) report setting GP3 back to GPIO_IN (0x08 Hi-Z). */
export function buildMcp2221ReleaseGp3SramInputReport(gp0 = 0x00, gp1 = 0x00, gp2 = 0x00): Uint8Array {
  return buildMcp2221ConfigureGp3Report(gp0, gp1, gp2, 0x08);
}

/** Builds MCP2221 64-byte Set GPIO Output Values (0x50) report targeting ONLY GP3. */
export function buildMcp2221SetGp3Report(high: boolean): Uint8Array {
  const report = new Uint8Array(MCP2221_REPORT_LEN);
  report[0] = 0x50; // Set GPIO Output Values
  report[14] = 0x01; // Alter GP3 output value
  report[15] = high ? 0x01 : 0x00;
  report[16] = 0x01; // Alter GP3 direction
  report[17] = 0x00; // Direction = Output
  return report;
}

/** Builds MCP2221 64-byte Set GPIO Values (0x50) report releasing GP3 to Input (Hi-Z). */
export function buildMcp2221ReleaseGp3InputReport(): Uint8Array {
  const report = new Uint8Array(MCP2221_REPORT_LEN);
  report[0] = 0x50; // Set GPIO Output Values
  report[16] = 0x01; // Alter GP3 direction
  report[17] = 0x01; // Direction = Input (High-Z)
  return report;
}

function readSingleHidReport(device: WebHidDeviceLike, timeoutMs: number): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    let settled = false;
    const onInput = (ev: WebHidInputReportEvent): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      device.removeEventListener('inputreport', onInput);
      const out = new Uint8Array(ev.data.byteLength);
      for (let i = 0; i < ev.data.byteLength; i++) out[i] = ev.data.getUint8(i);
      resolve(out);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      device.removeEventListener('inputreport', onInput);
      resolve(null);
    }, timeoutMs);
    device.addEventListener('inputreport', onInput);
  });
}

export interface Mcp2221TimingOptions {
  sramReadTimeoutMs?: number;
  configSettleMs?: number;
  resetLowMs?: number;
  resetHighMs?: number;
  bootloaderSettleMs?: number;
}

const DEFAULT_MCP2221_TIMING: Required<Mcp2221TimingOptions> = {
  sramReadTimeoutMs: 120,
  configSettleMs: 10,
  resetLowMs: 100,        // Exact match to kcomp_reset.py: time.sleep(0.1)
  resetHighMs: 10,
  bootloaderSettleMs: 260 // Allows ATmega328P crystal startup + Optiboot LED blink without RX FIFO overrun
};

/**
 * Executes the exact kcomp_reset.py (EasyMCP2221) GP3 reset sequence over WebHID:
 * 0x61 (read GP0..GP2) -> 0x60 (GP3 GPIO_OUT) -> 0x50 (GP3 LOW, 100 ms) -> 0x50 (GP3 HIGH) -> 0x60 (GP3 GPIO_IN / Hi-Z).
 */
export async function runMcp2221Gp3ResetPulse(
  dev: WebHidDeviceLike,
  timing: Required<Mcp2221TimingOptions> = DEFAULT_MCP2221_TIMING,
  signal?: AbortSignal
): Promise<void> {
  const wasOpen = dev.opened;
  try {
    if (!wasOpen) await dev.open();
    throwIfAborted(signal);

    // 1. Read existing GP0..GP2 SRAM designations so UART TX/RX LEDs stay untouched
    const replyPromise = readSingleHidReport(dev, timing.sramReadTimeoutMs);
    await dev.sendReport(0, buildMcp2221GetSramReport());
    const sramReply = await replyPromise;
    const gp0 = sramReply && sramReply.byteLength > 25 ? sramReply[22] : 0x00;
    const gp1 = sramReply && sramReply.byteLength > 25 ? sramReply[23] : 0x00;
    const gp2 = sramReply && sramReply.byteLength > 25 ? sramReply[24] : 0x00;

    // 2. Configure GP3 as GPIO_OUT (matches mcp.set_pin_function(gp3="GPIO_OUT"))
    await dev.sendReport(0, buildMcp2221ConfigureGp3Report(gp0, gp1, gp2, 0x10));
    await sleepAbortable(timing.configSettleMs, signal);

    // 3. Assert RESET LOW for 100 ms (matches mcp.GPIO_write(gp3=False); time.sleep(0.1))
    await dev.sendReport(0, buildMcp2221SetGp3Report(false));
    await sleepAbortable(timing.resetLowMs, signal);

    // 4. Release RESET HIGH then switch GP3 back to GPIO_IN / Hi-Z via 0x60 (exact EasyMCP2221 GPIO_IN)
    await dev.sendReport(0, buildMcp2221SetGp3Report(true));
    await sleepAbortable(timing.resetHighMs, signal);
    await dev.sendReport(0, buildMcp2221ReleaseGp3SramInputReport(gp0, gp1, gp2));
    await sleepAbortable(timing.bootloaderSettleMs, signal);
  } finally {
    if (!wasOpen && dev.opened) {
      try { await dev.close(); } catch (_) {}
    }
  }
}

/** Triggers an immediate GP3 reset pulse on an already-paired MCP2221 (used by the Monitor ↻ Reset button). */
export async function triggerPairedMcp2221Reset(
  hidApi?: WebHidNavigatorApi | null,
  timing?: Mcp2221TimingOptions
): Promise<{ triggered: boolean; note?: string }> {
  const hid = hidApi !== undefined ? hidApi : getNavigatorHid();
  if (!hid) return { triggered: false, note: 'WebHID unavailable' };
  const existing = await hid.getDevices();
  const dev = existing.find((d) => d.vendorId === MCP2221_VID && d.productId === MCP2221_PID);
  if (!dev) return { triggered: false, note: 'MCP2221 not paired yet — click 🔌 MCP2221-Reset first.' };
  const resolved: Required<Mcp2221TimingOptions> = {
    sramReadTimeoutMs: timing?.sramReadTimeoutMs ?? DEFAULT_MCP2221_TIMING.sramReadTimeoutMs,
    configSettleMs: timing?.configSettleMs ?? DEFAULT_MCP2221_TIMING.configSettleMs,
    resetLowMs: timing?.resetLowMs ?? DEFAULT_MCP2221_TIMING.resetLowMs,
    resetHighMs: timing?.resetHighMs ?? DEFAULT_MCP2221_TIMING.resetHighMs,
    bootloaderSettleMs: timing?.bootloaderSettleMs ?? 10
  };
  await runMcp2221Gp3ResetPulse(dev, resolved);
  return { triggered: true };
}

/**
 * Stage 1 (K-Comp V2): Native Browser WebHID Auto-Reset via Microchip MCP2221 GP3 (routed through S1-1).
 * Replaces external OS-specific Windows EXE / Linux Python helper scripts cleanly.
 */
export class Mcp2221WebHidResetter implements ResetStrategy {
  readonly id: BoardResetStrategyId = 'mcp2221-webhid';
  private readonly timing: Required<Mcp2221TimingOptions>;

  constructor(timing: Mcp2221TimingOptions = {}) {
    this.timing = {
      sramReadTimeoutMs: timing.sramReadTimeoutMs ?? DEFAULT_MCP2221_TIMING.sramReadTimeoutMs,
      configSettleMs: timing.configSettleMs ?? DEFAULT_MCP2221_TIMING.configSettleMs,
      resetLowMs: timing.resetLowMs ?? DEFAULT_MCP2221_TIMING.resetLowMs,
      resetHighMs: timing.resetHighMs ?? DEFAULT_MCP2221_TIMING.resetHighMs,
      bootloaderSettleMs: timing.bootloaderSettleMs ?? DEFAULT_MCP2221_TIMING.bootloaderSettleMs
    };
  }

  private resolveHid(ctx: ResetContext): WebHidNavigatorApi | null {
    return ctx.hidApi !== undefined ? ctx.hidApi : getNavigatorHid();
  }

  canRun(ctx: ResetContext): boolean {
    if (ctx.autoResetDipOff) return false;
    const info = typeof ctx.port.getInfo === 'function' ? ctx.port.getInfo() : {};
    return info.usbVendorId === undefined || isMcp2221UsbPort(info);
  }

  async trigger(ctx: ResetContext): Promise<ResetAttemptResult> {
    throwIfAborted(ctx.signal);
    const hid = this.resolveHid(ctx);
    if (!hid) {
      return {
        strategyId: this.id,
        triggered: false,
        requiresManualSyncWindow: true,
        note: 'WebHID API unavailable in this browser (use Chrome/Edge on localhost or HTTPS)'
      };
    }

    const existing = await hid.getDevices();
    let dev = existing.find((d) => d.vendorId === MCP2221_VID && d.productId === MCP2221_PID);
    if (!dev) {
      try {
        const granted = await hid.requestDevice({
          filters: [{ vendorId: MCP2221_VID, productId: MCP2221_PID }]
        });
        dev = granted.find((d) => d.vendorId === MCP2221_VID && d.productId === MCP2221_PID);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          strategyId: this.id,
          triggered: false,
          requiresManualSyncWindow: true,
          note: `MCP2221 not paired yet — click "🔌 MCP2221-Reset" once first (${msg})`
        };
      }
    }

    if (!dev) {
      return {
        strategyId: this.id,
        triggered: false,
        requiresManualSyncWindow: true,
        note: 'MCP2221 HID interface not paired — click "🔌 MCP2221-Reset" once first'
      };
    }

    await runMcp2221Gp3ResetPulse(dev, this.timing, ctx.signal);
    ctx.onLog?.('[FLASH] MCP2221 WebHID auto-reset pulse sent on GP3 (100 ms LOW -> HIGH -> GPIO_IN).', 'sys');
    return { strategyId: this.id, triggered: true, requiresManualSyncWindow: false };
  }
}

/** Stage 2: Classic USB-UART CDC DTR/RTS auto-reset (CH340 / CP210x / FTDI — skipped on MCP2221!). */
export class CdcDtrRtsResetter implements ResetStrategy {
  readonly id: BoardResetStrategyId;

  constructor(mode: 'cdc-dtr' | 'cdc-dtr-rts' = 'cdc-dtr') {
    this.id = mode;
  }

  canRun(ctx: ResetContext): boolean {
    if (ctx.autoResetDipOff) return false;
    if (typeof ctx.port.setSignals !== 'function') return false;
    const info = typeof ctx.port.getInfo === 'function' ? ctx.port.getInfo() : {};
    // MCP2221 does NOT wire CDC DTR/RTS to MCU RESET (auto-reset uses GP3 via WebHID)
    if (isMcp2221UsbPort(info)) return false;
    return true;
  }

  async trigger(ctx: ResetContext): Promise<ResetAttemptResult> {
    throwIfAborted(ctx.signal);
    if (typeof ctx.port.setSignals !== 'function') {
      return { strategyId: this.id, triggered: false, requiresManualSyncWindow: true, note: 'setSignals unsupported' };
    }

    if (this.id === 'cdc-dtr-rts') {
      await ctx.port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await sleepAbortable(100, ctx.signal);
      await ctx.port.setSignals({ dataTerminalReady: true, requestToSend: false });
      await sleepAbortable(150, ctx.signal);
    } else {
      await ctx.port.setSignals({ dataTerminalReady: false, requestToSend: false });
      await sleepAbortable(60, ctx.signal);
      await ctx.port.setSignals({ dataTerminalReady: true, requestToSend: true });
      await sleepAbortable(160, ctx.signal);
    }

    ctx.onLog?.(`[FLASH] USB-CDC DTR/RTS reset pulse sent (${this.id}).`, 'sys');
    return { strategyId: this.id, triggered: true, requiresManualSyncWindow: false };
  }
}

/** Stage 3: Always-available manual RESET button fallback (8-second bootloader sync window). */
export class ManualResetFallback implements ResetStrategy {
  readonly id: BoardResetStrategyId = 'manual';

  canRun(): boolean {
    return true;
  }

  async trigger(ctx: ResetContext): Promise<ResetAttemptResult> {
    throwIfAborted(ctx.signal);
    const msg = ctx.autoResetDipOff
      ? 'S1-1 Auto-Reset is OFF — press the board RESET button now to enter bootloader…'
      : 'Press the RESET button on the board now to sync with bootloader…';
    ctx.onProgress?.({ phase: 'reset', percent: 5, message: msg });
    ctx.onLog?.(`[FLASH] ${msg}`, 'sys');
    return { strategyId: this.id, triggered: true, requiresManualSyncWindow: true, note: msg };
  }
}

const DEFAULT_RESET_STRATEGIES: Readonly<Record<BoardResetStrategyId, ResetStrategy>> = {
  'mcp2221-webhid': new Mcp2221WebHidResetter(),
  'cdc-dtr': new CdcDtrRtsResetter('cdc-dtr'),
  'cdc-dtr-rts': new CdcDtrRtsResetter('cdc-dtr-rts'),
  manual: new ManualResetFallback()
};

export function resolveResetChain(
  boardChain: ReadonlyArray<BoardResetStrategyId>,
  preference: FlashResetPreference = 'auto',
  autoResetDipOff = false
): BoardResetStrategyId[] {
  if (preference === 'manual' || autoResetDipOff) {
    return ['manual'];
  }
  if (preference !== 'auto') {
    return [preference, 'manual'];
  }
  const chain: BoardResetStrategyId[] = boardChain.length ? [...boardChain] : ['manual'];
  if (!chain.includes('manual')) chain.push('manual');
  return chain;
}

/**
 * Runs the configured reset cascade, gracefully catching WebHID/USB permission denials
 * and falling through to the next available strategy down to ManualResetFallback.
 */
export async function executeResetCascade(
  ctx: ResetContext,
  preference: FlashResetPreference = 'auto',
  strategies: Readonly<Record<BoardResetStrategyId, ResetStrategy>> = DEFAULT_RESET_STRATEGIES
): Promise<ResetAttemptResult> {
  const order = resolveResetChain(ctx.flashProfile.resetChain, preference, ctx.autoResetDipOff);
  if (ctx.autoResetDipOff) {
    ctx.onLog?.('[FLASH] Pre-flight check: S1-1 Auto-Reset DIP is OFF — switching directly to manual RESET mode.', 'sys');
  }

  for (const id of order) {
    throwIfAborted(ctx.signal);
    const strat = strategies[id];
    if (!strat || !strat.canRun(ctx)) continue;
    try {
      const res = await strat.trigger(ctx);
      if (res.triggered) return res;
      if (res.note) ctx.onLog?.(`[FLASH] Reset strategy "${id}" skipped: ${res.note}`, 'sys');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      const msg = err instanceof Error ? err.message : String(err);
      ctx.onLog?.(`[FLASH] Reset strategy "${id}" failed (${msg}) — falling back…`, 'sys');
    }
  }

  return strategies.manual.trigger(ctx);
}
