// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Minimal Standalone TypeScript Declarations for the Browser Web Serial API (Zero External @types Package)

export interface WebSerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

export interface WebSerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

export interface WebSerialOpenOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

export interface WebSerialOutputSignals {
  dataTerminalReady?: boolean;
  requestToSend?: boolean;
  break?: boolean;
}

export interface WebSerialPortLike {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  getInfo(): WebSerialPortInfo;
  open(options: WebSerialOpenOptions): Promise<void>;
  close(): Promise<void>;
  setSignals?(signals: WebSerialOutputSignals): Promise<void>;
  addEventListener?(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener?(type: string, listener: EventListenerOrEventListenerObject): void;
}

export interface WebSerialNavigatorApi {
  requestPort(options?: { filters?: WebSerialPortFilter[] }): Promise<WebSerialPortLike>;
  getPorts(): Promise<WebSerialPortLike[]>;
  addEventListener?(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener?(type: string, listener: EventListenerOrEventListenerObject): void;
}

export function getNavigatorSerial(): WebSerialNavigatorApi | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as unknown as { serial?: WebSerialNavigatorApi };
  return nav.serial && typeof nav.serial.requestPort === 'function' ? nav.serial : null;
}

/** Identifies common educational MCU USB-UART bridges & native USB-CDC controllers from USB VID/PID. */
export function identifyUsbSerialChip(vendorId?: number, productId?: number): string {
  if (vendorId === 0x303a) {
    return productId === 0x1001 ? 'Espressif USB-Serial/JTAG' : 'Espressif USB-CDC';
  }
  if (vendorId === 0x1a86) {
    if (productId === 0x55d3 || productId === 0x55d4) return 'WCH CH343 / CH9102';
    return 'WCH CH340 / CH341';
  }
  if (vendorId === 0x10c4) return 'Silicon Labs CP210x';
  if (vendorId === 0x0403) return 'FTDI FT232R';
  if (vendorId === 0x2341 || vendorId === 0x2a03) return 'ATmega16U2 USB-UART';
  if (typeof vendorId === 'number') {
    const vid = vendorId.toString(16).toUpperCase().padStart(4, '0');
    const pid = typeof productId === 'number' ? productId.toString(16).toUpperCase().padStart(4, '0') : '????';
    return `USB Serial (${vid}:${pid})`;
  }
  return 'Web Serial Port';
}
