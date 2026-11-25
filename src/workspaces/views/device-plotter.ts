// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HiDPI Canvas 2D Live Serial Plotter (ECG Timebase, 2-Point Δt/BPM Cursor, Opt-In Radix-2 FFT & PNG Export)
import { escapeHtml, isLightTheme } from '../../core/state';
import {
  computeChannelSpectrum,
  estimateSampleRate,
  formatTimestampMs,
  sliceSamplesByTimeWindow,
  type SerialPlotSample
} from '../../services';

export type PlotAnalysisMode = 'time' | 'fft';
export type PlotTimebaseId = '2s' | '5s' | '10s' | '30s' | '60s' | 'samples300';

export interface PlotTimebaseOption {
  readonly id: PlotTimebaseId;
  readonly windowMs: number | null;
  readonly sampleCount: number | null;
  readonly majorStepSec: number;
  readonly minorStepSec: number;
  readonly isEcgGrid?: boolean;
}

export const PLOT_TIMEBASE_OPTIONS: ReadonlyArray<PlotTimebaseOption> = [
  { id: '2s',         windowMs: 2000,  sampleCount: null, majorStepSec: 0.5, minorStepSec: 0.2, isEcgGrid: true },
  { id: '5s',         windowMs: 5000,  sampleCount: null, majorStepSec: 1.0, minorStepSec: 0.2, isEcgGrid: true },
  { id: '10s',        windowMs: 10000, sampleCount: null, majorStepSec: 2.0, minorStepSec: 1.0 },
  { id: '30s',        windowMs: 30000, sampleCount: null, majorStepSec: 5.0, minorStepSec: 5.0 },
  { id: '60s',        windowMs: 60000, sampleCount: null, majorStepSec: 10.0, minorStepSec: 10.0 },
  { id: 'samples300', windowMs: null,  sampleCount: 300,  majorStepSec: 0,   minorStepSec: 0 }
];

export const PLOT_WINDOW_OPTIONS: ReadonlyArray<number> = [100, 300, 600];

export const PLOT_PALETTE_DARK: ReadonlyArray<string> = [
  '#38bdf8', // sky
  '#fb923c', // orange
  '#4ade80', // green
  '#c084fc', // purple
  '#f472b6', // pink
  '#facc15', // yellow
  '#2dd4bf', // teal
  '#f87171'  // red
];

export const PLOT_PALETTE_LIGHT: ReadonlyArray<string> = [
  '#0284c7', // sky-600
  '#ea580c', // orange-600
  '#16a34a', // green-600
  '#9333ea', // purple-600
  '#db2777', // pink-600
  '#b45309', // amber-700
  '#0d9488', // teal-600
  '#dc2626'  // red-600
];

export interface PlotYBounds {
  min: number;
  max: number;
}

export interface PlotScaleConfig {
  autoScale: boolean;
  fixedMin: number | null;
  fixedMax: number | null;
}

export interface PlotCursorMeasurement {
  dtMs: number;
  freqHz: number;
  bpm: number | null;
  dy: number | null;
  channel: string | null;
}

export interface PlotterTranslator {
  (key: string, params?: Record<string, unknown> | null): string;
}

export function getPlotChannelColor(channelIndex: number, light: boolean): string {
  const palette = light ? PLOT_PALETTE_LIGHT : PLOT_PALETTE_DARK;
  const idx = ((channelIndex % palette.length) + palette.length) % palette.length;
  return palette[idx];
}

export function getTimebaseSpec(id: PlotTimebaseId): PlotTimebaseOption {
  return PLOT_TIMEBASE_OPTIONS.find((o) => o.id === id) || PLOT_TIMEBASE_OPTIONS[1];
}

/**
 * Pure Y-axis range calculator supporting both manual fixed bounds and damped auto-scale
 * with comfortable headroom so signals never clip at the top or bottom border.
 */
export function computePlotYBounds(
  samples: ReadonlyArray<SerialPlotSample>,
  visibleChannels: ReadonlyArray<string>,
  config: PlotScaleConfig,
  previousBounds: PlotYBounds | null = null
): PlotYBounds {
  if (!config.autoScale && config.fixedMin !== null && config.fixedMax !== null) {
    if (Number.isFinite(config.fixedMin) && Number.isFinite(config.fixedMax) && config.fixedMax > config.fixedMin) {
      return { min: config.fixedMin, max: config.fixedMax };
    }
  }

  let dataMin = Infinity;
  let dataMax = -Infinity;
  for (const s of samples) {
    for (const ch of visibleChannels) {
      const v = s.channels[ch];
      if (typeof v === 'number' && Number.isFinite(v)) {
        if (v < dataMin) dataMin = v;
        if (v > dataMax) dataMax = v;
      }
    }
  }

  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) {
    return { min: 0, max: 100 };
  }

  let span = dataMax - dataMin;
  if (span < 1e-6) {
    const pad = Math.max(1, Math.abs(dataMax) * 0.1);
    dataMin -= pad;
    dataMax += pad;
    span = dataMax - dataMin;
  } else {
    const pad = span * 0.1;
    dataMin -= pad;
    dataMax += pad;
  }

  if (previousBounds && Number.isFinite(previousBounds.min) && Number.isFinite(previousBounds.max)) {
    const nextMin = dataMin < previousBounds.min
      ? dataMin
      : previousBounds.min + (dataMin - previousBounds.min) * 0.18;
    const nextMax = dataMax > previousBounds.max
      ? dataMax
      : previousBounds.max + (dataMax - previousBounds.max) * 0.18;
    if (nextMax > nextMin + 1e-6) {
      return { min: nextMin, max: nextMax };
    }
  }

  return { min: dataMin, max: dataMax };
}

/** Maps a pointer X coordinate inside the plot area to the nearest sample index (Sample-count mode). */
export function resolveHoverSampleIndex(
  pointerX: number,
  plotLeft: number,
  plotWidth: number,
  sampleCount: number
): number {
  if (sampleCount <= 0 || plotWidth <= 0) return -1;
  if (pointerX < plotLeft || pointerX > plotLeft + plotWidth) return -1;
  if (sampleCount === 1) return 0;
  const ratio = Math.max(0, Math.min(1, (pointerX - plotLeft) / plotWidth));
  return Math.round(ratio * (sampleCount - 1));
}

