// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pure Headless Signal Timing, Burst De-Jittering, Time-Window Slicing & Radix-2 FFT Spectral Engine
import type { SerialPlotSample } from './device-transport';

export interface SampleRateEstimate {
  hz: number;
  nyquistHz: number;
  meanDtMs: number;
  jitterRatio: number;
  usesHardwareClock: boolean;
  sampleCount: number;
}

export interface SpectrumBin {
  freqHz: number;
  magnitude: number;
}

export interface SpectrumPeak {
  freqHz: number;
  magnitude: number;
  bpm: number | null;
}

export interface SpectrumResult {
  ok: boolean;
  reason?: 'insufficient-samples' | 'zero-span';
  channel: string;
  fftSize: number;
  sampleRateHz: number;
  nyquistHz: number;
  jitterRatio: number;
  highJitter: boolean;
  usesHardwareClock: boolean;
  bins: SpectrumBin[];
  peak: SpectrumPeak | null;
}

/**
 * Extracts a monotonic millisecond timeline from a sample array.
 * Automatically prefers MCU hardware timestamps (`hwTimestampMs`) when present on all samples
 * and monotonic; otherwise uses reception `timestampMs` with gentle USB-packet plateau smoothing.
 */
export function extractTimelineMs(samples: ReadonlyArray<SerialPlotSample>): {
  timesMs: number[];
  usesHardwareClock: boolean;
} {
  const n = samples.length;
  if (n === 0) return { timesMs: [], usesHardwareClock: false };

  // Check if all samples carry a valid monotonic hardware timestamp (e.g. from millis())
  let allHw = true;
  let prevHw = -Infinity;
  for (let i = 0; i < n; i++) {
    const hw = samples[i].hwTimestampMs;
    if (typeof hw !== 'number' || !Number.isFinite(hw) || hw < prevHw) {
      allHw = false;
      break;
    }
    prevHw = hw;
  }

  if (allHw) {
    const hwTimes = new Array<number>(n);
    for (let i = 0; i < n; i++) hwTimes[i] = samples[i].hwTimestampMs as number;
    return { timesMs: hwTimes, usesHardwareClock: true };
  }

  // Fallback: reception timestamps with linear spreading across same-millisecond USB burst plateaus
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = samples[i].timestampMs;

  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && out[j] <= out[i] + 0.001) {
      j++;
    }
    const runLen = j - i;
    if (runLen > 1) {
      const tCur = out[i];
      const tPrev = i > 0 ? out[i - 1] : null;
      const tNext = j < n ? out[j] : null;
      if (tPrev !== null && tCur > tPrev) {
        // Spread burst backward cleanly across (tPrev, tCur]
        const span = tCur - tPrev;
        for (let k = 0; k < runLen; k++) {
          out[i + k] = tPrev + (span * (k + 1)) / runLen;
        }
      } else if (tNext !== null && tNext > tCur) {
        // Spread leading burst forward across [tCur, tNext)
        const span = tNext - tCur;
        for (let k = 0; k < runLen; k++) {
          out[i + k] = tCur + (span * k) / runLen;
        }
      }
    }
    i = j;
  }

  return { timesMs: out, usesHardwareClock: false };
}

/**
 * Slices samples to the trailing `windowMs` time span, including one leading anchor sample
 * just outside the left border so curves enter cleanly from the left axis.
 */
export function sliceSamplesByTimeWindow(
  samples: ReadonlyArray<SerialPlotSample>,
  windowMs: number
): {
  samples: SerialPlotSample[];
  timesMs: number[];
  tStartMs: number;
  tEndMs: number;
  usesHardwareClock: boolean;
} {
  const n = samples.length;
  if (n === 0) {
    return { samples: [], timesMs: [], tStartMs: -windowMs, tEndMs: 0, usesHardwareClock: false };
  }

  const { timesMs, usesHardwareClock } = extractTimelineMs(samples);
  const tEndMs = timesMs[n - 1];
  const tStartMs = tEndMs - windowMs;

  // Find first index >= tStartMs (and keep one anchor point before it if available)
  let startIdx = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (timesMs[i] < tStartMs) {
      startIdx = i;
      break;
    }
    startIdx = i;
  }

  return {
    samples: samples.slice(startIdx),
    timesMs: timesMs.slice(startIdx),
    tStartMs,
    tEndMs,
    usesHardwareClock
  };
}

