// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Zero-Dependency ESP32-S3 Binary Image Inspector, Multi-Segment Builder & RFC 1321 MD5 Verifier
import type { EspSegmentsFirmwareArtifact, FirmwareSegment } from './types';

export const ESP_IMAGE_HEADER_MAGIC = 0xe9;
export const ESP_PARTITION_MAGIC_0 = 0xaa;
export const ESP_PARTITION_MAGIC_1 = 0x50;
export const ESP_PARTITION_TABLE_OFFSET = 0x8000;
export const ESP_DEFAULT_APP_OFFSET = 0x10000;

export type EspBinaryKind = 'merged' | 'app' | 'raw';

export interface EspBinaryInspection {
  readonly kind: EspBinaryKind;
  readonly hasImageHeader: boolean;
  readonly hasPartitionTable: boolean;
  readonly recommendedOffset: number;
  readonly byteLength: number;
}

/**
 * Inspects a raw ESP32-S3 .bin image to distinguish a merged factory image (0x0: bootloader + partition table + app)
 * from a standalone application binary (defaultAppOffset: 0x10000).
 */
export function inspectEspBinary(
  data: Uint8Array,
  defaultAppOffset = ESP_DEFAULT_APP_OFFSET
): EspBinaryInspection {
  const byteLength = data.byteLength;
  const hasImageHeader = byteLength >= 24 && data[0] === ESP_IMAGE_HEADER_MAGIC;
  const hasPartitionTable =
    byteLength > ESP_PARTITION_TABLE_OFFSET + 1 &&
    data[ESP_PARTITION_TABLE_OFFSET] === ESP_PARTITION_MAGIC_0 &&
    data[ESP_PARTITION_TABLE_OFFSET + 1] === ESP_PARTITION_MAGIC_1;

  if (hasImageHeader && hasPartitionTable) {
    return {
      kind: 'merged',
      hasImageHeader,
      hasPartitionTable,
      recommendedOffset: 0x0,
      byteLength
    };
  }
  if (hasImageHeader) {
    return {
      kind: 'app',
      hasImageHeader,
      hasPartitionTable,
      recommendedOffset: defaultAppOffset,
      byteLength
    };
  }
  return {
    kind: 'raw',
    hasImageHeader: false,
    hasPartitionTable,
    recommendedOffset: defaultAppOffset,
    byteLength
  };
}

