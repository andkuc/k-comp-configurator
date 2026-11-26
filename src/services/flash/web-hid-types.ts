// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Minimal Standalone TypeScript Declarations for Browser WebHID (Zero External @types Package)

export interface WebHidDeviceFilter {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
}

export interface WebHidInputReportEvent {
  readonly device: WebHidDeviceLike;
  readonly reportId: number;
  readonly data: DataView;
}

export interface WebHidDeviceLike {
  readonly opened: boolean;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: Uint8Array | ArrayBuffer): Promise<void>;
  addEventListener(type: 'inputreport', listener: (ev: WebHidInputReportEvent) => void): void;
  removeEventListener(type: 'inputreport', listener: (ev: WebHidInputReportEvent) => void): void;
}

export interface WebHidNavigatorApi {
  getDevices(): Promise<WebHidDeviceLike[]>;
  requestDevice(options: { filters: WebHidDeviceFilter[] }): Promise<WebHidDeviceLike[]>;
}

export function getNavigatorHid(): WebHidNavigatorApi | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as unknown as { hid?: WebHidNavigatorApi };
  return nav.hid && typeof nav.hid.getDevices === 'function' && typeof nav.hid.requestDevice === 'function'
    ? nav.hid
    : null;
}

export function isWebHidAvailable(): boolean {
  return getNavigatorHid() !== null;
}
