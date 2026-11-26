// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Phase v0.4.5-a Suite: FirmwareArtifact, Intel HEX, MCP2221 WebHID Reset, STK500v1 Loopback, Port Lease & UI
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ESP32_S3_DEVKIT_BOARD, KCOMP_V2_BOARD, setActiveBoard } from '../boards';
import { CATALOG } from '../catalog';
import { state, getActiveOnboardDefs } from '../core/state';
import { initI18n } from '../i18n';
import {
  CRC_EOP,
  DeviceSessionController,
  MCP2221_PID,
  MCP2221_VID,
  Mcp2221WebHidResetter,
  STK_ENTER_PROGMODE,
  STK_GET_SYNC,
  STK_INSYNC,
  STK_LEAVE_PROGMODE,
  STK_LOAD_ADDRESS,
  STK_OK,
  STK_PROG_PAGE,
  STK_READ_PAGE,
  STK_READ_SIGN,
  Stk500v1Flasher,
  createIHexArtifact,
  deviceSession,
  executeResetCascade,
  flashStrategyRegistry,
  identifyUsbSerialChip,
  parseIntelHex,
  requestMcp2221WebHidPairing,
  resolveResetChain,
  sliceSegmentsIntoPages,
  type WebHidDeviceLike,
  type WebHidInputReportEvent,
  type WebHidNavigatorApi,
  type WebSerialNavigatorApi,
  type WebSerialPortLike
} from '../services';
import { projectStore } from '../store';
import { initWorkspaceShell, resetWorkspaceShell, setActiveWorkspace } from '../workspaces';

/** Builds a valid Intel HEX record line with exact 2's complement checksum. */
function makeHexRecord(addr: number, recType: number, data: number[]): string {
  const byteCount = data.length;
  const hi = (addr >>> 8) & 0xff;
  const lo = addr & 0xff;
  const all = [byteCount, hi, lo, recType, ...data];
  const sum = all.reduce((a, b) => a + b, 0);
  const cks = (-sum) & 0xff;
  return ':' + [...all, cks].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join('');
}

function makeSampleHex(length = 200): string {
  const lines: string[] = [];
  for (let addr = 0; addr < length; addr += 16) {
    const chunk: number[] = [];
    const n = Math.min(16, length - addr);
    for (let i = 0; i < n; i++) chunk.push((addr + i * 7 + 3) & 0xff);
    lines.push(makeHexRecord(addr, 0x00, chunk));
  }
  lines.push(':00000001FF');
  return lines.join('\n');
}