/** Estimates live sampling rate (Hz), Nyquist limit, and relative timing jitter from recent samples. */
export function estimateSampleRate(samples: ReadonlyArray<SerialPlotSample>): SampleRateEstimate {
  const n = samples.length;
  if (n < 2) {
    return {
      hz: 0,
      nyquistHz: 0,
      meanDtMs: 0,
      jitterRatio: 0,
      usesHardwareClock: false,
      sampleCount: n
    };
  }

  const tail = n > 256 ? samples.slice(n - 256) : samples;
  const { timesMs, usesHardwareClock } = extractTimelineMs(tail);
  const spanMs = timesMs[timesMs.length - 1] - timesMs[0];
  if (spanMs <= 0) {
    return {
      hz: 0,
      nyquistHz: 0,
      meanDtMs: 0,
      jitterRatio: 0,
      usesHardwareClock,
      sampleCount: tail.length
    };
  }

  const countIntervals = timesMs.length - 1;
  const meanDtMs = spanMs / countIntervals;
  const hz = 1000 / meanDtMs;

  let varSum = 0;
  for (let i = 1; i < timesMs.length; i++) {
    const dt = timesMs[i] - timesMs[i - 1];
    const diff = dt - meanDtMs;
    varSum += diff * diff;
  }
  const stdDtMs = Math.sqrt(varSum / countIntervals);
  const jitterRatio = meanDtMs > 0 ? stdDtMs / meanDtMs : 0;

  return {
    hz,
    nyquistHz: hz / 2,
    meanDtMs,
    jitterRatio,
    usesHardwareClock,
    sampleCount: tail.length
  };
}

/**
 * In-place iterative Cooley-Tukey Radix-2 FFT.
 * `re.length` and `im.length` must be identical powers of two.
 */
export function fftRadix2InPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1 || (n & (n - 1)) !== 0) {
    throw new Error(`FFT length must be a power of 2, got ${n}`);
  }

  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  // Butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepRe = Math.cos(angle);
    const wStepIm = Math.sin(angle);

    for (let start = 0; start < n; start += len) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < half; k++) {
        const uIdx = start + k;
        const vIdx = uIdx + half;
        const vRe = re[vIdx] * wRe - im[vIdx] * wIm;
        const vIm = re[vIdx] * wIm + im[vIdx] * wRe;

        re[vIdx] = re[uIdx] - vRe;
        im[vIdx] = im[uIdx] - vIm;
        re[uIdx] += vRe;
        im[uIdx] += vIm;

        const nextWRe = wRe * wStepRe - wIm * wStepIm;
        wIm = wRe * wStepIm + wIm * wStepRe;
        wRe = nextWRe;
      }
    }
  }
}

/**
 * Computes a single-sided amplitude spectrum for one channel:
 *  1. Uniform linear resampling onto an equidistant time grid (eliminates USB jitter bias)
 *  2. DC offset removal (subtracts mean)
 *  3. Hann window with coherent gain compensation
 *  4. Radix-2 FFT + parabolic 3-point peak frequency refinement
 */