/** Finds the sample index whose timestamp is closest to a target timestamp (Timebase mode). */
export function findNearestSampleIndexByTime(timesMs: ReadonlyArray<number>, targetMs: number): number {
  const n = timesMs.length;
  if (n === 0) return -1;
  if (n === 1) return 0;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (timesMs[mid] < targetMs) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(timesMs[lo - 1] - targetMs) < Math.abs(timesMs[lo] - targetMs)) {
    return lo - 1;
  }
  return lo;
}

/** Pure 2-point delta-time / frequency / BPM / delta-Y calculator for the canvas measurement cursor. */
export function computeCursorMeasurement(
  t1Ms: number,
  t2Ms: number,
  y1: number | null = null,
  y2: number | null = null,
  channel: string | null = null
): PlotCursorMeasurement | null {
  const dtMs = Math.abs(t2Ms - t1Ms);
  if (!Number.isFinite(dtMs) || dtMs <= 0.5) return null;
  const freqHz = 1000 / dtMs;
  const bpm = freqHz >= 0.35 && freqHz <= 4.5 ? Math.round(freqHz * 60) : null;
  const dy = (y1 !== null && y2 !== null && Number.isFinite(y1) && Number.isFinite(y2))
    ? (t2Ms >= t1Ms ? y2 - y1 : y1 - y2)
    : null;
  return { dtMs, freqHz, bpm, dy, channel };
}

function formatAxisTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(0);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 10) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  if (abs === 0) return '0';
  return value.toFixed(2);
}

function formatRelSec(sec: number): string {
  if (Math.abs(sec) < 0.005) return '0s';
  if (Math.abs(sec - Math.round(sec)) < 0.01) return `${Math.round(sec)}s`;
  return `${sec.toFixed(1)}s`;
}

function formatDeltaMs(dtMs: number): string {
  if (dtMs >= 1000) return `${(dtMs / 1000).toFixed(2)} s`;
  return `${Math.round(dtMs)} ms`;
}

export interface DevicePlotterController {
  update(samples: ReadonlyArray<SerialPlotSample>, channels: ReadonlyArray<string>): void;
  render(): void;
  setAnalysisMode(mode: PlotAnalysisMode): void;
  getAnalysisMode(): PlotAnalysisMode;
  setTimebase(tb: PlotTimebaseId): void;
  getTimebase(): PlotTimebaseId;
  setWindowSize(size: number): void;
  getWindowSize(): number;
  setScaleConfig(partial: Partial<PlotScaleConfig>): void;
  getScaleConfig(): Readonly<PlotScaleConfig>;
  toggleChannel(channel: string): boolean;
  setFftChannel(channel: string): void;
  getFftChannel(): string | null;
  getHiddenChannels(): ReadonlySet<string>;
  clearMeasurement(): void;
  exportPngDataUrl(title?: string): string | null;
  resetBounds(): void;
  destroy(): void;
}

interface ActiveMeasureSelection {
  x1Ratio: number;
  x2Ratio: number;
}