/** Deterministic in-memory Optiboot / STK500v1 virtual MCU backing a mock WebSerialPortLike. */
function createMockOptibootSerial(opts: {
  signature?: [number, number, number];
  corruptVerifyByteAt?: number;
  vendorId?: number;
  productId?: number;
  initialMonitorLines?: string[];
  requiredBaud?: number;
  leadingGlitchBytes?: number[];
} = {}) {
  const sig = opts.signature ?? [0x1e, 0x95, 0x0f];
  const flashMem = new Uint8Array(32768).fill(0xff);
  const encoder = new TextEncoder();
  let curByteAddr = 0;
  let openCount = 0;
  let requestPortCount = 0;
  let openBaudHistory: number[] = [];
  let activeBaud = 115200;
  let glitchSent = false;
  let inBootloaderMode = false;
  let rxBuf: number[] = [];
  let readableController: ReadableStreamDefaultController<Uint8Array> | null = null;
  let readableStream: ReadableStream<Uint8Array> | null = null;
  let writableStream: WritableStream<Uint8Array> | null = null;

  const enqueueReply = (bytes: number[]): void => {
    readableController?.enqueue(new Uint8Array(bytes));
  };

  const processBootloaderRx = (): void => {
    while (rxBuf.length > 0) {
      const cmd = rxBuf[0];
      if (cmd === STK_GET_SYNC || cmd === STK_ENTER_PROGMODE || cmd === STK_LEAVE_PROGMODE) {
        if (rxBuf.length < 2) return;
        const eop = rxBuf[1];
        rxBuf.splice(0, 2);
        if (eop === CRC_EOP) enqueueReply([STK_INSYNC, STK_OK]);
      } else if (cmd === STK_READ_SIGN) {
        if (rxBuf.length < 2) return;
        const eop = rxBuf[1];
        rxBuf.splice(0, 2);
        if (eop === CRC_EOP) enqueueReply([STK_INSYNC, sig[0], sig[1], sig[2], STK_OK]);
      } else if (cmd === STK_LOAD_ADDRESS) {
        if (rxBuf.length < 4) return;
        const lo = rxBuf[1];
        const hi = rxBuf[2];
        const eop = rxBuf[3];
        rxBuf.splice(0, 4);
        curByteAddr = ((hi << 8) | lo) << 1;
        if (eop === CRC_EOP) enqueueReply([STK_INSYNC, STK_OK]);
      } else if (cmd === STK_PROG_PAGE) {
        if (rxBuf.length < 4) return;
        const len = (rxBuf[1] << 8) | rxBuf[2];
        if (rxBuf.length < 4 + len + 1) return;
        const pageData = rxBuf.slice(4, 4 + len);
        const eop = rxBuf[4 + len];
        rxBuf.splice(0, 4 + len + 1);
        for (let i = 0; i < len; i++) {
          flashMem[curByteAddr + i] = pageData[i];
        }
        if (eop === CRC_EOP) enqueueReply([STK_INSYNC, STK_OK]);
      } else if (cmd === STK_READ_PAGE) {
        if (rxBuf.length < 5) return;
        const len = (rxBuf[1] << 8) | rxBuf[2];
        const eop = rxBuf[4];
        rxBuf.splice(0, 5);
        if (eop === CRC_EOP) {
          const out = [STK_INSYNC];
          for (let i = 0; i < len; i++) {
            const abs = curByteAddr + i;
            let val = flashMem[abs];
            if (opts.corruptVerifyByteAt !== undefined && abs === opts.corruptVerifyByteAt) {
              val ^= 0xff;
            }
            out.push(val);
          }
          out.push(STK_OK);
          enqueueReply(out);
        }
      } else {
        rxBuf.shift();
      }
    }
  };

  const port: WebSerialPortLike = {
    get readable() {
      return readableStream;
    },
    get writable() {
      return writableStream;
    },
    getInfo() {
      return {
        usbVendorId: opts.vendorId ?? MCP2221_VID,
        usbProductId: opts.productId ?? MCP2221_PID
      };
    },
    async open(openOpts) {
      openCount++;
      activeBaud = openOpts.baudRate;
      openBaudHistory.push(openOpts.baudRate);
      rxBuf = [];
      readableStream = new ReadableStream<Uint8Array>({
        start(controller) {
          readableController = controller;
          if (!inBootloaderMode && opts.initialMonitorLines?.length && openCount === 1) {
            for (const l of opts.initialMonitorLines) {
              controller.enqueue(encoder.encode(l));
            }
          }
          if (inBootloaderMode && !glitchSent && opts.leadingGlitchBytes?.length) {
            glitchSent = true;
            controller.enqueue(new Uint8Array(opts.leadingGlitchBytes));
          }
        }
      });
      writableStream = new WritableStream<Uint8Array>({
        write(chunk) {
          if (inBootloaderMode && (opts.requiredBaud === undefined || activeBaud === opts.requiredBaud)) {
            for (let i = 0; i < chunk.byteLength; i++) rxBuf.push(chunk[i]);
            processBootloaderRx();
          }
        }
      });
    },
    async close() {
      try { readableController?.close(); } catch (_) {}
      readableController = null;
      readableStream = null;
      writableStream = null;
    },
    async setSignals() {
      inBootloaderMode = true;
    }
  };

  const api: WebSerialNavigatorApi = {
    async requestPort() {
      requestPortCount++;
      return port;
    },
    async getPorts() {
      return [port];
    }
  };

  return {
    port,
    api,
    flashMem,
    setBootloaderMode: (v: boolean) => { inBootloaderMode = v; },
    getRequestPortCount: () => requestPortCount,
    getOpenBaudHistory: () => [...openBaudHistory]
  };
}

