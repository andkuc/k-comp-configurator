// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pure, Headless Electrical Netlist Derivation Engine (zero DOM dependencies)
import type {
  ActiveComponentInstance,
  BoardProfile,
  CatalogData,
  ElectricalNet,
  ElectricalNetKind,
  ElectricalNetlist,
  UartAssignment,
  UnconnectedPinRef
} from '../types';

export interface DeriveNetlistInput {
  board: BoardProfile;
  catalog: CatalogData;
  active: ActiveComponentInstance[];
  onboard?: Record<string, boolean>;
  carrierEnabled?: boolean;
  uartAssignments?: Record<string, UartAssignment>;
  carrierWireMap?: Record<string, { kind: string; label?: string }>;
  breadboardRails?: Array<{ bpId: string }>;
}

function classifyPinNet(bpId: string, board: BoardProfile): { id: string; label: string; kind: ElectricalNetKind } {
  const meta = board.pins[bpId];
  const caps = meta?.caps || [];
  if (caps.includes('5V')) return { id: 'NET_5V', label: '+5V', kind: 'power' };
  if (caps.includes('3V3')) return { id: 'NET_3V3', label: '+3.3V', kind: 'power' };
  if (caps.includes('GND')) return { id: 'NET_GND', label: 'GND', kind: 'gnd' };
  if (caps.includes('I2C_SDA')) return { id: 'NET_I2C_SDA', label: 'I2C_SDA', kind: 'i2c' };
  if (caps.includes('I2C_SCL')) return { id: 'NET_I2C_SCL', label: 'I2C_SCL', kind: 'i2c' };
  if (caps.includes('RESET')) return { id: 'NET_RESET', label: 'RESET', kind: 'reset' };
  return { id: `NET_${bpId}`, label: meta?.label || bpId, kind: 'signal' };
}

export function deriveElectricalNetlist(input: DeriveNetlistInput): ElectricalNetlist {
  const { board, catalog, active } = input;
  const carrierEnabled = Boolean(input.carrierEnabled && board.carrier);
  const uartMap = input.uartAssignments || {};
  const carrierWireMap = input.carrierWireMap || {};
  const bbPinSet = new Set((input.breadboardRails || []).map((r) => r.bpId));
  const compById = new Map(catalog.components.map((c) => [c.id, c]));

  const netMap = new Map<string, ElectricalNet>();
  const unconnectedPins: UnconnectedPinRef[] = [];
  let totalConnections = 0;
  let i2cDevices = 0;

  for (const ob of board.onboardPeripherals) {
    if (ob.i2cAddr && input.onboard?.[ob.id]) i2cDevices++;
  }

  for (const inst of active) {
    const def = compById.get(inst.compId);
    if (!def) continue;
    if (def.interface === 'I2C') i2cDevices++;
    const uartInfo = uartMap[inst.instanceId];

    for (const p of def.pins) {
      const bpId = inst.pinMap[p.id];
      if (!bpId) {
        const isOpt = p.tier === 'optional' || p.tier === 'config' || p.tier === 'unused';
        if (p.selectable && !isOpt) {
          unconnectedPins.push({
            instanceId: inst.instanceId,
            compId: inst.compId,
            compPinId: p.id,
            allowedTypes: p.allowedTypes ? [...p.allowedTypes] : []
          });
        }
        continue;
      }

      const baseNet = classifyPinNet(bpId, board);
      const isUartSignal = p.role === 'UART_RX' || p.role === 'UART_TX';
      const kind: ElectricalNetKind = isUartSignal ? 'uart' : baseNet.kind;

      let net = netMap.get(baseNet.id);
      if (!net) {
        net = {
          id: baseNet.id,
          label: baseNet.label,
          kind,
          boardPinIds: [],
          endpoints: [],
          usesBreadboard: false
        };
        netMap.set(baseNet.id, net);
      }

      if (!net.boardPinIds.includes(bpId)) {
        net.boardPinIds.push(bpId);
      }

      const cHole = carrierWireMap[`${inst.instanceId}::${p.id}`];
      const att = inst.attachments?.[p.id];
      if (bbPinSet.has(bpId) || Boolean(cHole) || Boolean(att && att.kind !== 'board-pin')) {
        net.usesBreadboard = true;
      }
      if (isUartSignal && uartInfo) {
        net.kind = 'uart';
        net.uartKind = uartInfo.kind;
        net.uartChannel = uartInfo.channel;
      }

      net.endpoints.push({
        instanceId: inst.instanceId,
        compId: inst.compId,
        compName: def.name,
        compPinId: p.id,
        compPinRole: p.role || 'SIGNAL',
        boardPinId: bpId,
        ...(cHole?.label ? { carrierHoleLabel: cHole.label } : {})
      });
      totalConnections++;
    }
  }

  const nets = Array.from(netMap.values()).sort((a, b) => a.id.localeCompare(b.id));
  const powerNets = nets.filter((n) => n.kind === 'power' || n.kind === 'gnd').length;

  return {
    boardId: board.id,
    logicVoltage: board.electrical.logicVoltage,
    carrierEnabled,
    nets,
    unconnectedPins,
    stats: {
      totalNets: nets.length,
      totalConnections,
      powerNets,
      i2cDevices,
      uartChannels: Object.keys(uartMap).length
    }
  };
}
