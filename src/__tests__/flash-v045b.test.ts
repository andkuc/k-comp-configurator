// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Phase v0.4.5-b Suite: ESP32-S3 Binary Inspector, RFC 1321 MD5, Lazy EsptoolFlasher, Native USB Lease & UI
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ESP32_S3_DEVKIT_BOARD, KCOMP_V2_BOARD, setActiveBoard } from '../boards';
import { CATALOG } from '../catalog';
import { state, getActiveOnboardDefs } from '../core/state';
import { initI18n } from '../i18n';
import {
  DeviceSessionController,
  ESPRESSIF_USB_VID,
  ESP_IMAGE_HEADER_MAGIC,
  ESP_PARTITION_MAGIC_0,
  ESP_PARTITION_MAGIC_1,
  ESP_PARTITION_TABLE_OFFSET,
  EsptoolFlasher,
  binaryStringToUint8Array,
  createEspMultiSegmentArtifact,
  createEspSingleBinArtifact,
  deviceSession,
  flashStrategyRegistry,
  inspectEspBinary,
  isEspNativeUsbPort,
  md5Hex,
  parseFlashOffset,
  uint8ArrayToBinaryString,
  type EsptoolLoaderInitLike,
  type EsptoolModuleLike,
  type EsptoolWriteFlashOptionsLike,
  type WebSerialNavigatorApi,
  type WebSerialPortLike
} from '../services';
import { projectStore, settingsStore } from '../store';
import { initWorkspaceShell, resetWorkspaceShell, setActiveWorkspace } from '../workspaces';

function createMockEspSerial(opts: {
  vendorId?: number;
  productId?: number;
  failReopenAfterFlash?: boolean;
} = {}) {
  const vendorId = opts.vendorId ?? 0x10c4; // Silicon Labs CP210x default
  const productId = opts.productId ?? 0xea60;
  let requestPortCount = 0;
  let openCount = 0;
  let readableStream: ReadableStream<Uint8Array> | null = null;
  let writableStream: WritableStream<Uint8Array> | null = null;

  const port: WebSerialPortLike = {
    get readable() { return readableStream; },
    get writable() { return writableStream; },
    getInfo() { return { usbVendorId: vendorId, usbProductId: productId }; },
    async open() {
      openCount++;
      if (opts.failReopenAfterFlash && openCount >= 2) {
        throw new Error('Failed to open serial port: device re-enumerating');
      }
      readableStream = new ReadableStream<Uint8Array>({
        start() {
          // Stay open until canceled by suspendForFlash / disconnect
        }
      });
      writableStream = new WritableStream<Uint8Array>({
        write() {}
      });
    },
    async close() {
      readableStream = null;
      writableStream = null;
    },
    async setSignals() {}
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
    getRequestPortCount: () => requestPortCount,
    getOpenCount: () => openCount
  };
}

function createMockEsptoolModule(opts: {
  chipName?: string;
  throwOnMain?: Error;
} = {}) {
  const calls = {
    mainModes: [] as Array<string | undefined>,
    loaderInits: [] as EsptoolLoaderInitLike[],
    writeFlashOpts: [] as EsptoolWriteFlashOptionsLike[],
    md5Computed: [] as string[],
    afterCalls: [] as Array<{ mode?: string; reboot?: boolean }>,
    disconnectCount: 0
  };

  class MockTransport {
    readonly port: WebSerialPortLike;
    constructor(port: WebSerialPortLike) {
      this.port = port;
    }
    async disconnect(): Promise<void> {
      calls.disconnectCount++;
    }
  }

  class MockESPLoader {
    private readonly init: EsptoolLoaderInitLike;
    constructor(init: EsptoolLoaderInitLike) {
      this.init = init;
      calls.loaderInits.push(init);
    }
    async main(mode?: string): Promise<string> {
      calls.mainModes.push(mode);
      if (opts.throwOnMain) throw opts.throwOnMain;
      this.init.terminal?.writeLine(`Chip is ${opts.chipName ?? 'ESP32-S3 (QFN56)'}`);
      return opts.chipName ?? 'ESP32-S3 (QFN56)';
    }
    async writeFlash(writeOpts: EsptoolWriteFlashOptionsLike): Promise<void> {
      calls.writeFlashOpts.push(writeOpts);
      for (let i = 0; i < writeOpts.fileArray.length; i++) {
        const entry = writeOpts.fileArray[i];
        const total = entry.data.length;
        writeOpts.reportProgress?.(i, Math.floor(total / 2), total);
        writeOpts.reportProgress?.(i, total, total);
        if (writeOpts.calculateMD5Hash) {
          calls.md5Computed.push(writeOpts.calculateMD5Hash(entry.data));
        }
      }
    }
    async after(mode?: string, reboot?: boolean): Promise<void> {
      calls.afterCalls.push({ mode, reboot });
    }
  }

  const mod: EsptoolModuleLike = {
    Transport: MockTransport,
    ESPLoader: MockESPLoader
  };

  let loadCount = 0;
  const loader = async (): Promise<EsptoolModuleLike> => {
    loadCount++;
    return mod;
  };

  return { loader, calls, getLoadCount: () => loadCount };
}