function createMockMcp2221Hid(gp0 = 0x02, gp1 = 0x02, gp2 = 0x01) {
  const sentReports: Uint8Array[] = [];
  const listeners = new Set<(ev: WebHidInputReportEvent) => void>();
  let opened = false;

  const device: WebHidDeviceLike = {
    get opened() { return opened; },
    vendorId: MCP2221_VID,
    productId: MCP2221_PID,
    productName: 'MCP2221 USB-I2C/UART Combo',
    async open() { opened = true; },
    async close() { opened = false; },
    async sendReport(_reportId, data) {
      const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data);
      sentReports.push(bytes);
      if (bytes[0] === 0x61) {
        const reply = new Uint8Array(64);
        reply[0] = 0x61;
        reply[22] = gp0;
        reply[23] = gp1;
        reply[24] = gp2;
        const ev: WebHidInputReportEvent = {
          device,
          reportId: 0,
          data: new DataView(reply.buffer)
        };
        queueMicrotask(() => {
          for (const fn of Array.from(listeners)) fn(ev);
        });
      }
    },
    addEventListener(_type, listener) { listeners.add(listener); },
    removeEventListener(_type, listener) { listeners.delete(listener); }
  };

  const hidApi: WebHidNavigatorApi = {
    async getDevices() { return [device]; },
    async requestDevice() { return [device]; }
  };

  return { hidApi, sentReports, isOpened: () => opened };
}

function setupDeviceDom(boardId = 'kcomp-v2') {
  initI18n();
  resetWorkspaceShell();
  projectStore.reset();
  const board = setActiveBoard(boardId);
  state.boardId = board.id;
  state.codeProfile = board.defaultCodeProfile;
  state.carrierEnabled = Boolean(board.carrier?.defaultEnabled);
  state.catalog = CATALOG;
  state.active = [];
  state.codeBlocks = [];
  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) state.onboard[ob.id] = false;
  if (board.capabilities.hasWirelessSlot) state.onboard.onboard_wireless = false;

  state.svgCache.clear();
  for (const comp of CATALOG.components) {
    state.svgCache.set(comp.svgFile, document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  }

  document.body.innerHTML = `
    <nav id="workspaceSwitchSlot"></nav>
    <section id="workspaceStage" class="workspace-stage hidden"></section>
    <main id="workspace" class="workspace"></main>`;
}

describe('Declarative BoardFlashProfile, Intel HEX Parser & Page Slicer (v0.4.5-a)', () => {
  it('declares flashProfile on K-Comp V2 and ESP32-S3 and identifies MCP2221 VID/PID', () => {
    expect(KCOMP_V2_BOARD.flashProfile?.protocol).toBe('stk500v1');
    expect(KCOMP_V2_BOARD.flashProfile?.signature).toEqual([0x1e, 0x95, 0x0f]);
    expect(KCOMP_V2_BOARD.flashProfile?.resetChain).toEqual(['mcp2221-webhid', 'cdc-dtr', 'manual']);
    expect(KCOMP_V2_BOARD.flashProfile?.autoResetDipSwitchId).toBe(1);

    expect(ESP32_S3_DEVKIT_BOARD.flashProfile?.protocol).toBe('esptool');
    expect(ESP32_S3_DEVKIT_BOARD.flashProfile?.defaultAppOffset).toBe(0x10000);

    expect(identifyUsbSerialChip(MCP2221_VID, MCP2221_PID)).toContain('MCP2221');
  });

  it('parses valid Intel HEX (including Extended Linear 0x04), slices 128 B 0xFF-padded pages, and rejects bad checksums/EOF', () => {
    const hex = [
      makeHexRecord(0x0000, 0x04, [0x00, 0x00]),
      makeHexRecord(0x0000, 0x00, [0x0c, 0x94, 0x34, 0x00]),
      makeHexRecord(0x0004, 0x00, [0xaa, 0xbb]),
      makeHexRecord(0x0100, 0x00, [0xde, 0xad]),
      ':00000001FF'
    ].join('\n');

    const parsed = parseIntelHex(hex);
    expect(parsed.totalBytes).toBe(8);
    expect(parsed.segments).toHaveLength(2);
    expect(parsed.segments[0].offset).toBe(0);
    expect(Array.from(parsed.segments[0].data)).toEqual([0x0c, 0x94, 0x34, 0x00, 0xaa, 0xbb]);
    expect(parsed.segments[1].offset).toBe(0x100);

    const pages = sliceSegmentsIntoPages(parsed.segments, 128, 0xff);
    expect(pages).toHaveLength(2);
    expect(pages[0].address).toBe(0);
    expect(pages[0].data.byteLength).toBe(128);
    expect(pages[0].data[0]).toBe(0x0c);
    expect(pages[0].data[6]).toBe(0xff);
    expect(pages[1].address).toBe(256);
    expect(pages[1].data[0]).toBe(0xde);

    // Checksum error rejected
    expect(() => parseIntelHex(':040000000C943400FF\n:00000001FF')).toThrow(/checksum/i);
    // Missing EOF rejected
    expect(() => parseIntelHex(makeHexRecord(0x0000, 0x00, [0x01, 0x02]))).toThrow(/EOF/i);
    // Overlapping address range rejected
    const overlapHex = [
      makeHexRecord(0x0000, 0x00, [0x01, 0x02, 0x03, 0x04]),
      makeHexRecord(0x0002, 0x00, [0x05, 0x06]),
      ':00000001FF'
    ].join('\n');
    expect(() => parseIntelHex(overlapHex)).toThrow(/Overlapping/i);
  });
});

