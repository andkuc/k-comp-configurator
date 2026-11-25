// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Device Workspace Suite (v0.4.0): WebSerialTransport, SimulatorTransport, DeviceSessionController & Monitor UI
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ESP32_S3_DEVKIT_BOARD, setActiveBoard } from '../boards';
import { CATALOG } from '../catalog';
import { addCodeBlock } from '../core/code-blocks';
import { addComponent } from '../core/hardware';
import { state, getActiveOnboardDefs } from '../core/state';
import { initI18n } from '../i18n';
import {
  DeviceSessionController,
  SimulatorTransport,
  WebSerialTransport,
  computeChannelSpectrum,
  deviceSession,
  estimateSampleRate,
  extractTimelineMs,
  identifyUsbSerialChip,
  parseSerialPlotLine,
  sliceSamplesByTimeWindow,
  type SerialPlotSample,
  type WebSerialNavigatorApi,
  type WebSerialOutputSignals,
  type WebSerialPortLike
} from '../services';
import { projectStore } from '../store';
import { initWorkspaceShell, resetWorkspaceShell, setActiveWorkspace } from '../workspaces';
import { computeCursorMeasurement, computePlotYBounds, getPlotChannelColor, resolveHoverSampleIndex } from '../workspaces/views/device-plotter';

function createMockSerialApi(chunks: string[], vendorId = 0x303a, productId = 0x1001) {
  const written: string[] = [];
  const signals: WebSerialOutputSignals[] = [];
  let closed = false;
  let openedBaud = 0;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let readableStream: ReadableStream<Uint8Array> | null = null;
  let writableStream: WritableStream<Uint8Array> | null = null;

  const port: WebSerialPortLike = {
    get readable() {
      return readableStream;
    },
    get writable() {
      return writableStream;
    },
    getInfo() {
      return { usbVendorId: vendorId, usbProductId: productId };
    },
    async open(opts) {
      openedBaud = opts.baudRate;
      closed = false;
      let idx = 0;
      readableStream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (idx < chunks.length) {
            controller.enqueue(encoder.encode(chunks[idx++]));
          } else {
            controller.close();
          }
        }
      });
      writableStream = new WritableStream<Uint8Array>({
        write(chunk) {
          written.push(decoder.decode(chunk));
        }
      });
    },
    async close() {
      closed = true;
      readableStream = null;
      writableStream = null;
    },
    async setSignals(sig) {
      signals.push({ ...sig });
    }
  };

  const api: WebSerialNavigatorApi = {
    async requestPort() {
      return port;
    },
    async getPorts() {
      return [port];
    }
  };

  return {
    api,
    written,
    signals,
    getOpenedBaud: () => openedBaud,
    isClosed: () => closed
  };
}