/** Parses a hexadecimal ("0x10000", "0x0") or decimal flash offset into a non-negative integer. */
export function parseFlashOffset(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isInteger(input) || input < 0) {
      throw new Error(`Invalid flash offset: ${input}`);
    }
    return input;
  }
  const clean = input.trim().toLowerCase();
  if (!clean) {
    throw new Error('Flash offset is empty.');
  }
  let value: number;
  if (clean.startsWith('0x')) {
    if (!/^0x[0-9a-f]+$/.test(clean)) {
      throw new Error(`Invalid hexadecimal flash offset "${input}".`);
    }
    value = parseInt(clean.slice(2), 16);
  } else if (/^\d+$/.test(clean)) {
    value = parseInt(clean, 10);
  } else {
    throw new Error(`Invalid flash offset "${input}".`);
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Flash offset out of range: "${input}".`);
  }
  return value;
}

/**
 * Converts raw firmware bytes into a Latin-1 binary string in safe 8 KiB chunks
 * (compatible across esptool-js 0.4.x / 0.5.x without call-stack overflow on multi-MB images).
 */
export function uint8ArrayToBinaryString(bytes: Uint8Array): string {
  const CHUNK = 0x2000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.byteLength));
    let chunk = '';
    for (let j = 0; j < slice.byteLength; j++) {
      chunk += String.fromCharCode(slice[j]);
    }
    parts.push(chunk);
  }
  return parts.join('');
}

export function binaryStringToUint8Array(bstr: string): Uint8Array {
  const out = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    out[i] = bstr.charCodeAt(i) & 0xff;
  }
  return out;
}

const MD5_SHIFTS: readonly number[] = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];

const MD5_K: Readonly<Uint32Array> = (() => {
  const table = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    table[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }
  return table;
})();

function toHexLittleEndian32(word: number): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    const byte = (word >>> (i * 8)) & 0xff;
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Pure zero-dependency RFC 1321 MD5 digest (lowercase 32-char hex).
 * Used by EsptoolFlasher (`calculateMD5Hash`) for on-chip flash read-back verification.
 */
export function md5Hex(input: Uint8Array | string): string {
  const data = typeof input === 'string' ? binaryStringToUint8Array(input) : input;
  const n = data.byteLength;
  const paddedLen = (Math.floor((n + 8) / 64) + 1) * 64;
  const buf = new Uint8Array(paddedLen);
  buf.set(data, 0);
  buf[n] = 0x80;

  const bitLenLo = (n * 8) >>> 0;
  const bitLenHi = Math.floor(n / 0x20000000) >>> 0;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 8, bitLenLo, true);
  view.setUint32(paddedLen - 4, bitLenHi, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const M = new Uint32Array(16);

  for (let off = 0; off < paddedLen; off += 64) {
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(off + j * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) & 15;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) & 15;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) & 15;
      }
      F = (F + A + MD5_K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      const s = MD5_SHIFTS[i];
      const rot = ((F << s) | (F >>> (32 - s))) >>> 0;
      B = (B + rot) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  return (
    toHexLittleEndian32(a0) +
    toHexLittleEndian32(b0) +
    toHexLittleEndian32(c0) +
    toHexLittleEndian32(d0)
  );
}

/** Validates and constructs a canonical multi-segment ESP32-S3 FirmwareArtifact. */
export function createEspMultiSegmentArtifact(
  segments: ReadonlyArray<FirmwareSegment>,
  filename = 'firmware.bin',
  boardId?: string
): EspSegmentsFirmwareArtifact {
  if (!segments.length) {
    throw new Error('ESP firmware artifact requires at least one binary segment.');
  }

  const normalized: FirmwareSegment[] = segments.map((seg) => {
    if (!Number.isInteger(seg.offset) || seg.offset < 0) {
      throw new Error(`Invalid segment flash offset: ${seg.offset}`);
    }
    if (!seg.data || seg.data.byteLength === 0) {
      throw new Error(`Firmware segment at 0x${seg.offset.toString(16)} is empty.`);
    }
    return {
      offset: seg.offset,
      data: seg.data,
      ...(seg.label ? { label: seg.label } : {}),
      ...(seg.sha256 ? { sha256: seg.sha256 } : {})
    };
  });

  normalized.sort((a, b) => a.offset - b.offset);

  let totalBytes = 0;
  for (let i = 0; i < normalized.length; i++) {
    const cur = normalized[i];
    totalBytes += cur.data.byteLength;
    if (i > 0) {
      const prev = normalized[i - 1];
      const prevEnd = prev.offset + prev.data.byteLength;
      if (cur.offset < prevEnd) {
        throw new Error(
          `Overlapping ESP firmware segments: 0x${prev.offset.toString(16)}..0x${prevEnd.toString(16)} overlaps 0x${cur.offset.toString(16)}.`
        );
      }
    }
  }

  return {
    format: 'esp-segments',
    filename,
    segments: normalized,
    byteLength: totalBytes,
    ...(boardId ? { boardId } : {})
  };
}

/** Wraps a single .bin file at a specific flash offset (e.g. 0x10000 App or 0x0 Merged). */
export function createEspSingleBinArtifact(
  data: Uint8Array,
  offset = ESP_DEFAULT_APP_OFFSET,
  filename = 'firmware.bin',
  boardId?: string
): EspSegmentsFirmwareArtifact {
  return createEspMultiSegmentArtifact(
    [{ offset, data, label: offset === 0 ? 'merged' : 'app' }],
    filename,
    boardId
  );
}
