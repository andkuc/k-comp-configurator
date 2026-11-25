// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Canonical ProjectDocument v1 Schema Validator & Deflate-Raw Base64URL Hash Codec
import type { PinAttachment, ProjectDocument, ProjectNode } from '../types';
import { hasProposalContent, normalizeProposal } from './proposal';

export const PROJECT_SCHEMA_ID = 'kcomp-project/1' as const;

export function encodeBytesBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBase64UrlBytes(b64: string): Uint8Array {
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function encodeBase64Url(str: string): string {
  return encodeBytesBase64Url(new TextEncoder().encode(str));
}

export function decodeBase64Url(b64: string): string {
  return new TextDecoder().decode(decodeBase64UrlBytes(b64));
}

async function deflateRawBytes(input: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    await writer.write(new Uint8Array(input));
    await writer.close();
    const out = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(out);
  } catch (_) {
    return null;
  }
}

async function inflateRawBytes(input: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream is not supported in this browser');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  await writer.write(new Uint8Array(input));
  await writer.close();
  const out = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(out);
}

/**
 * Encodes a ProjectDocument for a `#cfg=` URL hash.
 * Uses native `deflate-raw` compression (`z.<b64>`) when available and shrinks
 * link size by ~55–75% (especially with filled Project Charters), falling back to `j.<b64>`.
 */
export async function encodeDocumentToHashPayload(doc: ProjectDocument): Promise<string> {
  const json = JSON.stringify(doc);
  const utf8 = new TextEncoder().encode(json);
  const compressed = await deflateRawBytes(utf8);
  if (compressed && compressed.length < utf8.length) {
    return `z.${encodeBytesBase64Url(compressed)}`;
  }
  return `j.${encodeBytesBase64Url(utf8)}`;
}

export async function decodeDocumentFromHashPayload(rawHashPayload: string): Promise<ProjectDocument> {
  let jsonStr = '';
  if (rawHashPayload.startsWith('z.')) {
    const compressed = decodeBase64UrlBytes(rawHashPayload.slice(2));
    const inflated = await inflateRawBytes(compressed);
    jsonStr = new TextDecoder().decode(inflated);
  } else if (rawHashPayload.startsWith('j.')) {
    jsonStr = decodeBase64Url(rawHashPayload.slice(2));
  } else {
    throw new Error('Unsupported #cfg hash payload prefix');
  }
  const parsed = JSON.parse(jsonStr);
  return validateProjectDocument(parsed);
}

export function sanitizePinAttachment(raw: unknown): PinAttachment | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (obj.kind === 'board-pin') return { kind: 'board-pin' };
  if (obj.kind === 'board-breadboard') return { kind: 'board-breadboard', forceRail: true };
  if (obj.kind === 'carrier-row') {
    const idx = typeof obj.holeIndex === 'number' && Number.isInteger(obj.holeIndex) ? obj.holeIndex : undefined;
    return idx !== undefined ? { kind: 'carrier-row', holeIndex: idx } : { kind: 'carrier-row' };
  }
  if (obj.kind === 'carrier-rail' && typeof obj.railId === 'string' && obj.railId) {
    const idx = typeof obj.holeIndex === 'number' && Number.isInteger(obj.holeIndex) ? obj.holeIndex : undefined;
    return idx !== undefined
      ? { kind: 'carrier-rail', railId: obj.railId, holeIndex: idx }
      : { kind: 'carrier-rail', railId: obj.railId };
  }
  return null;
}

export function validateProjectDocument(raw: unknown): ProjectDocument {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid K-Comp project document');
  }
  const obj = raw as Record<string, any>;
  if (obj.schema !== PROJECT_SCHEMA_ID || !Array.isArray(obj.nodes) || obj.nodes.length === 0) {
    throw new Error(`Expected project document schema "${PROJECT_SCHEMA_ID}" with at least one node`);
  }

  const nodes: ProjectNode[] = obj.nodes.map((n: any, idx: number) => {
    if (!n || typeof n !== 'object' || typeof n.boardId !== 'string') {
      throw new Error(`Invalid project node at index ${idx}`);
    }
    const modules = Array.isArray(n.modules)
      ? n.modules
          .filter((m: any) => m && typeof m === 'object' && typeof m.compId === 'string')
          .map((m: any) => {
            const attachments: Record<string, PinAttachment> = {};
            if (m.attachments && typeof m.attachments === 'object') {
              for (const [k, v] of Object.entries(m.attachments)) {
                const clean = sanitizePinAttachment(v);
                if (clean) attachments[k] = clean;
              }
            }
            return {
              compId: String(m.compId),
              i2cHeader: typeof m.i2cHeader === 'string' ? m.i2cHeader : null,
              pinMap: m.pinMap && typeof m.pinMap === 'object' ? { ...m.pinMap } : {},
              ...(Object.keys(attachments).length ? { attachments } : {}),
              position: m.position && typeof m.position === 'object' ? { ...m.position } : null,
              rotation: Number(m.rotation) || 0
            };
          })
      : [];

    const codeBlocks = Array.isArray(n.codeBlocks)
      ? n.codeBlocks
          .filter((b: any) => b && typeof b === 'object' && typeof b.type === 'string')
          .map((b: any) => ({
            type: String(b.type),
            config: b.config && typeof b.config === 'object' ? { ...b.config } : {}
          }))
      : [];

    return {
      id: typeof n.id === 'string' && n.id ? n.id : `node_${idx}`,
      boardId: n.boardId,
      codeProfile: typeof n.codeProfile === 'string' ? n.codeProfile : 'kcomp-avr',
      carrierId: typeof n.carrierId === 'string' ? n.carrierId : null,
      powerDistribution: n.powerDistribution === 'rail' ? 'rail' : 'smart',
      onboard: n.onboard && typeof n.onboard === 'object' ? { ...n.onboard } : {},
      oledPaged: Boolean(n.oledPaged),
      modules,
      codeBlocks
    };
  });

  const propNormalized = obj.proposal ? normalizeProposal(obj.proposal) : null;

  return {
    schema: PROJECT_SCHEMA_ID,
    appVersion: typeof obj.appVersion === 'string' ? obj.appVersion : '0.3.0',
    name: typeof obj.name === 'string' ? obj.name : '',
    nodes,
    links: Array.isArray(obj.links) ? obj.links : [],
    ...(propNormalized && hasProposalContent(propNormalized) ? { proposal: propNormalized } : {}),
    uiPrefs: {
      wireMode: obj.uiPrefs?.wireMode === 'curved' ? 'curved' : 'smart',
      snapToGrid: typeof obj.uiPrefs?.snapToGrid === 'boolean' ? obj.uiPrefs.snapToGrid : true,
      codeHints: typeof obj.uiPrefs?.codeHints === 'boolean' ? obj.uiPrefs.codeHints : true
    },
    ...(obj.meta && typeof obj.meta === 'object' ? { meta: obj.meta } : {})
  };
}