function setupDeviceDom(boardId = 'esp32-s3-devkit') {
  initI18n();
  resetWorkspaceShell();
  projectStore.reset();
  settingsStore.applyPreset('professional', false);
  const board = setActiveBoard(boardId);
  state.boardId = board.id;
  state.codeProfile = board.defaultCodeProfile;
  state.carrierEnabled = Boolean(board.carrier?.defaultEnabled);
  state.catalog = CATALOG;
  state.active = [];
  state.codeBlocks = [];
  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) state.onboard[ob.id] = false;

  state.svgCache.clear();
  for (const comp of CATALOG.components) {
    state.svgCache.set(comp.svgFile, document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  }

  document.body.innerHTML = `
    <nav id="workspaceSwitchSlot"></nav>
    <section id="workspaceStage" class="workspace-stage hidden"></section>
    <main id="workspace" class="workspace"></main>`;
}

describe('ESP32-S3 Binary Inspector, Multi-Segment Builder & RFC 1321 MD5 (v0.4.5-b)', () => {
  it('computes bit-exact RFC 1321 MD5 digests across ASCII and full 0x00..0xFF byte ranges', () => {
    expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5Hex('a')).toBe('0cc175b9c0f1b6a831c399e269772661');
    expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5Hex('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');
    expect(md5Hex('abcdefghijklmnopqrstuvwxyz')).toBe('c3fcd3d76192e4007dfb496cca67e13b');

    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) allBytes[i] = i;
    expect(md5Hex(allBytes)).toBe('e2c865db4162bed963bfaa9ef6ac18f0');
    expect(md5Hex(uint8ArrayToBinaryString(allBytes))).toBe('e2c865db4162bed963bfaa9ef6ac18f0');
    expect(Array.from(binaryStringToUint8Array(uint8ArrayToBinaryString(allBytes)))).toEqual(Array.from(allBytes));
  });

  it('distinguishes standalone ESP app .bin (0x10000) vs merged factory image (0x0) and validates segments', () => {
    const appImg = new Uint8Array(4096);
    appImg[0] = ESP_IMAGE_HEADER_MAGIC;
    const appInfo = inspectEspBinary(appImg);
    expect(appInfo.kind).toBe('app');
    expect(appInfo.recommendedOffset).toBe(0x10000);

    const mergedImg = new Uint8Array(ESP_PARTITION_TABLE_OFFSET + 256);
    mergedImg[0] = ESP_IMAGE_HEADER_MAGIC;
    mergedImg[ESP_PARTITION_TABLE_OFFSET] = ESP_PARTITION_MAGIC_0;
    mergedImg[ESP_PARTITION_TABLE_OFFSET + 1] = ESP_PARTITION_MAGIC_1;
    const mergedInfo = inspectEspBinary(mergedImg);
    expect(mergedInfo.kind).toBe('merged');
    expect(mergedInfo.recommendedOffset).toBe(0x0);

    const rawImg = new Uint8Array([0x12, 0x34, 0x56]);
    expect(inspectEspBinary(rawImg).kind).toBe('raw');

    expect(parseFlashOffset('0x10000')).toBe(0x10000);
    expect(parseFlashOffset('0x0')).toBe(0);
    expect(parseFlashOffset('65536')).toBe(65536);
    expect(() => parseFlashOffset('-1')).toThrow();
    expect(() => parseFlashOffset('0xZZZ')).toThrow();

    // Multi-segment builder sorts segments and rejects overlapping ranges
    const multi = createEspMultiSegmentArtifact([
      { offset: 0x10000, data: new Uint8Array(64).fill(0xaa), label: 'app' },
      { offset: 0x0, data: new Uint8Array(32).fill(0x11), label: 'bootloader' },
      { offset: 0x8000, data: new Uint8Array(16).fill(0x22), label: 'partitions' }
    ], 'esp32s3-build.bin', 'esp32-s3-devkit');
    expect(multi.format).toBe('esp-segments');
    expect(multi.segments.map((s) => s.offset)).toEqual([0x0, 0x8000, 0x10000]);
    expect(multi.byteLength).toBe(112);

    expect(() =>
      createEspMultiSegmentArtifact([
        { offset: 0x0, data: new Uint8Array(64) },
        { offset: 0x20, data: new Uint8Array(16) }
      ])
    ).toThrow(/Overlapping/i);
  });
});