export function computeChannelSpectrum(
  samples: ReadonlyArray<SerialPlotSample>,
  channel: string,
  maxFftSize = 1024
): SpectrumResult {
  const { timesMs, usesHardwareClock } = extractTimelineMs(samples);
  const validT: number[] = [];
  const validY: number[] = [];

  for (let i = 0; i < samples.length; i++) {
    const v = samples[i].channels[channel];
    if (typeof v === 'number' && Number.isFinite(v)) {
      validT.push(timesMs[i]);
      validY.push(v);
    }
  }

  const rateEst = estimateSampleRate(samples);

  if (validY.length < 32) {
    return {
      ok: false,
      reason: 'insufficient-samples',
      channel,
      fftSize: 0,
      sampleRateHz: rateEst.hz,
      nyquistHz: rateEst.nyquistHz,
      jitterRatio: rateEst.jitterRatio,
      highJitter: rateEst.jitterRatio > 0.35,
      usesHardwareClock,
      bins: [],
      peak: null
    };
  }

  const t0 = validT[0];
  const t1 = validT[validT.length - 1];
  const spanSec = (t1 - t0) / 1000;
  if (spanSec <= 0) {
    return {
      ok: false,
      reason: 'zero-span',
      channel,
      fftSize: 0,
      sampleRateHz: 0,
      nyquistHz: 0,
      jitterRatio: rateEst.jitterRatio,
      highJitter: false,
      usesHardwareClock,
      bins: [],
      peak: null
    };
  }

  // Pick largest power of two <= validY.length, bounded to [32 .. maxFftSize]
  const cap = Math.max(32, Math.min(maxFftSize, validY.length));
  let fftSize = 32;
  while ((fftSize << 1) <= cap) {
    fftSize <<= 1;
  }

  // Uniform linear resampling onto [t0 .. t1]
  const resampled = new Float64Array(fftSize);
  let mean = 0;
  let srcIdx = 0;
  const lastSrc = validT.length - 1;

  for (let i = 0; i < fftSize; i++) {
    const targetT = t0 + ((t1 - t0) * i) / (fftSize - 1);
    while (srcIdx < lastSrc - 1 && validT[srcIdx + 1] < targetT) {
      srcIdx++;
    }
    const ta = validT[srcIdx];
    const tb = validT[srcIdx + 1];
    const frac = tb > ta ? Math.max(0, Math.min(1, (targetT - ta) / (tb - ta))) : 0;
    const val = validY[srcIdx] + (validY[srcIdx + 1] - validY[srcIdx]) * frac;
    resampled[i] = val;
    mean += val;
  }
  mean /= fftSize;

  // DC removal + Hann window
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const denom = fftSize - 1;
  for (let i = 0; i < fftSize; i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / denom));
    re[i] = (resampled[i] - mean) * hann;
  }

  fftRadix2InPlace(re, im);

  const sampleRateHz = (fftSize - 1) / spanSec;
  const nyquistHz = sampleRateHz / 2;
  const binCount = fftSize >> 1;
  const scale = 4 / fftSize; // 2 (single-sided) * 2 (Hann coherent gain compensation)
  const bins: SpectrumBin[] = new Array(binCount);

  let peakIdx = -1;
  let peakMag = 0;

  for (let k = 1; k <= binCount; k++) {
    const rawMag = Math.hypot(re[k], im[k]);
    const mag = k === binCount ? (rawMag * scale) * 0.5 : rawMag * scale;
    const freqHz = (k * sampleRateHz) / fftSize;
    bins[k - 1] = { freqHz, magnitude: mag };
    if (mag > peakMag) {
      peakMag = mag;
      peakIdx = k - 1;
    }
  }

  let peak: SpectrumPeak | null = null;
  if (peakIdx >= 0 && peakMag > 1e-6) {
    let refinedFreq = bins[peakIdx].freqHz;
    // Parabolic 3-point interpolation for sub-bin frequency precision
    if (peakIdx > 0 && peakIdx < bins.length - 1) {
      const yL = bins[peakIdx - 1].magnitude;
      const yC = bins[peakIdx].magnitude;
      const yR = bins[peakIdx + 1].magnitude;
      const d = yL - 2 * yC + yR;
      if (Math.abs(d) > 1e-9) {
        const delta = Math.max(-0.5, Math.min(0.5, (0.5 * (yL - yR)) / d));
        const df = sampleRateHz / fftSize;
        refinedFreq = Math.max(0, bins[peakIdx].freqHz + delta * df);
      }
    }
    const bpm = refinedFreq >= 0.4 && refinedFreq <= 4.0 ? Math.round(refinedFreq * 60) : null;
    peak = { freqHz: refinedFreq, magnitude: peakMag, bpm };
  }

  return {
    ok: true,
    channel,
    fftSize,
    sampleRateHz,
    nyquistHz,
    jitterRatio: rateEst.jitterRatio,
    highJitter: !usesHardwareClock && rateEst.jitterRatio > 0.35,
    usesHardwareClock,
    bins,
    peak
  };
}