describe('3-Stage Reset Cascade: MCP2221 WebHID -> CDC DTR -> Manual RESET (v0.4.5-a)', () => {
  it('reads existing GP0..GP2 via 0x61, configures GP3 output via 0x60, and pulses GP3 LOW -> HIGH via 0x50', async () => {
    const mockSerial = createMockOptibootSerial();
    const mockHid = createMockMcp2221Hid(0x02, 0x03, 0x01);
    const resetter = new Mcp2221WebHidResetter({
      sramReadTimeoutMs: 40,
      configSettleMs: 1,
      resetLowMs: 2,
      bootloaderSettleMs: 2
    });

    const ctx = {
      port: mockSerial.port,
      flashProfile: KCOMP_V2_BOARD.flashProfile!,
      autoResetDipOff: false,
      hidApi: mockHid.hidApi
    };

    expect(resetter.canRun(ctx)).toBe(true);
    const res = await resetter.trigger(ctx);
    expect(res.triggered).toBe(true);
    expect(res.strategyId).toBe('mcp2221-webhid');
    expect(res.requiresManualSyncWindow).toBe(false);
    expect(mockHid.isOpened()).toBe(false); // closed cleanly after reset pulse

    expect(mockHid.sentReports).toHaveLength(5);
    expect(mockHid.sentReports[0][0]).toBe(0x61); // Get SRAM
    expect(mockHid.sentReports[1][0]).toBe(0x60); // Set SRAM
    expect(mockHid.sentReports[1][7]).toBe(0x80); // Alter GPIO config flag
    expect(mockHid.sentReports[1][8]).toBe(0x02); // GP0 preserved
    expect(mockHid.sentReports[1][9]).toBe(0x03); // GP1 preserved
    expect(mockHid.sentReports[1][10]).toBe(0x01); // GP2 preserved
    expect(mockHid.sentReports[1][11]).toBe(0x10); // GP3 GPIO Output HIGH
    expect(mockHid.sentReports[2][0]).toBe(0x50); // Set GPIO Output
    expect(mockHid.sentReports[2][14]).toBe(0x01);
    expect(mockHid.sentReports[2][15]).toBe(0x00); // GP3 LOW
    expect(mockHid.sentReports[3][0]).toBe(0x50);
    expect(mockHid.sentReports[3][15]).toBe(0x01); // GP3 HIGH
    expect(mockHid.sentReports[4][0]).toBe(0x60); // Set SRAM -> GPIO_IN (exact kcomp_reset.py parity!)
    expect(mockHid.sentReports[4][7]).toBe(0x80); // Alter GPIO config flag
    expect(mockHid.sentReports[4][8]).toBe(0x02); // GP0 preserved
    expect(mockHid.sentReports[4][9]).toBe(0x03); // GP1 preserved
    expect(mockHid.sentReports[4][10]).toBe(0x01); // GP2 preserved
    expect(mockHid.sentReports[4][11]).toBe(0x08); // GP3 released to GPIO_IN (Hi-Z)
  });

  it('bypasses auto-reset immediately when S1-1 DIP pre-flight check reports OFF and falls back on WebHID denial', async () => {
    expect(resolveResetChain(['mcp2221-webhid', 'cdc-dtr', 'manual'], 'auto', true)).toEqual(['manual']);

    const mockSerial = createMockOptibootSerial();
    const deniedHid: WebHidNavigatorApi = {
      async getDevices() { return []; },
      async requestDevice() { throw new Error('User denied WebHID permission'); }
    };
    const logs: string[] = [];

    // S1-1 OFF -> straight to manual RESET without touching HID or CDC
    const s1OffRes = await executeResetCascade({
      port: mockSerial.port,
      flashProfile: KCOMP_V2_BOARD.flashProfile!,
      autoResetDipOff: true,
      hidApi: deniedHid,
      onLog: (m) => logs.push(m)
    });
    expect(s1OffRes.strategyId).toBe('manual');
    expect(s1OffRes.requiresManualSyncWindow).toBe(true);
    expect(logs.some((l) => l.includes('S1-1'))).toBe(true);

    // WebHID denied on MCP2221 skips fake CDC DTR (no DTR reset pin!) and falls straight to 8 s Manual RESET
    const mcpFallbackRes = await executeResetCascade({
      port: mockSerial.port,
      flashProfile: KCOMP_V2_BOARD.flashProfile!,
      autoResetDipOff: false,
      hidApi: deniedHid,
      onLog: (m) => logs.push(m)
    });
    expect(mcpFallbackRes.strategyId).toBe('manual');
    expect(mcpFallbackRes.requiresManualSyncWindow).toBe(true);

    // Non-MCP2221 bridge (e.g. CH340) uses CDC DTR cleanly
    const ch340Serial = createMockOptibootSerial({ vendorId: 0x1a86, productId: 0x7523 });
    const cdcRes = await executeResetCascade({
      port: ch340Serial.port,
      flashProfile: KCOMP_V2_BOARD.flashProfile!,
      autoResetDipOff: false,
      hidApi: deniedHid,
      onLog: (m) => logs.push(m)
    });
    expect(cdcRes.strategyId).toBe('cdc-dtr');
    expect(cdcRes.triggered).toBe(true);

    // requestMcp2221WebHidPairing calls requestDevice() directly without preceding getDevices() and surfaces errors
    let getDevicesCalled = false;
    let requestDeviceCalled = false;
    const directHid: WebHidNavigatorApi = {
      async getDevices() { getDevicesCalled = true; return []; },
      async requestDevice() {
        requestDeviceCalled = true;
        throw new Error('Blocked by browser policy');
      }
    };
    const pairErr = await requestMcp2221WebHidPairing(directHid);
    expect(getDevicesCalled).toBe(false);
    expect(requestDeviceCalled).toBe(true);
    expect(pairErr.ok).toBe(false);
    expect(pairErr.error).toContain('Blocked by browser policy');
  });
});

