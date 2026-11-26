// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Zero-Dependency Strict Intel HEX (IHEX) Parser & Flash Page Slicer for STK500v1 / Optiboot
import type { FirmwareSegment, IHexFirmwareArtifact } from './types';

export interface FlashPage {
  readonly address: number;
  readonly data: Uint8Array;
}

export interface ParsedIntelHex {
  readonly segments: ReadonlyArray<FirmwareSegment>;
  readonly totalBytes: number;
  readonly minAddress: number;
  readonly maxAddress: number;
}

function parseHexByte(line: string, offset: number, lineNo: number): number {
  const slice = line.slice(offset, offset + 2);
  if (slice.length !== 2 || !/^[0-9a-fA-F]{2}$/.test(slice)) {
    throw new Error(`Invalid hex byte at Intel HEX line ${lineNo}, column ${offset + 1}.`);
  }
  return parseInt(slice, 16);
}

/**
 * Parses an Intel HEX string (Record Types 00 Data, 01 EOF, 02 Extended Segment, 04 Extended Linear)
 * with strict checksum verification and merges contiguous ranges into sorted segments.
 */
export function parseIntelHex(rawHex: string): ParsedIntelHex {
  if (!rawHex || !rawHex.trim()) {
    throw new Error('Intel HEX input is empty.');
  }

  const lines = rawHex.split(/\r?\n/);
  const rawChunks: Array<{ offset: number; bytes: Uint8Array }> = [];
  let upperAddress = 0;
  let sawEof = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + 1;
    const trimmed = lines[idx].trim();
    if (!trimmed) continue;

    if (!trimmed.startsWith(':')) {
      throw new Error(`Intel HEX line ${lineNo} does not start with ':'.`);
    }
    if (trimmed.length < 11) {
      throw new Error(`Intel HEX line ${lineNo} is truncated.`);
    }

    const byteCount = parseHexByte(trimmed, 1, lineNo);
    const expectedLen = 1 + (byteCount + 5) * 2;
    if (trimmed.length !== expectedLen) {
      throw new Error(`Intel HEX line ${lineNo} length mismatch (expected ${expectedLen}, got ${trimmed.length}).`);
    }

    const addrHi = parseHexByte(trimmed, 3, lineNo);
    const addrLo = parseHexByte(trimmed, 5, lineNo);
    const recordType = parseHexByte(trimmed, 7, lineNo);
    const addr16 = (addrHi << 8) | addrLo;

    let checksumSum = byteCount + addrHi + addrLo + recordType;
    const data = new Uint8Array(byteCount);
    for (let i = 0; i < byteCount; i++) {
      const b = parseHexByte(trimmed, 9 + i * 2, lineNo);
      data[i] = b;
      checksumSum += b;
    }
    const checksum = parseHexByte(trimmed, 9 + byteCount * 2, lineNo);
    checksumSum = (checksumSum + checksum) & 0xff;
    if (checksumSum !== 0) {
      throw new Error(`Intel HEX checksum mismatch on line ${lineNo}.`);
    }

    if (recordType === 0x00) {
      if (byteCount > 0) {
        rawChunks.push({ offset: upperAddress + addr16, bytes: data });
      }
    } else if (recordType === 0x01) {
      sawEof = true;
      break;
    } else if (recordType === 0x02) {
      if (byteCount !== 2) throw new Error(`Invalid Extended Segment record on line ${lineNo}.`);
      upperAddress = ((data[0] << 8) | data[1]) << 4;
    } else if (recordType === 0x04) {
      if (byteCount !== 2) throw new Error(`Invalid Extended Linear record on line ${lineNo}.`);
      upperAddress = (((data[0] << 8) | data[1]) << 16) >>> 0;
    } else if (recordType === 0x03 || recordType === 0x05) {
      // Start Segment / Start Linear address metadata: safely ignored for flash image
    } else {
      throw new Error(`Unsupported Intel HEX record type 0x${recordType.toString(16).padStart(2, '0')} on line ${lineNo}.`);
    }
  }

  if (!sawEof) {
    throw new Error('Intel HEX input is missing the EOF (:00000001FF) record.');
  }
  if (rawChunks.length === 0) {
    throw new Error('Intel HEX input contains no programmable data bytes.');
  }

  rawChunks.sort((a, b) => a.offset - b.offset);

  const merged: FirmwareSegment[] = [];
  let curStart = rawChunks[0].offset;
  let curParts: Uint8Array[] = [rawChunks[0].bytes];
  let curEnd = curStart + rawChunks[0].bytes.byteLength;

  const flushMerged = (): void => {
    const combined = new Uint8Array(curEnd - curStart);
    let pos = 0;
    for (const part of curParts) {
      combined.set(part, pos);
      pos += part.byteLength;
    }
    merged.push({ offset: curStart, data: combined });
  };

  for (let i = 1; i < rawChunks.length; i++) {
    const ch = rawChunks[i];
    if (ch.offset < curEnd) {
      throw new Error(`Overlapping Intel HEX address range at 0x${ch.offset.toString(16)}.`);
    }
    if (ch.offset === curEnd) {
      curParts.push(ch.bytes);
      curEnd += ch.bytes.byteLength;
    } else {
      flushMerged();
      curStart = ch.offset;
      curParts = [ch.bytes];
      curEnd = curStart + ch.bytes.byteLength;
    }
  }
  flushMerged();

  let totalBytes = 0;
  for (const seg of merged) totalBytes += seg.data.byteLength;

  return {
    segments: merged,
    totalBytes,
    minAddress: merged[0].offset,
    maxAddress: merged[merged.length - 1].offset + merged[merged.length - 1].data.byteLength
  };
}

/**
 * Slices arbitrary firmware segments into page-aligned flash pages (e.g. 128 B for ATmega328P),
 * filling unwritten bytes inside touched pages with 0xFF (erased NOR flash state).
 */
export function sliceSegmentsIntoPages(
  segments: ReadonlyArray<FirmwareSegment>,
  pageSize = 128,
  fillByte = 0xff
): FlashPage[] {
  if (pageSize <= 0 || (pageSize & (pageSize - 1)) !== 0) {
    throw new Error(`Flash pageSize must be a positive power of two (got ${pageSize}).`);
  }

  const pageMap = new Map<number, Uint8Array>();

  for (const seg of segments) {
    for (let i = 0; i < seg.data.byteLength; i++) {
      const byteAddr = seg.offset + i;
      const pageBase = Math.floor(byteAddr / pageSize) * pageSize;
      const pageOffset = byteAddr - pageBase;
      let page = pageMap.get(pageBase);
      if (!page) {
        page = new Uint8Array(pageSize);
        page.fill(fillByte);
        pageMap.set(pageBase, page);
      }
      page[pageOffset] = seg.data[i];
    }
  }

  return Array.from(pageMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([address, data]) => ({ address, data }));
}

export function createIHexArtifact(
  rawHex: string,
  filename = 'firmware.hex',
  boardId?: string
): IHexFirmwareArtifact {
  const parsed = parseIntelHex(rawHex);
  return {
    format: 'ihex',
    filename,
    rawHex,
    segments: parsed.segments,
    byteLength: parsed.totalBytes,
    ...(boardId ? { boardId } : {})
  };
}