export function createDevicePlotter(
  container: HTMLElement,
  t: PlotterTranslator,
  onExportPng?: (dataUrl: string) => void
): DevicePlotterController {
  let analysisMode: PlotAnalysisMode = 'time';
  let timebaseId: PlotTimebaseId = '5s';
  let sampleWindowSize = 300;
  let scaleConfig: PlotScaleConfig = {
    autoScale: true,
    fixedMin: 0,
    fixedMax: 1024
  };
  let smoothedBounds: PlotYBounds | null = null;
  const hiddenChannels = new Set<string>();
  let fftSelectedChannel: string | null = null;

  let latestSamples: ReadonlyArray<SerialPlotSample> = [];
  let latestChannels: ReadonlyArray<string> = [];
  let hoverLocalX: number | null = null;
  let draggingMeasure = false;
  let dragStartX = 0;
  let activeMeasure: ActiveMeasureSelection | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const pad = { top: 14, right: 16, bottom: 26, left: 54 };

  container.innerHTML = `
    <div class="dev-plotter-subbar">
      <div class="dev-plotter-subbar-left">
        <span class="dev-panel-title">${escapeHtml(t('dev.plotterTitle'))}</span>
        <div class="dev-plot-mode-switch" role="group" aria-label="${escapeHtml(t('dev.plotModeLabel'))}">
          <button type="button" class="dev-pmode-btn active" data-plot-mode="time" aria-pressed="true">${escapeHtml(t('dev.plotModeTime'))}</button>
          <button type="button" class="dev-pmode-btn" data-plot-mode="fft" aria-pressed="false" title="${escapeHtml(t('dev.plotModeFftTitle'))}">${escapeHtml(t('dev.plotModeFft'))}</button>
        </div>
        <select id="devPlotTimebaseSel" class="dev-select dev-select-sm" aria-label="${escapeHtml(t('dev.plotTimebaseLabel'))}">
          <option value="2s">2 s (EKG)</option>
          <option value="5s" selected>5 s</option>
          <option value="10s">10 s</option>
          <option value="30s">30 s</option>
          <option value="60s">60 s</option>
          <option value="samples300">300 ${escapeHtml(t('dev.samples'))}</option>
        </select>
        <span id="devPlotRateBadge" class="dev-rate-badge hidden" title="${escapeHtml(t('dev.plotRateTitle'))}"></span>
        <button type="button" id="btnDevPlotAuto" class="dev-mini-toggle is-active" aria-pressed="true" title="${escapeHtml(t('dev.plotAutoTitle'))}">${escapeHtml(t('dev.plotAuto'))}</button>
        <div id="devPlotFixedWrap" class="dev-plot-fixed-wrap hidden">
          <input type="number" id="devPlotYMin" class="dev-num-input" value="0" step="any" aria-label="Y Min" title="Y Min" />
          <span class="dev-range-sep">–</span>
          <input type="number" id="devPlotYMax" class="dev-num-input" value="1024" step="any" aria-label="Y Max" title="Y Max" />
        </div>
      </div>
      <div class="dev-plotter-subbar-right">
        <button type="button" id="btnDevPlotPng" class="dev-mini-toggle" title="${escapeHtml(t('dev.exportPngTitle'))}" disabled>⬇ .png</button>
      </div>
    </div>
    <div id="devPlotLegend" class="dev-plotter-legend"></div>
    <div class="dev-plotter-canvas-wrap">
      <canvas id="devPlotCanvas" class="dev-plotter-canvas"></canvas>
      <div id="devPlotEmpty" class="dev-plotter-empty">
        <strong>${escapeHtml(t('dev.plotEmptyTitle'))}</strong>
        <span>${escapeHtml(t('dev.plotEmptyHint'))}</span>
      </div>
    </div>`;

  const canvas = container.querySelector<HTMLCanvasElement>('#devPlotCanvas');
  const canvasWrap = container.querySelector<HTMLElement>('.dev-plotter-canvas-wrap');
  const emptyOverlay = container.querySelector<HTMLElement>('#devPlotEmpty');
  const legendEl = container.querySelector<HTMLElement>('#devPlotLegend');
  const timebaseSel = container.querySelector<HTMLSelectElement>('#devPlotTimebaseSel');
  const rateBadge = container.querySelector<HTMLElement>('#devPlotRateBadge');
  const autoBtn = container.querySelector<HTMLButtonElement>('#btnDevPlotAuto');
  const fixedWrap = container.querySelector<HTMLElement>('#devPlotFixedWrap');
  const yMinInp = container.querySelector<HTMLInputElement>('#devPlotYMin');
  const yMaxInp = container.querySelector<HTMLInputElement>('#devPlotYMax');
  const pngBtn = container.querySelector<HTMLButtonElement>('#btnDevPlotPng');

  function resolveActiveFftChannel(): string | null {
    if (!latestChannels.length) return null;
    if (fftSelectedChannel && latestChannels.includes(fftSelectedChannel)) {
      return fftSelectedChannel;
    }
    const firstVis = latestChannels.find((c) => !hiddenChannels.has(c));
    return firstVis || latestChannels[0];
  }

  function syncToolbarControls(): void {
    container.querySelectorAll<HTMLButtonElement>('[data-plot-mode]').forEach((btn) => {
      const act = btn.dataset.plotMode === analysisMode;
      btn.classList.toggle('active', act);
      btn.setAttribute('aria-pressed', String(act));
    });

    const isTime = analysisMode === 'time';
    if (timebaseSel) {
      timebaseSel.classList.toggle('hidden', !isTime);
      if (timebaseSel.value !== timebaseId) timebaseSel.value = timebaseId;
    }
    if (autoBtn) {
      autoBtn.classList.toggle('hidden', !isTime);
      autoBtn.classList.toggle('is-active', scaleConfig.autoScale);
      autoBtn.setAttribute('aria-pressed', String(scaleConfig.autoScale));
    }
    if (fixedWrap) {
      fixedWrap.classList.toggle('hidden', !isTime || scaleConfig.autoScale);
    }
    if (yMinInp && scaleConfig.fixedMin !== null && document.activeElement !== yMinInp) {
      yMinInp.value = String(scaleConfig.fixedMin);
    }
    if (yMaxInp && scaleConfig.fixedMax !== null && document.activeElement !== yMaxInp) {
      yMaxInp.value = String(scaleConfig.fixedMax);
    }
  }

  function updateRateBadge(): void {
    if (!rateBadge) return;
    const est = estimateSampleRate(latestSamples);
    if (est.hz <= 0.05 || latestSamples.length < 3) {
      rateBadge.classList.add('hidden');
      rateBadge.textContent = '';
      return;
    }
    const hzTxt = est.hz >= 10 ? `~${Math.round(est.hz)} Hz` : `~${est.hz.toFixed(1)} Hz`;
    rateBadge.classList.remove('hidden');
    rateBadge.innerHTML = est.usesHardwareClock
      ? `${escapeHtml(hzTxt)} <span class="dev-hw-clk-tag">HW</span>`
      : escapeHtml(hzTxt);
  }

  function renderLegend(): void {
    if (!legendEl) return;
    if (!latestChannels.length) {
      legendEl.innerHTML = `<span class="dev-legend-placeholder">${escapeHtml(t('dev.plotNoChannels'))}</span>`;
      return;
    }
    const light = isLightTheme();
    const lastSample = latestSamples.length ? latestSamples[latestSamples.length - 1] : null;
    const activeFftCh = resolveActiveFftChannel();

    legendEl.innerHTML = latestChannels.map((ch, idx) => {
      const col = getPlotChannelColor(idx, light);
      const val = lastSample && ch in lastSample.channels ? lastSample.channels[ch] : undefined;
      const valStr = typeof val === 'number' ? formatAxisTick(val) : '—';

      if (analysisMode === 'fft') {
        const isSel = ch === activeFftCh;
        return `
          <button type="button"
                  class="dev-legend-chip ${isSel ? 'is-fft-selected' : 'is-muted'}"
                  data-plot-ch="${escapeHtml(ch)}"
                  aria-pressed="${String(isSel)}"
                  title="${escapeHtml(t('dev.plotSelectFftChannel', { ch }))}">
            <span class="dev-legend-swatch" style="background:${col}"></span>
            <span class="dev-legend-name">${escapeHtml(ch)}</span>
            <strong class="dev-legend-val">${escapeHtml(valStr)}</strong>
          </button>`;
      }

      const isHidden = hiddenChannels.has(ch);
      return `
        <button type="button"
                class="dev-legend-chip ${isHidden ? 'is-muted' : ''}"
                data-plot-ch="${escapeHtml(ch)}"
                aria-pressed="${String(!isHidden)}"
                title="${escapeHtml(t('dev.plotToggleChannel', { ch }))}">
          <span class="dev-legend-swatch" style="background:${col}"></span>
          <span class="dev-legend-name">${escapeHtml(ch)}</span>
          <strong class="dev-legend-val">${escapeHtml(valStr)}</strong>
        </button>`;
    }).join('');

    legendEl.querySelectorAll<HTMLButtonElement>('[data-plot-ch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ch = btn.dataset.plotCh;
        if (!ch) return;
        if (analysisMode === 'fft') {
          controller.setFftChannel(ch);
        } else {
          controller.toggleChannel(ch);
        }
      });
    });
  }

  function drawTimeDomain(
    ctx: CanvasRenderingContext2D,
    cssW: number,
    cssH: number,
    exportTitle?: string
  ): void {
    const light = isLightTheme();
    const bgCol = light ? '#ffffff' : '#070d19';
    const gridCol = light ? '#e2e8f0' : '#1e293b';
    const minorGridCol = light ? '#f1f5f9' : '#111b2e';
    const axisCol = light ? '#94a3b8' : '#475569';
    const textCol = light ? '#334155' : '#94a3b8';
    const titleCol = light ? '#0f172a' : '#f1f5f9';

    ctx.fillStyle = bgCol;
    ctx.fillRect(0, 0, cssW, cssH);

    const extraTop = exportTitle ? 26 : 0;
    const plotLeft = pad.left;
    const plotTop = pad.top + extraTop;
    const plotW = Math.max(10, cssW - pad.left - pad.right);
    const plotH = Math.max(10, cssH - plotTop - pad.bottom);

    if (exportTitle) {
      ctx.fillStyle = titleCol;
      ctx.font = '700 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(exportTitle, plotLeft, 15);
    }

    const tb = getTimebaseSpec(timebaseId);
    const isTimeMode = tb.windowMs !== null;
    let slice: ReadonlyArray<SerialPlotSample>;
    let sliceTimes: number[] = [];
    let tStartMs = 0;
    let tEndMs = 1;

    if (isTimeMode && tb.windowMs !== null) {
      const sliced = sliceSamplesByTimeWindow(latestSamples, tb.windowMs);
      slice = sliced.samples;
      sliceTimes = sliced.timesMs;
      tStartMs = sliced.tStartMs;
      tEndMs = sliced.tEndMs;
    } else {
      const lim = tb.sampleCount || sampleWindowSize;
      slice = latestSamples.length > lim ? latestSamples.slice(latestSamples.length - lim) : latestSamples;
      sliceTimes = slice.map((s) => s.hwTimestampMs ?? s.timestampMs);
      tStartMs = sliceTimes.length ? sliceTimes[0] : 0;
      tEndMs = sliceTimes.length ? sliceTimes[sliceTimes.length - 1] : 1;
    }

    const visibleChannels = latestChannels.filter((c) => !hiddenChannels.has(c));
    const bounds = computePlotYBounds(
      slice,
      visibleChannels,
      scaleConfig,
      scaleConfig.autoScale ? smoothedBounds : null
    );
    if (scaleConfig.autoScale) {
      smoothedBounds = bounds;
    }

    const ySpan = Math.max(1e-6, bounds.max - bounds.min);
    const toY = (v: number): number => plotTop + plotH - ((v - bounds.min) / ySpan) * plotH;
    const timeSpanMs = Math.max(1, tEndMs - tStartMs);
    const toXForIndex = (idx: number): number => {
      if (isTimeMode && tb.windowMs !== null) {
        const frac = (sliceTimes[idx] - tStartMs) / tb.windowMs;
        return plotLeft + frac * plotW;
      }
      return slice.length <= 1 ? plotLeft + plotW : plotLeft + (idx / (slice.length - 1)) * plotW;
    };

    // 1. Vertical time grid (with 200 ms ECG sub-grid on 2s & 5s windows!)
    ctx.lineWidth = 1;
    if (isTimeMode && tb.windowMs !== null) {
      const windowSec = tb.windowMs / 1000;
      if (tb.minorStepSec > 0 && tb.minorStepSec < tb.majorStepSec) {
        ctx.strokeStyle = minorGridCol;
        const minorCount = Math.round(windowSec / tb.minorStepSec);
        for (let m = 1; m < minorCount; m++) {
          const secFromRight = m * tb.minorStepSec;
          const x = Math.round(plotLeft + plotW - (secFromRight / windowSec) * plotW) + 0.5;
          if (x > plotLeft && x < plotLeft + plotW) {
            ctx.beginPath();
            ctx.moveTo(x, plotTop);
            ctx.lineTo(x, plotTop + plotH);
            ctx.stroke();
          }
        }
      }

      ctx.font = '600 10px Consolas, monospace';
      ctx.textBaseline = 'top';
      const majorCount = Math.round(windowSec / tb.majorStepSec);
      for (let m = 0; m <= majorCount; m++) {
        const secFromRight = m * tb.majorStepSec;
        const x = Math.round(plotLeft + plotW - (secFromRight / windowSec) * plotW) + 0.5;
        ctx.strokeStyle = gridCol;
        ctx.beginPath();
        ctx.moveTo(x, plotTop);
        ctx.lineTo(x, plotTop + plotH);
        ctx.stroke();

        ctx.fillStyle = textCol;
        ctx.textAlign = m === 0 ? 'right' : (m === majorCount ? 'left' : 'center');
        ctx.fillText(formatRelSec(-secFromRight), x, plotTop + plotH + 6);
      }
    } else {
      for (let i = 0; i <= 5; i++) {
        const x = Math.round(plotLeft + (i / 5) * plotW) + 0.5;
        ctx.strokeStyle = gridCol;
        ctx.beginPath();
        ctx.moveTo(x, plotTop);
        ctx.lineTo(x, plotTop + plotH);
        ctx.stroke();
      }
      if (slice.length > 0) {
        ctx.fillStyle = textCol;
        ctx.font = '600 10px Consolas, monospace';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(formatTimestampMs(slice[0].timestampMs), plotLeft, plotTop + plotH + 6);
        ctx.textAlign = 'right';
        ctx.fillText(formatTimestampMs(slice[slice.length - 1].timestampMs), plotLeft + plotW, plotTop + plotH + 6);
      }
    }

    // 2. Horizontal grid lines & Y-axis labels
    const yTicks = 5;
    ctx.font = '600 10px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= yTicks; i++) {
      const frac = i / yTicks;
      const y = Math.round(plotTop + frac * plotH) + 0.5;
      const val = bounds.max - frac * ySpan;
      ctx.strokeStyle = gridCol;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotLeft + plotW, y);
      ctx.stroke();

      ctx.fillStyle = textCol;
      ctx.fillText(formatAxisTick(val), plotLeft - 7, y);
    }

    // 3. Zero baseline highlight when 0 is visible
    if (bounds.min < 0 && bounds.max > 0) {
      const y0 = Math.round(toY(0)) + 0.5;
      ctx.strokeStyle = axisCol;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(plotLeft, y0);
      ctx.lineTo(plotLeft + plotW, y0);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Plot frame border
    ctx.strokeStyle = axisCol;
    ctx.strokeRect(plotLeft + 0.5, plotTop + 0.5, plotW - 1, plotH - 1);

    // 5. Draw each visible channel curve
    if (slice.length > 0 && visibleChannels.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotLeft, plotTop, plotW, plotH);
      ctx.clip();

      for (let chIdx = 0; chIdx < latestChannels.length; chIdx++) {
        const ch = latestChannels[chIdx];
        if (hiddenChannels.has(ch)) continue;
        const color = getPlotChannelColor(chIdx, light);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        let started = false;
        for (let i = 0; i < slice.length; i++) {
          const val = slice[i].channels[ch];
          if (typeof val !== 'number' || !Number.isFinite(val)) {
            started = false;
            continue;
          }
          const x = toXForIndex(i);
          const y = toY(val);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // 6. 2-Point Measurement Cursor band (click-and-drag Δt / Hz / BPM / Δy!)
      if (activeMeasure) {
        const rA = Math.min(activeMeasure.x1Ratio, activeMeasure.x2Ratio);
        const rB = Math.max(activeMeasure.x1Ratio, activeMeasure.x2Ratio);
        const mx1 = plotLeft + rA * plotW;
        const mx2 = plotLeft + rB * plotW;

        ctx.fillStyle = light ? 'rgba(2, 132, 199, 0.14)' : 'rgba(56, 189, 248, 0.16)';
        ctx.fillRect(mx1, plotTop, Math.max(1, mx2 - mx1), plotH);

        ctx.strokeStyle = light ? '#0284c7' : '#38bdf8';
        ctx.lineWidth = 1.4;
        for (const mx of [mx1, mx2]) {
          ctx.beginPath();
          ctx.moveTo(Math.round(mx) + 0.5, plotTop);
          ctx.lineTo(Math.round(mx) + 0.5, plotTop + plotH);
          ctx.stroke();
        }

        const tA = isTimeMode && tb.windowMs !== null
          ? tStartMs + rA * tb.windowMs
          : tStartMs + rA * timeSpanMs;
        const tB = isTimeMode && tb.windowMs !== null
          ? tStartMs + rB * tb.windowMs
          : tStartMs + rB * timeSpanMs;
        const idxA = findNearestSampleIndexByTime(sliceTimes, tA);
        const idxB = findNearestSampleIndexByTime(sliceTimes, tB);
        const primaryCh = visibleChannels[0] || null;
        const yA = primaryCh && idxA >= 0 ? (slice[idxA].channels[primaryCh] ?? null) : null;
        const yB = primaryCh && idxB >= 0 ? (slice[idxB].channels[primaryCh] ?? null) : null;
        const meas = computeCursorMeasurement(tA, tB, yA, yB, primaryCh);

        if (meas) {
          const parts = [
            `Δt ${formatDeltaMs(meas.dtMs)}`,
            `${meas.freqHz >= 10 ? meas.freqHz.toFixed(1) : meas.freqHz.toFixed(2)} Hz`
          ];
          if (meas.bpm !== null) parts.push(`${meas.bpm} BPM`);
          if (meas.dy !== null) {
            const sign = meas.dy >= 0 ? '+' : '';
            parts.push(`Δy ${sign}${formatAxisTick(meas.dy)}`);
          }
          const badgeTxt = parts.join(' · ');
          ctx.font = '700 10.5px Consolas, monospace';
          const tw = ctx.measureText(badgeTxt).width;
          const bw = Math.ceil(tw) + 16;
          const bh = 22;
          const midX = (mx1 + mx2) / 2;
          const bx = Math.max(plotLeft + 6, Math.min(plotLeft + plotW - bw - 6, midX - bw / 2));
          const by = plotTop + 8;

          ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.96)' : 'rgba(15, 23, 42, 0.95)';
          ctx.strokeStyle = light ? '#0284c7' : '#38bdf8';
          ctx.lineWidth = 1.2;
          ctx.fillRect(bx, by, bw, bh);
          ctx.strokeRect(bx, by, bw, bh);

          ctx.fillStyle = light ? '#0369a1' : '#7dd3fc';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeTxt, bx + bw / 2, by + bh / 2);
        }
      }
      ctx.restore();

      // 7. Interactive hover crosshair (hidden while dragging a measurement or exporting PNG)
      if (!exportTitle && !draggingMeasure && hoverLocalX !== null && hoverLocalX >= plotLeft && hoverLocalX <= plotLeft + plotW) {
        let idx = -1;
        if (isTimeMode && tb.windowMs !== null) {
          const ratio = (hoverLocalX - plotLeft) / plotW;
          const targetT = tStartMs + ratio * tb.windowMs;
          idx = findNearestSampleIndexByTime(sliceTimes, targetT);
        } else {
          idx = resolveHoverSampleIndex(hoverLocalX, plotLeft, plotW, slice.length);
        }

        if (idx >= 0 && idx < slice.length) {
          const sample = slice[idx];
          const hx = toXForIndex(idx);
          if (hx >= plotLeft && hx <= plotLeft + plotW) {
            ctx.strokeStyle = axisCol;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(hx, plotTop);
            ctx.lineTo(hx, plotTop + plotH);
            ctx.stroke();
            ctx.setLineDash([]);

            const rows: Array<{ label: string; color: string }> = [];
            for (let chIdx = 0; chIdx < latestChannels.length; chIdx++) {
              const ch = latestChannels[chIdx];
              if (hiddenChannels.has(ch)) continue;
              const val = sample.channels[ch];
              if (typeof val !== 'number' || !Number.isFinite(val)) continue;
              const color = getPlotChannelColor(chIdx, light);
              const hy = toY(val);
              if (hy >= plotTop && hy <= plotTop + plotH) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(hx, hy, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = bgCol;
                ctx.lineWidth = 1.5;
                ctx.stroke();
              }
              rows.push({ label: `${ch}: ${formatAxisTick(val)}`, color });
            }

            if (rows.length > 0) {
              const relSec = (sliceTimes[idx] - tEndMs) / 1000;
              const headLabel = isTimeMode ? `${relSec.toFixed(2)} s` : formatTimestampMs(sample.timestampMs);
              ctx.font = '600 10.5px Consolas, monospace';
              let maxW = ctx.measureText(headLabel).width;
              for (const r of rows) {
                const w = ctx.measureText(r.label).width + 14;
                if (w > maxW) maxW = w;
              }
              const boxW = Math.ceil(maxW) + 16;
              const boxH = 18 + rows.length * 15 + 6;
              const boxX = hx + 12 + boxW <= plotLeft + plotW ? hx + 12 : Math.max(plotLeft + 4, hx - boxW - 12);
              const boxY = activeMeasure ? plotTop + 36 : plotTop + 8;

              ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.94)' : 'rgba(15, 23, 42, 0.92)';
              ctx.strokeStyle = axisCol;
              ctx.lineWidth = 1;
              ctx.fillRect(boxX, boxY, boxW, boxH);
              ctx.strokeRect(boxX, boxY, boxW, boxH);

              ctx.fillStyle = textCol;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              ctx.fillText(headLabel, boxX + 8, boxY + 5);

              rows.forEach((r, rIdx) => {
                const ry = boxY + 21 + rIdx * 15;
                ctx.fillStyle = r.color;
                ctx.fillRect(boxX + 8, ry + 2, 7, 7);
                ctx.fillStyle = titleCol;
                ctx.fillText(r.label, boxX + 20, ry);
              });
            }
          }
        }
      }
    }

    // 8. Subtle ECG grid hint in bottom-left when 200 ms ECG grid is active
    if (isTimeMode && tb.isEcgGrid && slice.length > 0) {
      ctx.fillStyle = textCol;
      ctx.font = '600 9.5px Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('200 ms/div', plotLeft + 6, plotTop + plotH - 5);
    }

    // 9. Static PNG legend header
    if (exportTitle && visibleChannels.length > 0) {
      let lx = plotLeft + plotW;
      ctx.font = '700 10.5px Consolas, monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      for (let i = latestChannels.length - 1; i >= 0; i--) {
        const ch = latestChannels[i];
        if (hiddenChannels.has(ch)) continue;
        const col = getPlotChannelColor(i, light);
        const w = ctx.measureText(ch).width;
        ctx.fillStyle = titleCol;
        ctx.fillText(ch, lx, 15);
        ctx.fillStyle = col;
        ctx.fillRect(lx - w - 12, 11, 8, 8);
        lx -= w + 22;
      }
    }
  }

  function drawFftSpectrum(
    ctx: CanvasRenderingContext2D,
    cssW: number,
    cssH: number,
    exportTitle?: string
  ): void {
    const light = isLightTheme();
    const bgCol = light ? '#ffffff' : '#070d19';
    const gridCol = light ? '#e2e8f0' : '#1e293b';
    const axisCol = light ? '#94a3b8' : '#475569';
    const textCol = light ? '#334155' : '#94a3b8';
    const titleCol = light ? '#0f172a' : '#f1f5f9';

    ctx.fillStyle = bgCol;
    ctx.fillRect(0, 0, cssW, cssH);

    const extraTop = exportTitle ? 26 : 0;
    const plotLeft = pad.left;
    const plotTop = pad.top + 18 + extraTop; // space for honest fs/Nyquist metadata strip
    const plotW = Math.max(10, cssW - pad.left - pad.right);
    const plotH = Math.max(10, cssH - plotTop - pad.bottom);

    const activeCh = resolveActiveFftChannel();
    if (!activeCh) return;

    const chIdx = Math.max(0, latestChannels.indexOf(activeCh));
    const chColor = getPlotChannelColor(chIdx, light);
    const spec = computeChannelSpectrum(latestSamples, activeCh, 1024);

    if (exportTitle) {
      ctx.fillStyle = titleCol;
      ctx.font = '700 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${exportTitle} — FFT (${activeCh})`, plotLeft, 15);
    }

    // Honest FFT metadata strip at top of canvas (sample rate, Nyquist, N, Hann, jitter note)
    ctx.font = '600 10px Consolas, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    if (!spec.ok) {
      ctx.fillStyle = textCol;
      ctx.fillText(t('dev.fftNeedSamples', { min: 32, cur: latestSamples.length }), plotLeft, plotTop - 9);
      ctx.strokeStyle = axisCol;
      ctx.strokeRect(plotLeft + 0.5, plotTop + 0.5, plotW - 1, plotH - 1);
      return;
    }

    const metaStr = `fs ≈ ${spec.sampleRateHz.toFixed(1)} Hz · Nyquist ${spec.nyquistHz.toFixed(1)} Hz · N=${spec.fftSize} · Hann${spec.usesHardwareClock ? ' · HW' : ''}`;
    ctx.fillStyle = textCol;
    ctx.fillText(metaStr, plotLeft, plotTop - 9);

    if (spec.highJitter) {
      ctx.fillStyle = light ? '#b45309' : '#fbbf24';
      ctx.textAlign = 'right';
      ctx.fillText(`⚠ ${t('dev.fftJitterWarn')}`, plotLeft + plotW, plotTop - 9);
    }

    const maxFreq = Math.max(1e-3, spec.nyquistHz);
    let maxMag = 0;
    for (const b of spec.bins) {
      if (b.magnitude > maxMag) maxMag = b.magnitude;
    }
    const yMax = Math.max(1e-3, maxMag * 1.18);

    const toX = (fHz: number): number => plotLeft + (fHz / maxFreq) * plotW;
    const toY = (mag: number): number => plotTop + plotH - (mag / yMax) * plotH;

    // 1. Grid lines (Y magnitude & X frequency)
    ctx.lineWidth = 1;
    ctx.font = '600 10px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const frac = i / 4;
      const y = Math.round(plotTop + frac * plotH) + 0.5;
      const val = yMax * (1 - frac);
      ctx.strokeStyle = gridCol;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotLeft + plotW, y);
      ctx.stroke();
      ctx.fillStyle = textCol;
      ctx.fillText(formatAxisTick(val), plotLeft - 7, y);
    }

    const xTicks = 5;
    ctx.textBaseline = 'top';
    for (let i = 0; i <= xTicks; i++) {
      const frac = i / xTicks;
      const x = Math.round(plotLeft + frac * plotW) + 0.5;
      const f = frac * maxFreq;
      ctx.strokeStyle = gridCol;
      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotTop + plotH);
      ctx.stroke();

      ctx.fillStyle = textCol;
      ctx.textAlign = i === 0 ? 'left' : (i === xTicks ? 'right' : 'center');
      ctx.fillText(`${f >= 10 ? f.toFixed(0) : f.toFixed(1)} Hz`, x, plotTop + plotH + 6);
    }

    // 2. 50 Hz European mains-hum reference line whenever Nyquist >= 55 Hz
    if (maxFreq >= 55) {
      const x50 = Math.round(toX(50)) + 0.5;
      ctx.strokeStyle = light ? '#d97706' : '#f59e0b';
      ctx.lineWidth = 1.1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x50, plotTop);
      ctx.lineTo(x50, plotTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = light ? '#b45309' : '#fbbf24';
      ctx.font = '700 9.5px Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('50 Hz', Math.min(plotLeft + plotW - 34, x50 + 4), plotTop + 4);
    }

    // 3. Plot border
    ctx.strokeStyle = axisCol;
    ctx.lineWidth = 1;
    ctx.strokeRect(plotLeft + 0.5, plotTop + 0.5, plotW - 1, plotH - 1);

    // 4. Spectrum area fill + curve stroke
    if (spec.bins.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotLeft, plotTop, plotW, plotH);
      ctx.clip();

      ctx.beginPath();
      ctx.moveTo(toX(spec.bins[0].freqHz), plotTop + plotH);
      for (const b of spec.bins) {
        ctx.lineTo(toX(b.freqHz), toY(b.magnitude));
      }
      ctx.lineTo(toX(spec.bins[spec.bins.length - 1].freqHz), plotTop + plotH);
      ctx.closePath();
      ctx.fillStyle = light ? 'rgba(2, 132, 199, 0.14)' : 'rgba(56, 189, 248, 0.18)';
      ctx.fill();

      ctx.beginPath();
      spec.bins.forEach((b, i) => {
        const x = toX(b.freqHz);
        const y = toY(b.magnitude);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = chColor;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // 5. Automatic strongest Peak marker
    if (spec.peak) {
      const px = toX(spec.peak.freqHz);
      const py = toY(spec.peak.magnitude);
      ctx.fillStyle = chColor;
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = bgCol;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const fStr = spec.peak.freqHz >= 10 ? spec.peak.freqHz.toFixed(1) : spec.peak.freqHz.toFixed(2);
      const peakLbl = spec.peak.bpm !== null
        ? `Peak: ${fStr} Hz (${spec.peak.bpm} BPM)`
        : `Peak: ${fStr} Hz`;

      ctx.font = '700 10.5px Consolas, monospace';
      const pw = Math.ceil(ctx.measureText(peakLbl).width) + 14;
      const ph = 20;
      const bx = Math.max(plotLeft + 4, Math.min(plotLeft + plotW - pw - 4, px - pw / 2));
      const by = Math.max(plotTop + 4, py - ph - 8);

      ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.94)' : 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = chColor;
      ctx.lineWidth = 1.1;
      ctx.fillRect(bx, by, pw, ph);
      ctx.strokeRect(bx, by, pw, ph);

      ctx.fillStyle = titleCol;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(peakLbl, bx + pw / 2, by + ph / 2);
    }

    // 6. Interactive FFT hover crosshair
    if (!exportTitle && hoverLocalX !== null && hoverLocalX >= plotLeft && hoverLocalX <= plotLeft + plotW && spec.bins.length > 0) {
      const ratio = (hoverLocalX - plotLeft) / plotW;
      const targetFreq = ratio * maxFreq;
      let bestBin = spec.bins[0];
      let bestDist = Infinity;
      for (const b of spec.bins) {
        const d = Math.abs(b.freqHz - targetFreq);
        if (d < bestDist) {
          bestDist = d;
          bestBin = b;
        }
      }
      const hx = toX(bestBin.freqHz);
      const hy = toY(bestBin.magnitude);

      ctx.strokeStyle = axisCol;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, plotTop);
      ctx.lineTo(hx, plotTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = chColor;
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();

      const bpmTxt = bestBin.freqHz >= 0.4 && bestBin.freqHz <= 4.0 ? ` (${Math.round(bestBin.freqHz * 60)} BPM)` : '';
      const line1 = `${bestBin.freqHz >= 10 ? bestBin.freqHz.toFixed(1) : bestBin.freqHz.toFixed(2)} Hz${bpmTxt}`;
      const line2 = `Amp: ${formatAxisTick(bestBin.magnitude)}`;
      ctx.font = '600 10.5px Consolas, monospace';
      const boxW = Math.ceil(Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width)) + 16;
      const boxH = 38;
      const boxX = hx + 12 + boxW <= plotLeft + plotW ? hx + 12 : Math.max(plotLeft + 4, hx - boxW - 12);
      const boxY = plotTop + 28;

      ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.94)' : 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = axisCol;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = titleCol;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(line1, boxX + 8, boxY + 6);
      ctx.fillStyle = textCol;
      ctx.fillText(line2, boxX + 8, boxY + 21);
    }
  }

  function renderCanvas(): void {
    const hasData = latestSamples.length > 0 && latestChannels.length > 0;
    if (emptyOverlay) {
      emptyOverlay.classList.toggle('hidden', hasData);
    }
    if (pngBtn) {
      pngBtn.disabled = !hasData;
    }
    if (!canvas || !canvasWrap) return;

    const rect = canvasWrap.getBoundingClientRect();
    const cssW = Math.max(120, Math.floor(rect.width || canvasWrap.clientWidth || 480));
    const cssH = Math.max(140, Math.floor(rect.height || canvasWrap.clientHeight || 260));
    const dpr = typeof window !== 'undefined' ? Math.max(1, Math.min(2, window.devicePixelRatio || 1)) : 1;

    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch (_) {
      ctx = null;
    }
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (analysisMode === 'fft') {
      drawFftSpectrum(ctx, cssW, cssH);
    } else {
      drawTimeDomain(ctx, cssW, cssH);
    }
    ctx.restore();
  }

  // Event bindings
  container.querySelectorAll<HTMLButtonElement>('[data-plot-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.plotMode;
      if (m === 'time' || m === 'fft') {
        controller.setAnalysisMode(m);
      }
    });
  });

  timebaseSel?.addEventListener('change', () => {
    const val = timebaseSel.value as PlotTimebaseId;
    controller.setTimebase(val);
  });

  autoBtn?.addEventListener('click', () => {
    controller.setScaleConfig({ autoScale: !scaleConfig.autoScale });
  });

  const applyFixedInputs = (): void => {
    const minVal = parseFloat(yMinInp?.value || '');
    const maxVal = parseFloat(yMaxInp?.value || '');
    if (Number.isFinite(minVal) && Number.isFinite(maxVal) && maxVal > minVal) {
      scaleConfig = { ...scaleConfig, fixedMin: minVal, fixedMax: maxVal };
      renderCanvas();
    }
  };
  yMinInp?.addEventListener('input', applyFixedInputs);
  yMaxInp?.addEventListener('input', applyFixedInputs);

  pngBtn?.addEventListener('click', () => {
    const url = controller.exportPngDataUrl('K-Comp Telemetry');
    if (url && onExportPng) onExportPng(url);
  });

  // Interactive hover + 2-point click-and-drag measurement cursor in Time mode
  canvas?.addEventListener('pointerdown', (ev: PointerEvent) => {
    if (analysisMode !== 'time' || ev.button !== 0 || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const plotW = Math.max(10, rect.width - pad.left - pad.right);
    const localX = ev.clientX - rect.left;
    if (localX < pad.left || localX > pad.left + plotW) return;

    draggingMeasure = true;
    dragStartX = localX;
    const ratio = Math.max(0, Math.min(1, (localX - pad.left) / plotW));
    activeMeasure = { x1Ratio: ratio, x2Ratio: ratio };
    canvas.setPointerCapture?.(ev.pointerId);
    renderCanvas();
  });

  canvas?.addEventListener('pointermove', (ev: PointerEvent) => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const localX = ev.clientX - rect.left;
    hoverLocalX = localX;

    if (draggingMeasure && analysisMode === 'time') {
      const plotW = Math.max(10, rect.width - pad.left - pad.right);
      const r1 = Math.max(0, Math.min(1, (dragStartX - pad.left) / plotW));
      const r2 = Math.max(0, Math.min(1, (localX - pad.left) / plotW));
      activeMeasure = { x1Ratio: r1, x2Ratio: r2 };
    }
    renderCanvas();
  });

  const finishMeasureDrag = (ev: PointerEvent): void => {
    if (!draggingMeasure || !canvas) return;
    draggingMeasure = false;
    try { canvas.releasePointerCapture?.(ev.pointerId); } catch (_) {}
    const rect = canvas.getBoundingClientRect();
    const localX = ev.clientX - rect.left;
    if (Math.abs(localX - dragStartX) < 6) {
      // Single click without drag clears pinned measurement cleanly
      activeMeasure = null;
    }
    renderCanvas();
  };

  canvas?.addEventListener('pointerup', finishMeasureDrag);
  canvas?.addEventListener('pointercancel', finishMeasureDrag);

  canvas?.addEventListener('pointerleave', () => {
    if (!draggingMeasure && hoverLocalX !== null) {
      hoverLocalX = null;
      renderCanvas();
    }
  });

  if (typeof ResizeObserver !== 'undefined' && canvasWrap) {
    resizeObserver = new ResizeObserver(() => {
      renderCanvas();
    });
    resizeObserver.observe(canvasWrap);
  }

  const controller: DevicePlotterController = {
    update(samples: ReadonlyArray<SerialPlotSample>, channels: ReadonlyArray<string>): void {
      latestSamples = samples;
      latestChannels = channels;
      updateRateBadge();
      renderLegend();
      renderCanvas();
    },

    render(): void {
      syncToolbarControls();
      updateRateBadge();
      renderLegend();
      renderCanvas();
    },

    setAnalysisMode(mode: PlotAnalysisMode): void {
      analysisMode = mode;
      draggingMeasure = false;
      activeMeasure = null;
      syncToolbarControls();
      renderLegend();
      renderCanvas();
    },

    getAnalysisMode(): PlotAnalysisMode {
      return analysisMode;
    },

    setTimebase(tb: PlotTimebaseId): void {
      timebaseId = getTimebaseSpec(tb).id;
      smoothedBounds = null;
      activeMeasure = null;
      syncToolbarControls();
      renderCanvas();
    },

    getTimebase(): PlotTimebaseId {
      return timebaseId;
    },

    setWindowSize(size: number): void {
      if (!Number.isFinite(size) || size < 10) return;
      sampleWindowSize = Math.round(size);
      renderCanvas();
    },

    getWindowSize(): number {
      return sampleWindowSize;
    },

    setScaleConfig(partial: Partial<PlotScaleConfig>): void {
      scaleConfig = { ...scaleConfig, ...partial };
      if (scaleConfig.autoScale) {
        smoothedBounds = null;
      }
      syncToolbarControls();
      renderCanvas();
    },

    getScaleConfig(): Readonly<PlotScaleConfig> {
      return { ...scaleConfig };
    },

    toggleChannel(channel: string): boolean {
      if (hiddenChannels.has(channel)) {
        hiddenChannels.delete(channel);
      } else {
        hiddenChannels.add(channel);
      }
      smoothedBounds = null;
      renderLegend();
      renderCanvas();
      return !hiddenChannels.has(channel);
    },

    setFftChannel(channel: string): void {
      fftSelectedChannel = channel;
      renderLegend();
      renderCanvas();
    },

    getFftChannel(): string | null {
      return resolveActiveFftChannel();
    },

    getHiddenChannels(): ReadonlySet<string> {
      return hiddenChannels;
    },

    clearMeasurement(): void {
      activeMeasure = null;
      renderCanvas();
    },

    exportPngDataUrl(title = 'K-Comp Telemetry'): string | null {
      if (!latestSamples.length || !latestChannels.length) return null;
      const outCanvas = document.createElement('canvas');
      const exportW = 960;
      const exportH = 440;
      outCanvas.width = exportW;
      outCanvas.height = exportH;
      let ctx: CanvasRenderingContext2D | null = null;
      try {
        ctx = outCanvas.getContext('2d');
      } catch (_) {
        ctx = null;
      }
      if (!ctx) return null;
      if (analysisMode === 'fft') {
        drawFftSpectrum(ctx, exportW, exportH, title);
      } else {
        drawTimeDomain(ctx, exportW, exportH, title);
      }
      return outCanvas.toDataURL('image/png');
    },

    resetBounds(): void {
      smoothedBounds = null;
      activeMeasure = null;
      renderCanvas();
    },

    destroy(): void {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      container.innerHTML = '';
    }
  };

  syncToolbarControls();
  updateRateBadge();
  renderLegend();
  renderCanvas();
  return controller;
}