describe('Stk500v1Flasher Protocol Loopback & Error Guards (v0.4.5-a)', () => {
  it('programs and verifies 128-byte pages against a virtual Optiboot MCU and catches signature & verify mismatches', async () => {
    const sampleHex = makeSampleHex(200);
    const artifact = createIHexArtifact(sampleHex, 'blink.hex', 'kcomp-v2');
    const flasher = new Stk500v1Flasher({
      syncTimeoutAutoMs: 600,
      syncTimeoutManualMs: 600,
      commandTimeoutMs: 400,
      syncRetryDelayMs: 60,
      syncConfirmSettleMs: 5
    });

    expect(flashStrategyRegistry.resolve(KCOMP_V2_BOARD, artifact)?.id).toBe('stk500v1');
    expect(flashStrategyRegistry.resolve(ESP32_S3_DEVKIT_BOARD, artifact)).toBeNull();

    const mock = createMockOptibootSerial();
    mock.setBootloaderMode(true);
    const phases: string[] = [];

    const res = await flasher.flash(mock.port, KCOMP_V2_BOARD, artifact, {
      verify: true,
      resetPreference: 'manual',
      onProgress: (p) => phases.push(p.phase)
    });

    expect(res.ok).toBe(true);
    expect(res.verified).toBe(true);
    expect(res.bytesWritten).toBe(256); // 2 pages of 128 bytes
    expect(res.chipSignature).toBe('0x1E 0x95 0x0F');
    expect(phases).toContain('sync');
    expect(phases).toContain('write');
    expect(phases).toContain('verify');

    // Verify exact bytes landed in virtual ATmega328P flash memory
    for (let i = 0; i < 200; i++) {
      expect(mock.flashMem[i]).toBe(artifact.segments[0].data[i]);
    }
    for (let i = 200; i < 256; i++) {
      expect(mock.flashMem[i]).toBe(0xff);
    }

    // Wrong MCU signature must fail loudly before erasing/writing flash
    const wrongSigMock = createMockOptibootSerial({ signature: [0x1e, 0x98, 0x01] });
    wrongSigMock.setBootloaderMode(true);
    await expect(
      flasher.flash(wrongSigMock.port, KCOMP_V2_BOARD, artifact, { resetPreference: 'manual' })
    ).rejects.toThrow(/signature mismatch/i);

    // Corrupted read-back byte must trigger verify failure
    const corruptMock = createMockOptibootSerial({ corruptVerifyByteAt: 135 });
    corruptMock.setBootloaderMode(true);
    await expect(
      flasher.flash(corruptMock.port, KCOMP_V2_BOARD, artifact, { verify: true, resetPreference: 'manual' })
    ).rejects.toThrow(/verify mismatch/i);
  });

  it('recovers from leading reset-glitch bytes during sync and falls back automatically from 115200 to 57600 baud', async () => {
    const artifact = createIHexArtifact(makeSampleHex(64), 'glitch-57600.hex', 'kcomp-v2');
    const flasher = new Stk500v1Flasher({
      syncTimeoutAutoMs: 320,
      syncTimeoutManualMs: 320,
      commandTimeoutMs: 400,
      syncRetryDelayMs: 60,
      syncConfirmSettleMs: 5
    });

    // 1. Leading 0x00 + ASCII noise before [0x14, 0x10] still syncs at 115200 baud
    const glitchMock = createMockOptibootSerial({
      requiredBaud: 115200,
      leadingGlitchBytes: [0x00, 0xfe, 0x4f, 0x4b]
    });
    glitchMock.setBootloaderMode(true);
    const res1 = await flasher.flash(glitchMock.port, KCOMP_V2_BOARD, artifact, { resetPreference: 'manual' });
    expect(res1.ok).toBe(true);
    expect(glitchMock.getOpenBaudHistory()).toEqual([115200]);

    // 2. Old 57600-baud ATmega328P bootloader -> 115200 times out cleanly, 57600 fallback succeeds!
    const oldBootMock = createMockOptibootSerial({ requiredBaud: 57600 });
    oldBootMock.setBootloaderMode(true);
    const res2 = await flasher.flash(oldBootMock.port, KCOMP_V2_BOARD, artifact, { resetPreference: 'manual' });
    expect(res2.ok).toBe(true);
    expect(oldBootMock.getOpenBaudHistory()).toEqual([115200, 57600]);
  });

  it('avoids ATmega328P 2-byte USART RX FIFO overrun during Optiboot 300 ms LED-blink startup (default timing)', async () => {
    // Emulates real Optiboot hardware: during 300 ms LED blink, USART only buffers 2 FIFO bytes + 1 shift byte;
    // receiving > 2 bytes before blink finishes leaves a stray 0x20 that causes verifySpace() 16 ms WDT suicide!
    let blinkDone = false;
    let suicide = false;
    let fifo: number[] = [];
    let shiftByte: number | null = null;
    let readableCtrl: ReadableStreamDefaultController<Uint8Array> | null = null;
    let readableStream: ReadableStream<Uint8Array> | null = null;
    let writableStream: WritableStream<Uint8Array> | null = null;
    const rxBuf: number[] = [];
    const sig = [0x1e, 0x95, 0x0f];

    const processOptiboot = (): void => {
      while (rxBuf.length > 0 && !suicide) {
        const cmd = rxBuf[0];
        if (cmd === STK_GET_SYNC || cmd === STK_ENTER_PROGMODE || cmd === STK_LEAVE_PROGMODE) {
          if (rxBuf.length < 2) return;
          const eop = rxBuf[1];
          rxBuf.splice(0, 2);
          if (eop !== CRC_EOP) { suicide = true; return; }
          readableCtrl?.enqueue(new Uint8Array([STK_INSYNC, STK_OK]));
        } else if (cmd === STK_READ_SIGN) {
          if (rxBuf.length < 2) return;
          const eop = rxBuf[1];
          rxBuf.splice(0, 2);
          if (eop !== CRC_EOP) { suicide = true; return; }
          readableCtrl?.enqueue(new Uint8Array([STK_INSYNC, sig[0], sig[1], sig[2], STK_OK]));
        } else if (cmd === STK_LOAD_ADDRESS) {
          if (rxBuf.length < 4) return;
          const eop = rxBuf[3];
          rxBuf.splice(0, 4);
          if (eop !== CRC_EOP) { suicide = true; return; }
          readableCtrl?.enqueue(new Uint8Array([STK_INSYNC, STK_OK]));
        } else if (cmd === STK_PROG_PAGE) {
          if (rxBuf.length < 4) return;
          const len = (rxBuf[1] << 8) | rxBuf[2];
          if (rxBuf.length < 4 + len + 1) return;
          const eop = rxBuf[4 + len];
          rxBuf.splice(0, 4 + len + 1);
          if (eop !== CRC_EOP) { suicide = true; return; }
          readableCtrl?.enqueue(new Uint8Array([STK_INSYNC, STK_OK]));
        } else {
          // Unknown command (such as stray overrun 0x20!) -> verifySpace() checks next byte == CRC_EOP or suicides!
          if (rxBuf.length < 2) return;
          const nextB = rxBuf[1];
          rxBuf.splice(0, 2);
          if (nextB !== CRC_EOP) { suicide = true; return; }
          readableCtrl?.enqueue(new Uint8Array([STK_INSYNC, STK_OK]));
        }
      }
    };

    const port: WebSerialPortLike = {
      get readable() { return readableStream; },
      get writable() { return writableStream; },
      getInfo() { return { usbVendorId: MCP2221_VID, usbProductId: MCP2221_PID }; },
      async open() {
        blinkDone = false;
        suicide = false;
        fifo = [];
        shiftByte = null;
        rxBuf.length = 0;
        readableStream = new ReadableStream<Uint8Array>({
          start(c) { readableCtrl = c; }
        });
        writableStream = new WritableStream<Uint8Array>({
          write(chunk) {
            for (let i = 0; i < chunk.byteLength; i++) {
              const b = chunk[i];
              if (!blinkDone) {
                if (fifo.length < 2) fifo.push(b);
                else shiftByte = b; // Hardware AVR shift-register overrun!
              } else {
                rxBuf.push(b);
              }
            }
            if (blinkDone) processOptiboot();
          }
        });
        // Optiboot wakes up from 3-blink startup LED after 280 ms
        setTimeout(() => {
          blinkDone = true;
          rxBuf.push(...fifo);
          if (shiftByte !== null) rxBuf.push(shiftByte);
          fifo = [];
          shiftByte = null;
          processOptiboot();
        }, 280);
      },
      async close() {
        try { readableCtrl?.close(); } catch (_) {}
        readableStream = null;
        writableStream = null;
      }
    };

    const artifact = createIHexArtifact(makeSampleHex(32), 'optiboot-fifo.hex', 'kcomp-v2');
    // Use REAL default Stk500v1Flasher timings (360 ms poll interval)!
    const defaultFlasher = new Stk500v1Flasher();
    const res = await defaultFlasher.flash(port, KCOMP_V2_BOARD, artifact, {
      verify: false,
      resetPreference: 'manual'
    });
    expect(suicide).toBe(false);
    expect(res.ok).toBe(true);
    expect(res.chipSignature).toBe('0x1E 0x95 0x0F');
  });
});

