// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Shared Workbench SVG Helpers & Ephemeral Canvas State
import { SVG_NS } from '../../core/constants';
import { getActiveBoard } from '../../boards';

export interface CarrierWireHoleRef {
  instId: string;
  compPinId: string;
  kind: string;
  bpId?: string;
  railId?: string;
  holeIdx: number;
}

let lastCarrierWireHoles: CarrierWireHoleRef[] = [];

export function getLastCarrierWireHoles(): CarrierWireHoleRef[] {
  return lastCarrierWireHoles;
}

export function setLastCarrierWireHoles(holes: CarrierWireHoleRef[]): void {
  lastCarrierWireHoles = holes;
}

export function getOnboardFlashRect(onboardId: string): { x: number; y: number; w: number; h: number } | null {
  const z = (getActiveBoard().onboardZones || []).find((item) => item.id === onboardId);
  if (!z) return null;
  return z.flashRect || { x: z.x, y: z.y, w: z.w, h: z.h };
}

export function createSvgEl(
  tag: string,
  attrs: Record<string, string | number> = {},
  text: string | null = null
): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  if (text !== null) el.textContent = text;
  return el;
}
