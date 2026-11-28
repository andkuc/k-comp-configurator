// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from 'vitest';
import { validateProjectDocument } from '../core/document';

function docWithModule(module: Record<string, unknown>) {
  return {
    schema: 'kcomp-project/1',
    name: 'Import test',
    nodes: [{ id: 'node_0', boardId: 'kcomp-v2', modules: [{ compId: 'bmp280', ...module }] }]
  };
}

describe('validateProjectDocument import sanitizing', () => {
  it('keeps a valid I2C address override', () => {
    const doc = validateProjectDocument(docWithModule({ i2cAddrOverride: '0x77' }));
    expect(doc.nodes[0].modules[0].i2cAddrOverride).toBe('0x77');
  });

  it('drops an address override that smuggles in extra code', () => {
    const doc = validateProjectDocument(docWithModule({ i2cAddrOverride: '0x77\nvoid evil() {}\n#define X' }));
    expect(doc.nodes[0].modules[0].i2cAddrOverride).toBeUndefined();
  });

  it('keeps plain pin names and drops pin values that are not pin names', () => {
    const doc = validateProjectDocument(docWithModule({
      pinMap: { SDA: 'GPIO8', VCC: 'PWR_5V', SCL: 'D13);\nvoid evil() {}\n//', INT: 42 }
    }));
    expect(doc.nodes[0].modules[0].pinMap).toEqual({ SDA: 'GPIO8', VCC: 'PWR_5V' });
  });
});