describe('Exclusive Port-Lease in DeviceSessionController & Device Workspace UI (v0.4.5-a)', () => {
  beforeEach(async () => {
    await deviceSession.resetForTests();
    setupDeviceDom('kcomp-v2');
  });

  afterEach(async () => {
    await deviceSession.resetForTests();
    resetWorkspaceShell();
    document.body.innerHTML = '';
  });

  it('suspends Web Serial monitor -> flashes via STK500v1 -> resumes monitor on the SAME SerialPort handle (only 1 requestPort call)', async () => {
    const mock = createMockOptibootSerial({ initialMonitorLines: ['Boot OK\n'] });
    const session = new DeviceSessionController(200, 100);
    const seenStates: string[] = [];
    session.subscribe((snap) => {
      if (seenStates[seenStates.length - 1] !== snap.portState) {
        seenStates.push(snap.portState);
      }
    });

    await session.connectWebSerial(9600, { serialApi: mock.api });
    expect(session.isConnected()).toBe(true);
    expect(mock.getRequestPortCount()).toBe(1);

    mock.setBootloaderMode(true);
    const artifact = createIHexArtifact(makeSampleHex(64), 'lab1.hex', 'kcomp-v2');
    const flasher = new Stk500v1Flasher({ syncTimeoutManualMs: 500, commandTimeoutMs: 400, syncRetryDelayMs: 50, syncConfirmSettleMs: 5 });

    const res = await session.flashArtifact(artifact, KCOMP_V2_BOARD, {
      strategy: flasher,
      resetPreference: 'manual',
      verify: true
    });

    expect(res.ok).toBe(true);
    expect(mock.getRequestPortCount()).toBe(1); // Zero second port-picker dialog!
    expect(mock.getOpenBaudHistory()).toEqual([9600, 115200, 9600]); // monitor -> upload -> monitor!
    expect(session.isConnected()).toBe(true);
    expect(seenStates).toContain('releasing');
    expect(seenStates).toContain('flashing');
    expect(seenStates).toContain('reconnecting');
    expect(seenStates[seenStates.length - 1]).toBe('monitoring');

    await session.disconnect();
  });

  it('runs SimulatorFlasher through exclusive lease & updates Device Workspace flash UI cleanly', async () => {
    initWorkspaceShell();
    setActiveWorkspace('device');

    const stage = document.getElementById('workspaceStage')!;
    expect(stage.querySelector('#btnDevFlashFile')).not.toBeNull();
    expect(stage.querySelector('#devResetModeSelect')).not.toBeNull();
    expect(stage.querySelector('#devFlashBanner')?.classList.contains('hidden')).toBe(true);

    // Connect simulator on K-Comp V2 and run SimulatorFlasher through deviceSession
    stage.querySelector<HTMLButtonElement>('#btnDevSim')!.click();
    await new Promise((r) => setTimeout(r, 80));
    expect(deviceSession.isConnected()).toBe(true);

    const artifact = createIHexArtifact(makeSampleHex(48), 'demo.hex', 'kcomp-v2');
    const res = await deviceSession.flashArtifact(artifact, KCOMP_V2_BOARD, {
      simStepDelayMs: 5,
      verify: true
    });

    expect(res.ok).toBe(true);
    expect(res.strategyId).toBe('simulator-flasher');
    expect(res.bytesWritten).toBe(48);
    expect(deviceSession.isConnected()).toBe(true);
    expect(deviceSession.exportLogText()).toContain('Flashed demo.hex');
  });

  it('aborts an in-flight flash cleanly via cancelFlash() and restores monitor state without leaking locks', async () => {
    const session = new DeviceSessionController(200, 100);
    await session.connectSimulator(() => ({
      boardName: KCOMP_V2_BOARD.name,
      boardShortName: KCOMP_V2_BOARD.shortName,
      mcu: 'atmega328p',
      activeCompIds: [],
      onboardIds: []
    }), 115200, 40);

    const artifact = createIHexArtifact(makeSampleHex(64), 'abort.hex', 'kcomp-v2');
    const flashPromise = session.flashArtifact(artifact, KCOMP_V2_BOARD, {
      simStepDelayMs: 40,
      verify: true
    });

    setTimeout(() => session.cancelFlash(), 25);
    await expect(flashPromise).rejects.toThrow(/aborted/i);
    expect(session.getSnapshot().flashActive).toBe(false);
    expect(session.isConnected()).toBe(true);
    await session.disconnect();
  });

  it('keeps all new src/services/flash/*.ts modules 100% DOM-free (zero document.* access)', () => {
    const flashFiles = [
      'src/services/flash/types.ts',
      'src/services/flash/web-hid-types.ts',
      'src/services/flash/intel-hex.ts',
      'src/services/flash/reset-strategies.ts',
      'src/services/flash/stk500v1-flasher.ts',
      'src/services/flash/simulator-flasher.ts',
      'src/services/flash/registry.ts',
      'src/services/flash/index.ts'
    ];
    for (const rel of flashFiles) {
      const code = readFileSync(resolve(process.cwd(), rel), 'utf-8');
      expect(code, `Unexpected document.* access in ${rel}`).not.toMatch(/\bdocument\./);
    }
  });
});