function setupDeviceDom(boardId = 'esp32-s3-devkit') {
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

describe('WebSerialTransport & USB Bridge Identification (v0.4.0)', () => {
  it('identifies common K-Comp V2 and ESP32-S3 USB-UART bridges from VID/PID', () => {
    expect(identifyUsbSerialChip(0x303a, 0x1001)).toContain('Espressif');
    expect(identifyUsbSerialChip(0x1a86, 0x7523)).toContain('CH340');
    expect(identifyUsbSerialChip(0x10c4, 0xea60)).toContain('CP210x');
    expect(identifyUsbSerialChip(0x0403, 0x6001)).toContain('FTDI');
  });

  it('connects to a mocked Web Serial port, splits UTF-8 chunks into lines, writes commands, resets & closes cleanly', async () => {
    const mock = createMockSerialApi(['temp:23.4, hum:', '58.1\r\nReady!\n']);
    const transport = new WebSerialTransport({ serialApi: mock.api });
    const received: string[] = [];
    transport.onLine((l) => received.push(l));

    const info = await transport.connect(115200);
    expect(info.portLabel).toContain('Espressif');
    expect(mock.getOpenedBaud()).toBe(115200);
    expect(transport.getState()).toBe('monitoring');

    // Allow microtasks to drain the ReadableStream chunks
    await new Promise((r) => setTimeout(r, 20));
    expect(received).toEqual(['temp:23.4, hum:58.1', 'Ready!']);

    await transport.writeText('STATUS\n');
    expect(mock.written).toEqual(['STATUS\n']);

    await transport.resetBoard('esp32s3');
    expect(mock.signals.length).toBe(2);
    expect(mock.signals[0]).toEqual({ dataTerminalReady: false, requestToSend: true });
    expect(mock.signals[1]).toEqual({ dataTerminalReady: false, requestToSend: false });

    await transport.disconnect();
    expect(transport.getState()).toBe('disconnected');
    expect(mock.isClosed()).toBe(true);
  });
});

describe('SimulatorTransport & DeviceSessionController (v0.4.0)', () => {
  it('generates hardware-aware telemetry for placed sensors and exports .txt & .csv cleanly', async () => {
    const session = new DeviceSessionController(200, 100);
    await session.connectSimulator(() => ({
      boardName: ESP32_S3_DEVKIT_BOARD.name,
      boardShortName: ESP32_S3_DEVKIT_BOARD.shortName,
      mcu: 'esp32s3',
      activeCompIds: ['bmi160'],
      onboardIds: []
    }), 115200, 25);

    expect(session.isConnected()).toBe(true);
    await new Promise((r) => setTimeout(r, 90));

    const snap = session.getSnapshot();
    expect(snap.plotChannels).toEqual(['ax', 'ay', 'az']);
    expect(snap.sampleCount).toBeGreaterThanOrEqual(1);

    await session.sendText('STATUS');
    const logTxt = session.exportLogText();
    expect(logTxt).toContain('STATUS');
    expect(logTxt).toContain('Board=ESP32-S3');

    const csv = session.exportPlotCsv();
    expect(csv.split('\n')[0]).toBe('timestamp_ms,ax,ay,az');

    await session.disconnect();
    expect(session.isConnected()).toBe(false);
  });

  it('produces ECG telemetry when AD8232 is active in SimulatorTransport', () => {
    const sim = new SimulatorTransport(() => ({
      boardName: 'ESP32-S3',
      boardShortName: 'ESP32-S3',
      mcu: 'esp32s3',
      activeCompIds: ['ad8232'],
      onboardIds: []
    }));
    const line = sim.stepOnce();
    expect(line).toMatch(/^t:\d+, ecg:\d+$/);
  });
});

describe('Device Workspace Serial Monitor UI & Persistent Session Lifecycle (v0.4.0)', () => {
  beforeEach(async () => {
    await deviceSession.resetForTests();
    setupDeviceDom('esp32-s3-devkit');
  });

  afterEach(async () => {
    await deviceSession.resetForTests();
    resetWorkspaceShell();
    document.body.innerHTML = '';
  });

  it('mounts the Serial Monitor, renders char_parser Quick-Send chips, and preserves live connection across workspace switches', async () => {
    await addComponent('aht10', { skipUndo: true });
    addCodeBlock('char_parser');
    projectStore.recompute();

    initWorkspaceShell();
    setActiveWorkspace('device');

    const stage = document.getElementById('workspaceStage')!;
    expect(stage.innerHTML).toContain('ESPTOOL');
    expect(stage.querySelector('#devLogViewport')).not.toBeNull();
    // char_parser default chars ("S, X, 1, 2") appear as Quick-Send chips!
    const quickChips = Array.from(stage.querySelectorAll('[data-dev-quick-cmd]')).map((el) => el.textContent);
    expect(quickChips).toEqual(['S', 'X', '1', '2']);

    // Start Demo Stream directly via UI button
    stage.querySelector<HTMLButtonElement>('#btnDevSim')!.click();
    await new Promise((r) => setTimeout(r, 240));
    expect(deviceSession.isConnected()).toBe(true);

    // Switch back to Hardware -> session stays LIVE and Device tab shows green live dot!
    setActiveWorkspace('hardware');
    expect(deviceSession.isConnected()).toBe(true);
    expect(document.querySelector('[data-ws-id="device"] .ws-live-dot')).not.toBeNull();

    // Return to Device -> existing buffered lines & telemetry hydrate immediately!
    setActiveWorkspace('device');
    expect(stage.querySelector('#devLogViewport')!.textContent).toContain('[SIM]');
  });
});


describe('Canvas 2D Live Plotter Math, Controls & Split View (v0.4.1)', () => {
  beforeEach(async () => {
    await deviceSession.resetForTests();
    setupDeviceDom('esp32-s3-devkit');
  });

  afterEach(async () => {
    await deviceSession.resetForTests();
    resetWorkspaceShell();
    document.body.innerHTML = '';
  });

  it('computes damped auto-scale bounds, respects fixed Y-bounds, maps hover X to sample index, and provides distinct colors', () => {
    const samples = [
      { timestampMs: 1000, channels: { temp: 20, hum: 50 } },
      { timestampMs: 1100, channels: { temp: 30, hum: 60 } }
    ];

    const autoB = computePlotYBounds(samples, ['temp', 'hum'], { autoScale: true, fixedMin: null, fixedMax: null });
    expect(autoB.min).toBeLessThan(20);
    expect(autoB.max).toBeGreaterThan(60);

    // Fixed bounds override auto-scale cleanly
    const fixedB = computePlotYBounds(samples, ['temp'], { autoScale: false, fixedMin: 0, fixedMax: 100 });
    expect(fixedB).toEqual({ min: 0, max: 100 });

    // Flat signal still produces non-zero visual span
    const flatB = computePlotYBounds(
      [{ timestampMs: 1000, channels: { v: 42 } }],
      ['v'],
      { autoScale: true, fixedMin: null, fixedMax: null }
    );
    expect(flatB.max).toBeGreaterThan(42);
    expect(flatB.min).toBeLessThan(42);

    // Hover index mapping
    expect(resolveHoverSampleIndex(54, 54, 200, 11)).toBe(0);
    expect(resolveHoverSampleIndex(154, 54, 200, 11)).toBe(5);
    expect(resolveHoverSampleIndex(254, 54, 200, 11)).toBe(10);
    expect(resolveHoverSampleIndex(10, 54, 200, 11)).toBe(-1);

    // Theme-aware channel colors
    expect(getPlotChannelColor(0, false)).not.toBe(getPlotChannelColor(1, false));
    expect(getPlotChannelColor(0, false)).not.toBe(getPlotChannelColor(0, true));
  });

  it('switches cleanly between Split, Monitor, and Plotter modes and populates clickable channel legend from Demo Stream', async () => {
    await addComponent('bmi160', { skipUndo: true });
    projectStore.recompute();

    initWorkspaceShell();
    setActiveWorkspace('device');

    const stage = document.getElementById('workspaceStage')!;
    const grid = stage.querySelector<HTMLElement>('#devBodyGrid')!;
    expect(grid.classList.contains('mode-split')).toBe(true);
    expect(stage.querySelector('#devPlotCanvas')).not.toBeNull();

    // Switch to Plotter-only mode
    stage.querySelector<HTMLButtonElement>('[data-dev-view-mode="plotter"]')!.click();
    expect(grid.classList.contains('mode-plotter')).toBe(true);

    // Switch to Monitor-only mode
    stage.querySelector<HTMLButtonElement>('[data-dev-view-mode="monitor"]')!.click();
    expect(grid.classList.contains('mode-monitor')).toBe(true);

    // Return to Split and start Demo Stream -> BMI160 channels (ax, ay, az) appear as toggleable legend chips
    stage.querySelector<HTMLButtonElement>('[data-dev-view-mode="split"]')!.click();
    stage.querySelector<HTMLButtonElement>('#btnDevSim')!.click();
    await new Promise((r) => setTimeout(r, 260));

    const chChips = Array.from(stage.querySelectorAll<HTMLButtonElement>('[data-plot-ch]'));
    expect(chChips.map((b) => b.dataset.plotCh)).toEqual(['ax', 'ay', 'az']);

    // Clicking a channel chip toggles its muted state cleanly
    chChips[0].click();
    expect(stage.querySelector<HTMLButtonElement>('[data-plot-ch="ax"]')!.classList.contains('is-muted')).toBe(true);

    // Toggling Auto Y exposes fixed Y-min / Y-max inputs
    stage.querySelector<HTMLButtonElement>('#btnDevPlotAuto')!.click();
    expect(stage.querySelector<HTMLElement>('#devPlotFixedWrap')!.classList.contains('hidden')).toBe(false);
  });
});


describe('ECG Timebase, Hardware Timestamps, Measurement Cursor & Opt-In Radix-2 FFT (v0.4.2)', () => {
  beforeEach(async () => {
    await deviceSession.resetForTests();
    setupDeviceDom('esp32-s3-devkit');
  });

  afterEach(async () => {
    await deviceSession.resetForTests();
    resetWorkspaceShell();
    document.body.innerHTML = '';
  });

  it('extracts optional MCU hardware timestamps (t:/ms:) cleanly without plotting them as a data channel', () => {
    const withHw = parseSerialPlotLine('t:12480, ecg:542', 99999);
    expect(withHw).toEqual({
      timestampMs: 99999,
      hwTimestampMs: 12480,
      channels: { ecg: 542 }
    });

    // Single-channel `t:23.4` (e.g. temperature) is preserved as a normal channel when no other channel exists!
    const singleTemp = parseSerialPlotLine('t:23.4', 1000);
    expect(singleTemp).toEqual({
      timestampMs: 1000,
      channels: { t: 23.4 }
    });
  });

  it('de-jitters USB burst plateaus, slices exact time windows, and computes Δt/Hz/BPM cursor metrics', () => {
    // 4 samples arriving in the same millisecond USB burst after a 20 ms gap
    const burst: SerialPlotSample[] = [
      { timestampMs: 1000, channels: { v: 1 } },
      { timestampMs: 1020, channels: { v: 2 } },
      { timestampMs: 1020, channels: { v: 3 } },
      { timestampMs: 1020, channels: { v: 4 } },
      { timestampMs: 1020, channels: { v: 5 } }
    ];
    const { timesMs, usesHardwareClock } = extractTimelineMs(burst);
    expect(usesHardwareClock).toBe(false);
    // Monotonically strictly increasing after de-jittering
    for (let i = 1; i < timesMs.length; i++) {
      expect(timesMs[i]).toBeGreaterThan(timesMs[i - 1]);
    }

    // Time-window slicing retains trailing 5s + 1 anchor sample
    const series: SerialPlotSample[] = [];
    for (let i = 0; i < 100; i++) {
      series.push({ timestampMs: i * 100, hwTimestampMs: i * 100, channels: { ecg: 500 } });
    }
    const sliced = sliceSamplesByTimeWindow(series, 5000);
    expect(sliced.usesHardwareClock).toBe(true);
    expect(sliced.tEndMs - sliced.tStartMs).toBe(5000);
    expect(sliced.samples.length).toBeGreaterThanOrEqual(50);

    // 2-point measurement cursor for 800 ms R-R interval -> 1.25 Hz / 75 BPM
    const meas = computeCursorMeasurement(1000, 1800, 512, 860, 'ecg');
    expect(meas).not.toBeNull();
    expect(meas!.dtMs).toBe(800);
    expect(meas!.freqHz).toBeCloseTo(1.25, 2);
    expect(meas!.bpm).toBe(75);
    expect(meas!.dy).toBe(348);
  });

  it('detects exact 50 Hz mains hum and 1.2 Hz heartbeat peaks via pure Radix-2 FFT with DC removal & Hann window', () => {
    const fs = 200; // 200 Hz -> Nyquist 100 Hz
    const count = 512;
    const samples: SerialPlotSample[] = [];
    for (let i = 0; i < count; i++) {
      const tSec = i / fs;
      // Large DC offset (512) + dominant 50 Hz hum (amp 40) + 1.2 Hz pulse (amp 10)
      const val = 512 + 40 * Math.sin(2 * Math.PI * 50 * tSec) + 10 * Math.sin(2 * Math.PI * 1.2 * tSec);
      samples.push({
        timestampMs: 10000 + i * 5,
        hwTimestampMs: i * 5,
        channels: { ecg: val }
      });
    }

    const rate = estimateSampleRate(samples);
    expect(rate.hz).toBeCloseTo(200, 0);
    expect(rate.usesHardwareClock).toBe(true);

    const spec = computeChannelSpectrum(samples, 'ecg', 512);
    expect(spec.ok).toBe(true);
    expect(spec.fftSize).toBe(512);
    expect(spec.nyquistHz).toBeCloseTo(100, 0);
    expect(spec.peak).not.toBeNull();
    expect(spec.peak!.freqHz).toBeGreaterThan(49.4);
    expect(spec.peak!.freqHz).toBeLessThan(50.6);

    // Insufficient samples returns clean non-crashing status
    const tooFew = computeChannelSpectrum(samples.slice(0, 10), 'ecg');
    expect(tooFew.ok).toBe(false);
    expect(tooFew.reason).toBe('insufficient-samples');
  });

  it('switches cleanly between Time (5s ECG default) and opt-in FFT mode in the Device Workspace UI', async () => {
    await addComponent('ad8232', { skipUndo: true });
    projectStore.recompute();

    initWorkspaceShell();
    setActiveWorkspace('device');

    const stage = document.getElementById('workspaceStage')!;
    const tbSel = stage.querySelector<HTMLSelectElement>('#devPlotTimebaseSel')!;
    expect(tbSel.value).toBe('5s');

    // Start 200 Hz AD8232 ECG Demo Stream -> rate badge shows HW clock!
    stage.querySelector<HTMLButtonElement>('#btnDevSim')!.click();
    await new Promise((r) => setTimeout(r, 260));

    expect(deviceSession.getPlotChannels()).toEqual(['ecg']);
    expect(stage.querySelector('#devPlotRateBadge')!.textContent).toContain('HW');

    // Toggle Opt-In FFT mode -> timebase hides cleanly, FFT button becomes active
    stage.querySelector<HTMLButtonElement>('[data-plot-mode="fft"]')!.click();
    expect(stage.querySelector<HTMLButtonElement>('[data-plot-mode="fft"]')!.classList.contains('active')).toBe(true);
    expect(tbSel.classList.contains('hidden')).toBe(true);

    // Return to Time mode cleanly
    stage.querySelector<HTMLButtonElement>('[data-plot-mode="time"]')!.click();
    expect(tbSel.classList.contains('hidden')).toBe(false);
  });
});
