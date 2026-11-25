// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Multi-Node Project Graph Store (Manages ProjectNode Map & InterNodeLink Topology)
import type { InterNodeLink, ProjectDocument, ProjectNode } from '../types';
import { DEFAULT_BOARD_ID, getBoardById } from '../boards';
import { DEFAULT_NODE_ID } from './ui-session';

function cloneNode(node: ProjectNode): ProjectNode {
  return {
    id: node.id,
    boardId: node.boardId,
    codeProfile: node.codeProfile,
    carrierId: node.carrierId,
    powerDistribution: node.powerDistribution,
    onboard: { ...node.onboard },
    oledPaged: Boolean(node.oledPaged),
    modules: node.modules.map((m) => ({
      ...m,
      pinMap: { ...m.pinMap },
      ...(m.attachments ? { attachments: { ...m.attachments } } : {}),
      position: m.position ? { ...m.position } : null
    })),
    codeBlocks: node.codeBlocks.map((b) => ({
      type: b.type,
      config: { ...b.config }
    }))
  };
}

function createEmptyNode(id: string, boardId: string = DEFAULT_BOARD_ID): ProjectNode {
  const board = getBoardById(boardId);
  return {
    id,
    boardId: board ? board.id : boardId,
    codeProfile: board ? board.defaultCodeProfile : 'generic-scaffold',
    carrierId: board?.carrier?.defaultEnabled ? board.carrier.id : null,
    powerDistribution: 'smart',
    onboard: {},
    oledPaged: false,
    modules: [],
    codeBlocks: []
  };
}

const nodeOrder: string[] = [];
const nodeMap = new Map<string, ProjectNode>();
let interNodeLinks: InterNodeLink[] = [];
let nextNodeSeq = 1;

export const nodeGraphStore = {
  listNodes(): ProjectNode[] {
    return nodeOrder
      .map((id) => nodeMap.get(id))
      .filter((n): n is ProjectNode => Boolean(n))
      .map(cloneNode);
  },

  getNode(nodeId: string): ProjectNode | null {
    const hit = nodeMap.get(nodeId);
    return hit ? cloneNode(hit) : null;
  },

  hasNode(nodeId: string): boolean {
    return nodeMap.has(nodeId);
  },

  upsertNode(node: ProjectNode): ProjectNode {
    const clean = cloneNode(node);
    if (!nodeMap.has(clean.id)) {
      nodeOrder.push(clean.id);
    }
    nodeMap.set(clean.id, clean);
    return cloneNode(clean);
  },

  addNode(boardId: string = DEFAULT_BOARD_ID, explicitId?: string): ProjectNode {
    let id = (explicitId || '').trim();
    if (!id) {
      do {
        id = `node_${nextNodeSeq++}`;
      } while (nodeMap.has(id));
    }
    const created = createEmptyNode(id, boardId);
    return this.upsertNode(created);
  },

  removeNode(nodeId: string): boolean {
    if (!nodeMap.has(nodeId) || nodeOrder.length <= 1) return false;
    nodeMap.delete(nodeId);
    const idx = nodeOrder.indexOf(nodeId);
    if (idx !== -1) nodeOrder.splice(idx, 1);
    interNodeLinks = interNodeLinks.filter((l) => l.fromNodeId !== nodeId && l.toNodeId !== nodeId);
    return true;
  },

  getLinks(): InterNodeLink[] {
    return interNodeLinks.map((l) => ({ ...l }));
  },

  setLinks(links: ReadonlyArray<InterNodeLink>): InterNodeLink[] {
    interNodeLinks = links.map((l) => ({ ...l }));
    return this.getLinks();
  },

  addLink(link: InterNodeLink): InterNodeLink {
    const clean = { ...link };
    const idx = interNodeLinks.findIndex((l) => l.id === clean.id);
    if (idx !== -1) interNodeLinks[idx] = clean;
    else interNodeLinks.push(clean);
    return { ...clean };
  },

  removeLink(linkId: string): boolean {
    const before = interNodeLinks.length;
    interNodeLinks = interNodeLinks.filter((l) => l.id !== linkId);
    return interNodeLinks.length !== before;
  },

  /** Hydrates the multi-node graph from a validated canonical ProjectDocument v1. */
  syncFromDocument(doc: ProjectDocument): void {
    nodeOrder.length = 0;
    nodeMap.clear();
    for (const node of doc.nodes) {
      this.upsertNode(node);
    }
    interNodeLinks = (doc.links || []).map((l) => ({ ...l }));
  },

  /**
   * Produces the full `nodes[]` array for serialization by merging the live active node
   * snapshot with all secondary nodes stored in the graph.
   * If the active node was not yet registered explicitly (e.g. a secondary node was added
   * before the first save), it is inserted at index 0 so the active primary node stays `nodes[0]`.
   */
  mergeActiveNodeIntoList(activeNodeSnapshot: ProjectNode): ProjectNode[] {
    const activeId = activeNodeSnapshot.id || DEFAULT_NODE_ID;
    const normalized: ProjectNode = { ...cloneNode(activeNodeSnapshot), id: activeId };
    if (!nodeMap.has(activeId)) {
      nodeOrder.unshift(activeId);
      nodeMap.set(activeId, cloneNode(normalized));
    } else {
      nodeMap.set(activeId, cloneNode(normalized));
    }
    return this.listNodes();
  },

  reset(): void {
    nodeOrder.length = 0;
    nodeMap.clear();
    interNodeLinks = [];
    nextNodeSeq = 1;
  }
};