describe('Lazy EsptoolFlasher Strategy, Chip-Family Guard & Registry (v0.4.5-b)', () => {
  it('registers EsptoolFlasher in flashStrategyRegistry and flashes multi-segment ESP32-S3 images lazily with MD5 verify', async () => {
    const artifact = createEspMultiSegmentArtifact([
      { offset: 0x0, data: new Uint8Array([0xe9, 0x01, 0x02, 0x03]), label: 'bootloader' },
      { offset: 0x8000, data: new Uint8Array([0xaa, 0x50, 0x01, 0x02]), label: 'partitions' },
      { offset: 0x10000, data: new Uint8Array([0xe9, 0xde, 0xad, 0xbe, 0xef]), label: 'app' }
    ], 'project.bin', 'esp32-s3-devkit');

    expect(flashStrategyRegistry.resolve(ESP32_S3_DEVKIT_BOARD, artifact)?.id).toBe('esptool');
    expect(flashStrategyRegistry.resolve(KCOMP_V2_BOARD, artifact)).toBeNull();

    const mockMod = createMockEsptoolModule({ chipName: 'ESP32-S3 (QFN56) (revision v0.2)' });
    const flasher = new EsptoolFlasher({ loader: mockMod.loader });
    expect(mockMod.getLoadCount()).toBe(0); // Strictly lazy until flash() is called!

    const serial = createMockEspSerial({ vendorId: 0x10c4, productId: 0xea60 });
    const progressPct: number[] = [];
    const logs: string[] = [];

    const res = await flasher.flash(serial.port, ESP32_S3_DEVKIT_BOARD, artifact, {
      verify: true,
      onProgress: (p) => progressPct.push(p.percent),
      onLog: (m) => logs.push(m)
    });

    expect(mockMod.getLoadCount()).toBe(1);
    expect(res.ok).toBe(true);
    expect(res.strategyId).toBe('esptool');
    expect(res.bytesWritten).toBe(13);
    expect(res.verified).toBe(true);
    expect(res.resetUsed).toBe('cdc-dtr-rts');
    expect(res.chipSignature).toContain('ESP32-S3');
    expect(mockMod.calls.mainModes).toEqual(['default_reset']);
    expect(mockMod.calls.writeFlashOpts).toHaveLength(1);
    expect(mockMod.calls.writeFlashOpts[0].compress).toBe(true);
    expect(mockMod.calls.writeFlashOpts[0].fileArray.map((f) => f.address)).toEqual([0x0, 0x8000, 0x10000]);
    expect(mockMod.calls.md5Computed).toHaveLength(3);
    expect(mockMod.calls.afterCalls).toEqual([{ mode: 'hard_reset', reboot: true }]);
    expect(mockMod.calls.disconnectCount).toBe(1);
    expect(progressPct[progressPct.length - 1]).toBe(100);
    expect(logs.some((l) => l.includes('ESP32-S3'))).toBe(true);
  });

  it('aborts before erasing/writing on chip-family mismatch, supports manual no_reset mode, and rejects oversized binaries', async () => {
    const artifact = createEspSingleBinArtifact(new Uint8Array(64).fill(0xe9), 0x10000, 'app.bin', 'esp32-s3-devkit');
    const serial = createMockEspSerial();

    // 1. Chip mismatch (ESP32-C3 connected while ESP32-S3 selected) -> fails before writeFlash!
    const wrongChip = createMockEsptoolModule({ chipName: 'ESP32-C3 (revision v0.4)' });
    const wrongFlasher = new EsptoolFlasher({ loader: wrongChip.loader });
    await expect(
      wrongFlasher.flash(serial.port, ESP32_S3_DEVKIT_BOARD, artifact)
    ).rejects.toThrow(/chip mismatch/i);
    expect(wrongChip.calls.writeFlashOpts).toHaveLength(0);
    expect(wrongChip.calls.disconnectCount).toBe(1);

    // 2. Manual reset mode passes 'no_reset' to esploader.main()
    const manualMod = createMockEsptoolModule({ chipName: 'ESP32-S3' });
    const manualFlasher = new EsptoolFlasher({ loader: manualMod.loader });
    const manualRes = await manualFlasher.flash(serial.port, ESP32_S3_DEVKIT_BOARD, artifact, {
      resetPreference: 'manual',
      verify: false
    });
    expect(manualRes.resetUsed).toBe('manual');
    expect(manualMod.calls.mainModes).toEqual(['no_reset']);
    expect(manualMod.calls.md5Computed).toHaveLength(0);

    // 3. Oversized segment (> 16 MB) fails before loading esptool-js
    const hugeArtifact = createEspSingleBinArtifact(new Uint8Array(128), 16777216, 'too-big.bin');
    const untouchedMod = createMockEsptoolModule();
    const untouchedFlasher = new EsptoolFlasher({ loader: untouchedMod.loader });
    await expect(
      untouchedFlasher.flash(serial.port, ESP32_S3_DEVKIT_BOARD, hugeArtifact)
    ).rejects.toThrow(/exceeds flash capacity/i);
    expect(untouchedMod.getLoadCount()).toBe(0);
  });
});

