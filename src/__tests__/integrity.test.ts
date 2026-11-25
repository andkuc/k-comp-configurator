// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Automated Repository Data, Board Profile, SVG & Locale Integrity Suite
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOARDS } from '../boards';
import { CATALOG } from '../catalog';
import { LIBRARY_API } from '../catalog/library-api-data';
import { COMPONENT_GUIDES } from '../catalog/component-guide-data';
import en from '../i18n/en';
import de from '../i18n/de';
import sq from '../i18n/sq';

const PUBLIC_DIR = resolve(process.cwd(), 'public');

describe('Catalog & SVG Asset Integrity', () => {
  it('every external component has an existing Inkscape-safe SVG (zero <filter>, zero Arduino/SPI), valid viewBox & pinAnchors', () => {
    expect(CATALOG.components.length).toBeGreaterThanOrEqual(43);

    for (const comp of CATALOG.components) {
      expect(comp.id).toBeTruthy();
      expect(comp.svgFile).toMatch(/^assets\/components\/.+\.svg$/);

      const svgPath = resolve(PUBLIC_DIR, comp.svgFile);
      expect(existsSync(svgPath), `Missing SVG file: ${comp.svgFile}`).toBe(true);

      const svgRaw = readFileSync(svgPath, 'utf-8');
      expect(svgRaw.toLowerCase()).not.toContain('<filter');
      expect(svgRaw).not.toMatch(/\b(?:Arduino|SPI)\b/i);

      expect(Array.isArray(comp.viewBox)).toBe(true);
      expect((comp.viewBox as number[]).length).toBe(2);

      if (!comp.onboardWirelessSlot && comp.pins.length > 0) {
        for (const p of comp.pins) {
          const anchor = (comp.pinAnchors as Record<string, any>)?.[p.id];
          expect(anchor, `Missing pinAnchor for ${comp.id}.${p.id}`).toBeDefined();
        }
      }

      expect(COMPONENT_GUIDES[comp.id], `Missing COMPONENT_GUIDES entry for ${comp.id}`).toBeDefined();
      expect(LIBRARY_API[comp.id], `Missing LIBRARY_API entry for ${comp.id}`).toBeDefined();
    }
  });
});

describe('Board Profiles & Mechanical Geometry Integrity', () => {
  it('every registered board has an existing Inkscape-safe PCB SVG, valid pin references & mechanical spec in mm', () => {
    const boards = Object.values(BOARDS);
    expect(boards.length).toBeGreaterThanOrEqual(2);

    for (const b of boards) {
      const svgPath = resolve(PUBLIC_DIR, b.svgAsset);
      expect(existsSync(svgPath), `Missing board SVG: ${b.svgAsset}`).toBe(true);
      const svgRaw = readFileSync(svgPath, 'utf-8');
      expect(svgRaw.toLowerCase()).not.toContain('<filter');
      expect(svgRaw).not.toMatch(/\b(?:Arduino|SPI)\b/i);

      for (const pinList of Object.values(b.powerPinPriority)) {
        for (const pinId of pinList) {
          expect(b.pins[pinId], `Unknown powerPinPriority pin ${pinId} on ${b.id}`).toBeDefined();
        }
      }

      for (const [hk, hdr] of Object.entries(b.i2cHeaders)) {
        for (const pinId of [hdr.VCC, hdr.GND, hdr.SCL, hdr.SDA]) {
          expect(b.pins[pinId], `Unknown I2C header pin ${pinId} in ${b.id}.${hk}`).toBeDefined();
        }
      }

      // Every board has its own declarative electrical spec & onboardPeripherals array
      expect(b.electrical.sramBytes).toBeGreaterThan(0);
      expect(b.electrical.baseCurrentMa).toBeGreaterThan(0);
      expect(Array.isArray(b.onboardPeripherals)).toBe(true);
      // Catalog itself stays 100% board-agnostic (no board-specific onboard array!)
      expect((CATALOG as any).onboard).toBeUndefined();

      expect(b.mechanical, `Missing mechanical spec on ${b.id}`).toBeDefined();
      expect(b.mechanical!.widthMm).toBeGreaterThan(0);
      expect(b.mechanical!.heightMm).toBeGreaterThan(0);
      for (const hdr of b.mechanical!.headers) {
        expect(hdr.pitchMm).toBe(2.54);
        expect(hdr.pins.length).toBe(hdr.pinCount);
        for (const pinId of hdr.pins) {
          expect(b.pins[pinId], `Unknown mechanical header pin ${pinId} on ${b.id}.${hdr.id}`).toBeDefined();
        }
      }
    }
  });

  it('all presets reference valid boards, components, and pin overrides', () => {
    const compIds = new Set(CATALOG.components.map((c) => c.id));
    for (const preset of CATALOG.presets) {
      const boardId = preset.boardId || 'kcomp-v2';
      const board = BOARDS[boardId];
      expect(board, `Preset ${preset.id} references unknown board ${boardId}`).toBeDefined();
      for (const ext of preset.external) {
        expect(compIds.has(ext.id), `Preset ${preset.id} references unknown component ${ext.id}`).toBe(true);
        if (ext.i2cHeader) {
          expect(board.i2cHeaders[ext.i2cHeader], `Preset ${preset.id} references unknown I2C header ${ext.i2cHeader}`).toBeDefined();
        }
        for (const bpId of Object.values(ext.pinOverrides || {})) {
          expect(board.pins[bpId], `Preset ${preset.id} overrides to unknown pin ${bpId}`).toBeDefined();
        }
      }
    }
  });
});

describe('i18n Locale Parity & Policy Compliance', () => {
  it('maintains 100% key and interpolation-placeholder parity across EN, DE, and SQ', () => {
    const enKeys = Object.keys(en.strings).sort();
    const deKeys = Object.keys(de.strings).sort();
    const sqKeys = Object.keys(sq.strings).sort();

    expect(deKeys).toEqual(enKeys);
    expect(sqKeys).toEqual(enKeys);

    const placeholders = (s: string) => [...s.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
    for (const [locName, dict] of [['en', en], ['de', de], ['sq', sq]] as const) {
      for (const [k, v] of Object.entries(dict.strings)) {
        expect(v.trim().length, `Empty string in ${locName}.${k}`).toBeGreaterThan(0);
        if (locName !== 'en') {
          expect(placeholders(v), `Placeholder mismatch in ${locName}.${k}`).toEqual(placeholders(en.strings[k]));
        }
      }
    }
  });
});
