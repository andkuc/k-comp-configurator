// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pure, DOM-free Electrical Netlist Schema (shared foundation for Workbench, Codegen, Blockly & 2-Layer Shield PCB Editor)

export type ElectricalNetKind = 'power' | 'gnd' | 'i2c' | 'uart' | 'reset' | 'signal';

export interface NetlistEndpoint {
  instanceId: string;
  compId: string;
  compName: string;
  compPinId: string;
  compPinRole: string;
  boardPinId: string;
  carrierHoleLabel?: string;
}

export interface ElectricalNet {
  id: string;
  label: string;
  kind: ElectricalNetKind;
  boardPinIds: string[];
  endpoints: NetlistEndpoint[];
  usesBreadboard: boolean;
  uartKind?: 'hw' | 'sw';
  uartChannel?: number;
}

export interface UnconnectedPinRef {
  instanceId: string;
  compId: string;
  compPinId: string;
  allowedTypes: string[];
}

export interface ElectricalNetlist {
  boardId: string;
  logicVoltage: 5 | 3.3;
  carrierEnabled: boolean;
  nets: ElectricalNet[];
  unconnectedPins: UnconnectedPinRef[];
  stats: {
    totalNets: number;
    totalConnections: number;
    powerNets: number;
    i2cDevices: number;
    uartChannels: number;
  };
}