describe('ESP32-S3 Port-Lease (UART & Native USB-JTAG) + Device Workspace UI (v0.4.5-b)', () => {
  beforeEach(async () => {
    await deviceSession.resetForTests();
    setupDeviceDom('esp32-s3-devkit');
  });

  afterEach(async () => {
    await deviceSession.resetForTests();
    resetWorkspaceShell();
    document.body.innerHTML = '';
  });

  it('leases an active UART-bridge monitor port cleanly and tolerates native USB-JTAG (0x303A) post-reset re-enumeration', async () => {
    // Path 1: UART-bridge (CP210x) -> single requestPort, auto-resumes monitor!
    const uartSerial = createMockEspSerial({ vendorId: 0x10c4, productId: 0xea60 });
    const uartMod = createMockEsptoolModule();
    const session = new DeviceSessionController(200, 100);

    await session.connectWebSerial(115200, { serialApi: uartSerial.api });
    const artifact = createEspSingleBinArtifact(new Uint8Array([0xe9, 1, 2, 3]), 0x10000, 'esp-app.bin', 'esp32-s3-devkit');
    const res1 = await session.flashArtifact(artifact, ESP32_S3_DEVKIT_BOARD, {
      strategy: new EsptoolFlasher({ loader: uartMod.loader })
    });
    expect(res1.ok).toBe(true);
    expect(uartSerial.getRequestPortCount()).toBe(1);
    expect(session.isConnected()).toBe(true);
    await session.disconnect();

    // Path 2: Native ESP32-S3 USB-Serial/JTAG (0x303A:0x1001) re-enumerates after hard_reset
    const nativeSerial = createMockEspSerial({
      vendorId: ESPRESSIF_USB_VID,
      productId: 0x1001,
      failReopenAfterFlash: true
    });
    expect(isEspNativeUsbPort(nativeSerial.port)).toBe(true);
    const nativeMod = createMockEsptoolModule();

    await session.connectWebSerial(115200, { serialApi: nativeSerial.api });
    const res2 = await session.flashArtifact(artifact, ESP32_S3_DEVKIT_BOARD, {
      strategy: new EsptoolFlasher({ loader: nativeMod.loader })
    });
    expect(res2.ok).toBe(true);
    expect(session.getSnapshot().lastError).toBeNull();
    expect(session.exportLogText()).toContain('Native USB device restarted after flash');
    await session.disconnect();
  });

  it('renders Flash .bin + Flash-Offset preset selector on ESP32-S3 and flashes .bin via Demo Simulator', async () => {
    initWorkspaceShell();
    setActiveWorkspace('device');

    const stage = document.getElementById('workspaceStage')!;
    const flashBtn = stage.querySelector<HTMLButtonElement>('#btnDevFlashFile')!;
    const infoBtn = stage.querySelector<HTMLButtonElement>('#btnDevFlashInfo')!;
    const infoModal = stage.querySelector<HTMLElement>('#devFlashInfoModal')!;
    const offsetSel = stage.querySelector<HTMLSelectElement>('#devFlashOffsetSelect')!;
    expect(flashBtn.textContent).toContain('.bin');
    expect(flashBtn.querySelector('.dev-beta-badge')?.textContent).toMatch(/beta/i);
    expect(infoBtn.disabled).toBe(false);
    expect(infoModal.classList.contains('hidden')).toBe(true);

    // Opening the Beta Upload Info modal renders browser compatibility & WebHID/Web Serial status
    infoBtn.click();
    expect(infoModal.classList.contains('hidden')).toBe(false);
    const modalText = infoModal.textContent || '';
    expect(modalText).toContain('Chrome / Edge');
    expect(modalText).toContain('Firefox / Safari');
    expect(modalText).toContain('WebHID');
    expect(modalText).toContain('Web Serial');

    // Escape closes the modal cleanly
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(infoModal.classList.contains('hidden')).toBe(true);
    expect(offsetSel.classList.contains('hidden')).toBe(false);
    expect(Array.from(offsetSel.options).map((o) => o.value)).toEqual(['auto', '0x10000', '0x0']);

    stage.querySelector<HTMLButtonElement>('#btnDevSim')!.click();
    await new Promise((r) => setTimeout(r, 80));
    expect(deviceSession.isConnected()).toBe(true);

    const artifact = createEspSingleBinArtifact(new Uint8Array(128).fill(0xe9), 0x10000, 'demo-s3.bin', 'esp32-s3-devkit');
    const res = await deviceSession.flashArtifact(artifact, ESP32_S3_DEVKIT_BOARD, {
      simStepDelayMs: 5,
      verify: true
    });
    expect(res.ok).toBe(true);
    expect(res.strategyId).toBe('simulator-flasher');
    expect(deviceSession.isConnected()).toBe(true);
  });

  it('keeps esp-binary.ts & esptool-flasher.ts 100% DOM-free and loads esptool-js strictly via dynamic import()', () => {
    const binCode = readFileSync(resolve(process.cwd(), 'src/services/flash/esp-binary.ts'), 'utf-8');
    const espCode = readFileSync(resolve(process.cwd(), 'src/services/flash/esptool-flasher.ts'), 'utf-8');

    expect(binCode).not.toMatch(/\bdocument\./);
    expect(espCode).not.toMatch(/\bdocument\./);
    expect(espCode).not.toMatch(new RegExp('^\\s*import\\s+[^\\n]*esptool-js', 'm'));
    expect(espCode).toContain("import('esptool-js')");
  });
});
