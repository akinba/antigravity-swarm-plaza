import React, { useMemo } from 'react';
import type {
  OfficeEmployee,
  SwarmBoardMessage,
  SwarmMentionEdge,
  SwarmTaskNode,
} from '../../shared/types';
import { playSelectBlip } from '../audio/retroSynth';
import { useI18n } from '../i18n/translations';

export interface WorkflowDiagramEdge {
  from: string;
  to: string;
  count: number;
  lastSeq?: number;
  lastTime?: string;
}

export interface WorkflowDiagramSvgProps {
  edges: Array<SwarmMentionEdge | WorkflowDiagramEdge>;
  employees?: OfficeEmployee[];
  messages?: SwarmBoardMessage[];
  taskNodes?: SwarmTaskNode[];
  selectedAgent?: string | null;
  selectedEdge?: { from: string; to: string } | null;
  onSelectAgent?: (agentName: string | null) => void;
  onSelectEdge?: (edge: { from: string; to: string } | null) => void;
}

type NodeRoleKind = 'boss' | 'coding' | 'testing' | 'analysis' | 'broadcast';

interface DiagramNode {
  id: string; // canonical lowercase key ('coordinator', 'all', or lowercase employee name)
  filterKey: string; // key emitted to WhiteboardModal Gantt filter
  aliases: Set<string>;
  displayName: string;
  roleKind: NodeRoleKind;
  icon: string;
  status: 'working' | 'waiting' | 'idle' | 'error' | 'broadcast';
  isVerified: boolean;
  msgCount: number;
  handoffCount: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ComputedEdge {
  key: string;
  rawFrom: string;
  rawTo: string;
  fromNode: DiagramNode;
  toNode: DiagramNode;
  count: number;
  lastSeq: number;
  pathD: string;
  badgeX: number;
  badgeY: number;
  strokeColor: string;
  markerId: string;
}

const ROLE_PALETTE: Record<
  NodeRoleKind,
  {
    accent: string;
    cardBg: string;
    border: string;
    activeBorder: string;
    badgeBg: string;
  }
> = {
  boss: {
    accent: '#ffd54f',
    cardBg: '#1f1a10',
    border: '#9e7c22',
    activeBorder: '#ffe082',
    badgeBg: '#332912',
  },
  coding: {
    accent: '#00e5ff',
    cardBg: '#0f1b29',
    border: '#1f5f7a',
    activeBorder: '#6ef2ff',
    badgeBg: '#12293b',
  },
  testing: {
    accent: '#00e676',
    cardBg: '#0f2119',
    border: '#1f6e46',
    activeBorder: '#69f0ae',
    badgeBg: '#133022',
  },
  analysis: {
    accent: '#b388ff',
    cardBg: '#19152b',
    border: '#5a3f99',
    activeBorder: '#d1b3ff',
    badgeBg: '#251d40',
  },
  broadcast: {
    accent: '#b388ff',
    cardBg: '#211638',
    border: '#7c52cc',
    activeBorder: '#e0c6ff',
    badgeBg: '#2e1e4d',
  },
};

function inferRoleKind(name: string, emp?: OfficeEmployee): { kind: NodeRoleKind; icon: string } {
  const low = name.toLowerCase();
  if (low === 'all') {
    return { kind: 'broadcast', icon: '📢' };
  }
  if (low === 'coordinator' || emp?.isCoordinator || emp?.swarmRole === 'coordinator') {
    return { kind: 'boss', icon: '👑' };
  }
  if (
    emp?.swarmRole === 'verifier' ||
    /(verifier|qa|test)/i.test(low) ||
    /(qa|test|verif)/i.test(emp?.roleTitle ?? '')
  ) {
    return { kind: 'testing', icon: '🧪' };
  }
  if (
    /(analyst|architect|grill|monitor|research|investigat)/i.test(low) ||
    /(architect|analyst|research)/i.test(emp?.roleTitle ?? '')
  ) {
    return { kind: 'analysis', icon: '🔍' };
  }
  return { kind: 'coding', icon: '💻' };
}

function clipRayToRect(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  targetX: number,
  targetY: number,
): { x: number; y: number } {
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: cx, y: cy };
  }
  const tx = Math.abs(dx) > 0.001 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const ty = Math.abs(dy) > 0.001 ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const t = Math.min(tx, ty);
  return {
    x: cx + dx * t,
    y: cy + dy * t,
  };
}

export const WorkflowDiagramSvg: React.FC<WorkflowDiagramSvgProps> = ({
  edges,
  employees = [],
  messages = [],
  taskNodes = [],
  selectedAgent = null,
  selectedEdge = null,
  onSelectAgent,
  onSelectEdge,
}) => {
  const { locale, t } = useI18n();

  const { nodes, computedEdges, totalHandoffs } = useMemo(() => {
    const VIEW_W = 880;
    const VIEW_H = 304;
    const msgCountByAgent = new Map<string, number>();
    for (const m of messages) {
      const k = (m.agent || '').trim().toLowerCase();
      if (k) msgCountByAgent.set(k, (msgCountByAgent.get(k) ?? 0) + 1);
    }

    const verifiedOwners = new Set<string>();
    for (const tn of taskNodes) {
      if (tn.status === 'verified') {
        verifiedOwners.add(tn.ownerName.trim().toLowerCase());
      }
    }

    const coordEmp = employees.find(
      (e) => e.isCoordinator || e.name.toLowerCase() === 'coordinator',
    );

    const aliasToCanonical = new Map<string, string>();
    const nodeDrafts = new Map<
      string,
      Omit<DiagramNode, 'x' | 'y' | 'handoffCount'> & { handoffCount: number }
    >();

    // 1. Register Boss / Coordinator node if present in employees or edges
    const hasCoordInEdges = edges.some(
      (e) =>
        e.from.toLowerCase() === 'coordinator' ||
        e.to.toLowerCase() === 'coordinator' ||
        (coordEmp &&
          (e.from.toLowerCase() === coordEmp.name.toLowerCase() ||
            e.to.toLowerCase() === coordEmp.name.toLowerCase())),
    );

    if (coordEmp || hasCoordInEdges) {
      const aliases = new Set<string>(['coordinator']);
      if (coordEmp?.name) aliases.add(coordEmp.name.toLowerCase());
      aliases.forEach((a) => aliasToCanonical.set(a, 'coordinator'));

      const coordMsgs =
        (msgCountByAgent.get('coordinator') ?? 0) +
        (coordEmp && coordEmp.name.toLowerCase() !== 'coordinator'
          ? msgCountByAgent.get(coordEmp.name.toLowerCase()) ?? 0
          : 0);

      nodeDrafts.set('coordinator', {
        id: 'coordinator',
        filterKey: coordEmp?.name ?? 'coordinator',
        aliases,
        displayName:
          coordEmp && coordEmp.name.toLowerCase() !== 'coordinator'
            ? coordEmp.name
            : 'COORDINATOR',
        roleKind: 'boss',
        icon: '👑',
        status: coordEmp?.status ?? 'working',
        isVerified: Boolean(coordEmp?.health?.isVerifiedOutput),
        msgCount: coordMsgs,
        handoffCount: 0,
        width: 152,
        height: 50,
      });
    }

    // 2. Register active floor employees (workers)
    for (const emp of employees) {
      if (emp === coordEmp || emp.name.toLowerCase() === 'coordinator') continue;
      const key = emp.name.trim().toLowerCase();
      if (!key || nodeDrafts.has(key)) continue;
      const { kind, icon } = inferRoleKind(emp.name, emp);
      const aliases = new Set<string>([key]);
      aliasToCanonical.set(key, key);
      nodeDrafts.set(key, {
        id: key,
        filterKey: emp.name,
        aliases,
        displayName: emp.name,
        roleKind: kind,
        icon,
        status: emp.status,
        isVerified: Boolean(emp.health?.isVerifiedOutput || verifiedOwners.has(key)),
        msgCount: msgCountByAgent.get(key) ?? 0,
        handoffCount: 0,
        width: 128,
        height: 46,
      });
    }

    // 3. Register @all or any extra valid edge endpoint not yet in drafts
    for (const e of edges) {
      for (const endpoint of [e.from, e.to]) {
        const low = endpoint.trim().toLowerCase();
        if (!low || aliasToCanonical.has(low)) continue;
        if (low === 'all') {
          aliasToCanonical.set('all', 'all');
          nodeDrafts.set('all', {
            id: 'all',
            filterKey: 'all',
            aliases: new Set(['all']),
            displayName: '@all',
            roleKind: 'broadcast',
            icon: '📢',
            status: 'broadcast',
            isVerified: false,
            msgCount: 0,
            handoffCount: 0,
            width: 112,
            height: 44,
          });
        } else if (employees.length === 0) {
          // Fallback only when employees prop wasn't populated
          const { kind, icon } = inferRoleKind(endpoint);
          aliasToCanonical.set(low, low);
          nodeDrafts.set(low, {
            id: low,
            filterKey: endpoint,
            aliases: new Set([low]),
            displayName: endpoint,
            roleKind: kind,
            icon,
            status: 'waiting',
            isVerified: verifiedOwners.has(low),
            msgCount: msgCountByAgent.get(low) ?? 0,
            handoffCount: 0,
            width: 128,
            height: 46,
          });
        }
      }
    }

    // Aggregate canonical edges & handoff totals
    const canonicalEdgeMap = new Map<
      string,
      {
        fromId: string;
        toId: string;
        rawFrom: string;
        rawTo: string;
        count: number;
        lastSeq: number;
      }
    >();
    let sumHandoffs = 0;

    for (const e of edges) {
      const fId = aliasToCanonical.get(e.from.trim().toLowerCase());
      const tId = aliasToCanonical.get(e.to.trim().toLowerCase());
      if (!fId || !tId || fId === tId) continue;
      const fromDraft = nodeDrafts.get(fId);
      const toDraft = nodeDrafts.get(tId);
      if (!fromDraft || !toDraft) continue;

      fromDraft.handoffCount += e.count;
      toDraft.handoffCount += e.count;
      sumHandoffs += e.count;

      const pairKey = `${fId}->${tId}`;
      const existing = canonicalEdgeMap.get(pairKey);
      const seq = e.lastSeq ?? 0;
      if (existing) {
        existing.count += e.count;
        if (seq >= existing.lastSeq) {
          existing.lastSeq = seq;
          existing.rawFrom = e.from;
          existing.rawTo = e.to;
        }
      } else {
        canonicalEdgeMap.set(pairKey, {
          fromId: fId,
          toId: tId,
          rawFrom: e.from,
          rawTo: e.to,
          count: e.count,
          lastSeq: seq,
        });
      }
    }

    // 4. Hierarchical Amphitheater Positioning (collision-free across 1..12+ nodes)
    const bossDraft = nodeDrafts.get('coordinator') ?? null;
    const broadcastDraft = nodeDrafts.get('all') ?? null;
    const workerDrafts = Array.from(nodeDrafts.values()).filter(
      (n) => n.id !== 'coordinator' && n.id !== 'all',
    );

    // Order workers cleanly by role kind so related specialists group naturally
    const roleOrder: Record<NodeRoleKind, number> = {
      analysis: 0,
      coding: 1,
      testing: 2,
      boss: 3,
      broadcast: 4,
    };
    workerDrafts.sort(
      (a, b) => roleOrder[a.roleKind] - roleOrder[b.roleKind] || a.displayName.localeCompare(b.displayName),
    );

    const positionedNodes: DiagramNode[] = [];
    const nodeById = new Map<string, DiagramNode>();

    if (bossDraft) {
      const bossNode: DiagramNode = {
        ...bossDraft,
        x: broadcastDraft ? 416 : VIEW_W / 2,
        y: 48,
      };
      positionedNodes.push(bossNode);
      nodeById.set(bossNode.id, bossNode);
    }

    if (broadcastDraft) {
      const bNode: DiagramNode = {
        ...broadcastDraft,
        x: 786,
        y: 52,
      };
      positionedNodes.push(bNode);
      nodeById.set(bNode.id, bNode);
    }

    const wCount = workerDrafts.length;
    if (wCount === 1) {
      const wNode: DiagramNode = {
        ...workerDrafts[0],
        x: VIEW_W / 2,
        y: bossDraft ? 210 : 152,
      };
      positionedNodes.push(wNode);
      nodeById.set(wNode.id, wNode);
    } else if (wCount > 1 && wCount <= 6) {
      const leftX = wCount <= 3 ? 190 : 84;
      const rightX = wCount <= 3 ? VIEW_W - 190 : VIEW_W - 84;
      const cardW = wCount >= 6 ? 120 : 128;
      workerDrafts.forEach((w, idx) => {
        const u = idx / (wCount - 1); // 0 .. 1
        const x = Math.round(leftX + u * (rightX - leftX));
        // Spacious concave amphitheater arc leaving atrium (y:75..148) & under-arc (y:246..296) clear
        const arcDepth = Math.sin(u * Math.PI);
        const stagger = wCount >= 5 ? (idx % 2 === 0 ? -11 : 11) : 0;
        const baseY = bossDraft ? 170 + Math.round(arcDepth * 42) + stagger : 150 + stagger;
        const y = Math.max(146, Math.min(230, baseY));
        const wNode: DiagramNode = { ...w, width: cardW, x, y };
        positionedNodes.push(wNode);
        nodeById.set(wNode.id, wNode);
      });
    } else if (wCount > 6) {
      // Two staggered horizontal tiers for 7+ workers so cards never touch
      const topCount = Math.ceil(wCount / 2);
      const bottomCount = wCount - topCount;
      workerDrafts.forEach((w, idx) => {
        const isTop = idx < topCount;
        const rowIdx = isTop ? idx : idx - topCount;
        const rowTotal = isTop ? topCount : bottomCount;
        const margin = isTop ? 92 : 140;
        const span = VIEW_W - margin * 2;
        const x =
          rowTotal === 1
            ? VIEW_W / 2
            : Math.round(margin + (rowIdx / (rowTotal - 1)) * span);
        const u = rowTotal === 1 ? 0.5 : rowIdx / (rowTotal - 1);
        const y = isTop
          ? Math.round(148 + Math.sin(u * Math.PI) * 18)
          : Math.round(238 + Math.sin(u * Math.PI) * 16);
        const wNode: DiagramNode = { ...w, x, y };
        positionedNodes.push(wNode);
        nodeById.set(wNode.id, wNode);
      });
    }

    // 5. Quadratic Bezier Curve Routing + Non-overlapping Midpoint Badges
    const edgeDrafts = Array.from(canonicalEdgeMap.values()).sort(
      (a, b) => a.count - b.count || a.lastSeq - b.lastSeq,
    );

    const rawComputed: ComputedEdge[] = [];

    for (const ed of edgeDrafts) {
      const fromNode = nodeById.get(ed.fromId);
      const toNode = nodeById.get(ed.toId);
      if (!fromNode || !toNode) continue;

      const hasReverse = canonicalEdgeMap.has(`${ed.toId}->${ed.fromId}`);
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const dist = Math.hypot(dx, dy) || 1;

      // Unit normal perpendicular to directed edge (automatically flips sign for B -> A!)
      const nx = -dy / dist;
      const ny = dx / dist;

      const isLongPeerSpan =
        fromNode.roleKind !== 'boss' &&
        toNode.roleKind !== 'boss' &&
        fromNode.roleKind !== 'broadcast' &&
        toNode.roleKind !== 'broadcast' &&
        Math.abs(dx) > 190;

      let ctrlX: number;
      let ctrlY: number;
      if (isLongPeerSpan) {
        // Route long peer-to-peer handoffs cleanly underneath (or above for reverse) intermediate worker cards
        const routeUnder = !hasReverse || ed.fromId < ed.toId;
        ctrlX = (fromNode.x + toNode.x) / 2;
        ctrlY = routeUnder
          ? Math.min(VIEW_H - 12, Math.max(fromNode.y, toNode.y) + 56)
          : Math.max(96, Math.min(fromNode.y, toNode.y) - 58);
      } else {
        // Deterministic gentle curve for single edges; wider separated lens for bidirectional pairs
        const singleBendSign = ed.fromId < ed.toId ? 1 : -1;
        const bendMag = hasReverse
          ? Math.min(48, Math.max(28, dist * 0.17))
          : Math.min(28, Math.max(15, dist * 0.09)) * singleBendSign;
        ctrlX = (fromNode.x + toNode.x) / 2 + nx * bendMag;
        ctrlY = (fromNode.y + toNode.y) / 2 + ny * bendMag;
      }

      // Clip start & end points accurately against rectangular card borders along tangent rays
      const startPt = clipRayToRect(
        fromNode.x,
        fromNode.y,
        fromNode.width / 2 + 4,
        fromNode.height / 2 + 4,
        ctrlX,
        ctrlY,
      );
      const endPt = clipRayToRect(
        toNode.x,
        toNode.y,
        toNode.width / 2 + 7,
        toNode.height / 2 + 7,
        ctrlX,
        ctrlY,
      );

      // Exact point on Quadratic Bezier (slightly shifted to t=0.46 when bidirectional for extra badge clearance)
      const tParam = hasReverse ? 0.45 : 0.5;
      const omt = 1 - tParam;
      const badgeX = omt * omt * startPt.x + 2 * omt * tParam * ctrlX + tParam * tParam * endPt.x;
      const badgeY = omt * omt * startPt.y + 2 * omt * tParam * ctrlY + tParam * tParam * endPt.y;

      let strokeColor = '#3cd8ff';
      let markerId = 'wf-arrow-cyan';
      if (toNode.roleKind === 'broadcast') {
        strokeColor = '#b388ff';
        markerId = 'wf-arrow-purple';
      } else if (fromNode.roleKind === 'boss') {
        strokeColor = '#ffd54f';
        markerId = 'wf-arrow-gold';
      } else if (fromNode.roleKind === 'testing' || toNode.roleKind === 'boss') {
        strokeColor = '#3be87a';
        markerId = 'wf-arrow-green';
      }

      rawComputed.push({
        key: `${ed.fromId}->${ed.toId}`,
        rawFrom: ed.rawFrom,
        rawTo: ed.rawTo,
        fromNode,
        toNode,
        count: ed.count,
        lastSeq: ed.lastSeq,
        pathD: `M ${startPt.x.toFixed(1)} ${startPt.y.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${endPt.x.toFixed(1)} ${endPt.y.toFixed(1)}`,
        badgeX,
        badgeY,
        strokeColor,
        markerId,
      });
    }

    // Card-aware + peer-aware repulsion so frequency badges (×N) never collide with cards or each other
    for (let iter = 0; iter < 5; iter++) {
      for (const edge of rawComputed) {
        for (const node of positionedNodes) {
          const padX = node.width / 2 + 16;
          const padY = node.height / 2 + 11;
          const ndx = edge.badgeX - node.x;
          const ndy = edge.badgeY - node.y;
          if (Math.abs(ndx) < padX && Math.abs(ndy) < padY) {
            const overlapX = padX - Math.abs(ndx);
            const overlapY = padY - Math.abs(ndy);
            if (overlapY <= overlapX) {
              edge.badgeY += (ndy >= 0 ? 1 : -1) * (overlapY + 2);
            } else {
              edge.badgeX += (ndx >= 0 ? 1 : -1) * (overlapX + 2);
            }
          }
        }
      }
      for (let i = 0; i < rawComputed.length; i++) {
        for (let j = i + 1; j < rawComputed.length; j++) {
          const a = rawComputed[i];
          const b = rawComputed[j];
          const bdx = b.badgeX - a.badgeX;
          const bdy = b.badgeY - a.badgeY;
          const minDx = 30;
          const minDy = 18;
          if (Math.abs(bdx) < minDx && Math.abs(bdy) < minDy) {
            const pushX = (minDx - Math.abs(bdx)) * 0.35 * (bdx >= 0 ? 1 : -1);
            const pushY = (minDy - Math.abs(bdy)) * 0.55 * (bdy >= 0 ? 1 : -1);
            a.badgeX -= pushX;
            b.badgeX += pushX;
            a.badgeY -= pushY;
            b.badgeY += pushY;
          }
        }
      }
      for (const edge of rawComputed) {
        edge.badgeX = Math.max(22, Math.min(VIEW_W - 22, edge.badgeX));
        edge.badgeY = Math.max(14, Math.min(VIEW_H - 12, edge.badgeY));
      }
    }

    return {
      nodes: positionedNodes,
      computedEdges: rawComputed,
      totalHandoffs: sumHandoffs,
    };
  }, [edges, employees, messages, taskNodes]);

  const selectedAgentLow = selectedAgent?.trim().toLowerCase() ?? null;
  const selectedEdgeFromLow = selectedEdge?.from.trim().toLowerCase() ?? null;
  const selectedEdgeToLow = selectedEdge?.to.trim().toLowerCase() ?? null;
  const hasSelection = Boolean(selectedAgentLow || (selectedEdgeFromLow && selectedEdgeToLow));

  const isNodeMatchedByAgent = (node: DiagramNode, agentLow: string | null): boolean => {
    if (!agentLow) return false;
    return node.aliases.has(agentLow) || node.filterKey.toLowerCase() === agentLow;
  };

  const isEdgeActive = (edge: ComputedEdge): boolean => {
    if (selectedEdgeFromLow && selectedEdgeToLow) {
      return (
        isNodeMatchedByAgent(edge.fromNode, selectedEdgeFromLow) &&
        isNodeMatchedByAgent(edge.toNode, selectedEdgeToLow)
      );
    }
    if (selectedAgentLow) {
      return (
        isNodeMatchedByAgent(edge.fromNode, selectedAgentLow) ||
        isNodeMatchedByAgent(edge.toNode, selectedAgentLow)
      );
    }
    return false;
  };

  const isNodeHighlighted = (node: DiagramNode): boolean => {
    if (selectedAgentLow) {
      if (isNodeMatchedByAgent(node, selectedAgentLow)) return true;
      return computedEdges.some(
        (ed) =>
          (isNodeMatchedByAgent(ed.fromNode, selectedAgentLow) && ed.toNode.id === node.id) ||
          (isNodeMatchedByAgent(ed.toNode, selectedAgentLow) && ed.fromNode.id === node.id),
      );
    }
    if (selectedEdgeFromLow && selectedEdgeToLow) {
      return (
        isNodeMatchedByAgent(node, selectedEdgeFromLow) ||
        isNodeMatchedByAgent(node, selectedEdgeToLow)
      );
    }
    return false;
  };

  const statusTextFor = (status: DiagramNode['status']): { label: string; color: string } => {
    if (status === 'broadcast') {
      return {
        label: locale === 'tr' ? 'YAYIN' : 'CAST',
        color: '#d1b3ff',
      };
    }
    if (status === 'working') {
      return { label: t.statuses.working.toUpperCase(), color: '#3be87a' };
    }
    if (status === 'error') {
      return { label: t.statuses.error.toUpperCase(), color: '#ff5666' };
    }
    return { label: t.statuses.waiting.toUpperCase(), color: '#ffbe3b' };
  };

  if (nodes.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: '#090e1a',
        border: '2px solid #243252',
        boxShadow: 'inset 0 0 24px rgba(10, 18, 36, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {/* Compact Blueprint Header Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '4px 10px',
          background: '#0f1628',
          borderBottom: '1px solid #1e2c4a',
          fontSize: 9,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="pixel-title" style={{ fontSize: 9, color: '#3cd8ff' }}>
            {locale === 'tr' ? '🧭 CANLI AJAN İŞ AKIŞI TOPOLOJİSİ' : '🧭 LIVE SWARM WORKFLOW TOPOLOGY'}
          </span>
          <span className="pixel-badge" style={{ color: '#ffd54f', fontSize: 8 }}>
            👥 {nodes.length}
          </span>
          <span className="pixel-badge" style={{ color: '#b388ff', fontSize: 8 }}>
            ⇄ {totalHandoffs}
          </span>
        </div>

        <span style={{ color: '#8ea0c8', fontSize: 9 }}>
          {locale === 'tr'
            ? '💡 Düğüme veya oka tıklayarak aşağıdaki Gantt akışını süzün'
            : '💡 Click any node or curved arrow to filter Gantt below'}
        </span>
      </div>

      <svg
        viewBox="0 0 880 304"
        style={{
          width: '100%',
          height: 'auto',
          minHeight: 215,
          maxHeight: 272,
          display: 'block',
          userSelect: 'none',
          cursor: hasSelection ? 'pointer' : 'default',
        }}
        onClick={() => {
          if (hasSelection) {
            playSelectBlip();
            onSelectAgent?.(null);
            onSelectEdge?.(null);
          }
        }}
      >
        <defs>
          <pattern id="wf-grid-minor" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#111b30" strokeWidth="0.75" />
          </pattern>
          <pattern id="wf-grid-major" width="64" height="64" patternUnits="userSpaceOnUse">
            <rect width="64" height="64" fill="url(#wf-grid-minor)" />
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#182644" strokeWidth="1.1" />
            <circle cx="0" cy="0" r="1.3" fill="#29406e" />
          </pattern>
          <radialGradient id="wf-hub-glow" cx="50%" cy="32%" r="56%">
            <stop offset="0%" stopColor="#3cd8ff" stopOpacity="0.12" />
            <stop offset="52%" stopColor="#8a63ff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#090e1a" stopOpacity="0" />
          </radialGradient>

          <filter id="wf-neon-glow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <marker
            id="wf-arrow-gold"
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0,0.5 6.8,3.5 0,6.5" fill="#ffd54f" />
          </marker>
          <marker
            id="wf-arrow-cyan"
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0,0.5 6.8,3.5 0,6.5" fill="#3cd8ff" />
          </marker>
          <marker
            id="wf-arrow-purple"
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0,0.5 6.8,3.5 0,6.5" fill="#b388ff" />
          </marker>
          <marker
            id="wf-arrow-green"
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0,0.5 6.8,3.5 0,6.5" fill="#3be87a" />
          </marker>
          <marker
            id="wf-arrow-bright"
            markerWidth="7.5"
            markerHeight="7.5"
            refX="6.2"
            refY="3.75"
            orient="auto"
          >
            <polygon points="0,0.4 7,3.75 0,7.1" fill="#6ef2ff" />
          </marker>
        </defs>

        {/* Blueprint Technical Grid + Radial Glow */}
        <rect width="880" height="304" fill="#090e1a" />
        <rect width="880" height="304" fill="url(#wf-grid-major)" />
        <rect width="880" height="304" fill="url(#wf-hub-glow)" />

        {/* Layer 1: Curved Quadratic Bezier Edges (drawn underneath cards) */}
        {computedEdges.map((edge) => {
          const active = isEdgeActive(edge);
          const dimmed = hasSelection && !active;
          const baseWidth = Math.min(3.4, 1.35 + Math.log2(edge.count + 1) * 0.65);
          const strokeWidth = active ? baseWidth + 1.1 : baseWidth;
          const stroke = active ? '#6ef2ff' : edge.strokeColor;
          const marker = active ? 'url(#wf-arrow-bright)' : `url(#${edge.markerId})`;

          return (
            <g
              key={edge.key}
              style={{
                cursor: 'pointer',
                opacity: dimmed ? 0.2 : 1,
                transition: 'opacity 140ms ease',
              }}
              onClick={(ev) => {
                ev.stopPropagation();
                playSelectBlip();
                if (
                  selectedEdgeFromLow &&
                  selectedEdgeToLow &&
                  isNodeMatchedByAgent(edge.fromNode, selectedEdgeFromLow) &&
                  isNodeMatchedByAgent(edge.toNode, selectedEdgeToLow)
                ) {
                  onSelectEdge?.(null);
                } else {
                  onSelectEdge?.({ from: edge.rawFrom, to: edge.rawTo });
                }
              }}
            >
              {/* Invisible wide hit-target along Bezier curve for easy clicking */}
              <path d={edge.pathD} fill="none" stroke="transparent" strokeWidth={13} />

              {/* Main curved Bezier connector */}
              <path
                d={edge.pathD}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeOpacity={active ? 0.98 : 0.78}
                strokeDasharray={edge.toNode.roleKind === 'broadcast' && !active ? '5 3' : undefined}
                markerEnd={marker}
                filter={active ? 'url(#wf-neon-glow)' : undefined}
              />
            </g>
          );
        })}

        {/* Layer 2: Hierarchical Retro-Glass Agent Node Cards */}
        {nodes.map((node) => {
          const palette = ROLE_PALETTE[node.roleKind];
          const isPrimarySelected = isNodeMatchedByAgent(node, selectedAgentLow);
          const highlighted = isNodeHighlighted(node);
          const dimmed = hasSelection && !highlighted;
          const st = statusTextFor(node.status);
          const halfW = node.width / 2;
          const halfH = node.height / 2;
          const baseMax = node.roleKind === 'boss' ? 16 : node.width <= 120 ? 13 : 14;
          const maxChars = baseMax - (node.isVerified ? 2 : 0);
          const shortName =
            node.displayName.length > maxChars
              ? `${node.displayName.slice(0, maxChars - 1)}…`
              : node.displayName;

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              style={{
                cursor: 'pointer',
                opacity: dimmed ? 0.28 : 1,
                transition: 'opacity 140ms ease',
              }}
              onClick={(ev) => {
                ev.stopPropagation();
                playSelectBlip();
                if (isPrimarySelected) {
                  onSelectAgent?.(null);
                } else {
                  onSelectAgent?.(node.filterKey);
                }
              }}
            >
              {/* Drop shadow */}
              <rect
                x={-halfW + 2}
                y={-halfH + 3}
                width={node.width}
                height={node.height}
                rx={4}
                fill="rgba(3, 6, 14, 0.72)"
              />

              {/* Outer card frame */}
              <rect
                x={-halfW}
                y={-halfH}
                width={node.width}
                height={node.height}
                rx={4}
                fill={palette.cardBg}
                stroke={
                  isPrimarySelected
                    ? '#6ef2ff'
                    : highlighted
                      ? palette.activeBorder
                      : palette.border
                }
                strokeWidth={isPrimarySelected ? 2.4 : node.roleKind === 'boss' ? 2 : 1.6}
                filter={isPrimarySelected ? 'url(#wf-neon-glow)' : undefined}
              />

              {/* Top accent bar */}
              <rect
                x={-halfW + 1}
                y={-halfH + 1}
                width={node.width - 2}
                height={4}
                rx={2}
                fill={isPrimarySelected ? '#6ef2ff' : palette.accent}
              />

              {/* Boss Crown Header Tag */}
              {node.roleKind === 'boss' && (
                <g transform={`translate(0, ${-halfH - 8})`}>
                  <rect
                    x={-44}
                    y={-7}
                    width={88}
                    height={13}
                    rx={2}
                    fill="#2b210d"
                    stroke="#ffd54f"
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={2.5}
                    textAnchor="middle"
                    fill="#ffd54f"
                    fontSize="8"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    ★ BOSS HUB
                  </text>
                </g>
              )}

              {/* Row 1: Role Icon + Agent Name + Verified Check */}
              <text
                x={-halfW + 8}
                y={-3}
                fill="#f4f7ff"
                fontSize="10.5"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {node.icon} {shortName}
              </text>

              {node.isVerified && (
                <g transform={`translate(${halfW - 13}, -7)`}>
                  <rect
                    x={-7}
                    y={-6}
                    width={14}
                    height={12}
                    rx={2}
                    fill="#123020"
                    stroke="#3be87a"
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={3}
                    textAnchor="middle"
                    fill="#3be87a"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    ✓
                  </text>
                </g>
              )}

              {/* Row 2: Live Status Dot + Handoff/Message Counter Pill */}
              <circle cx={-halfW + 12} cy={12} r={3.2} fill={st.color} />
              <text
                x={-halfW + 19}
                y={15}
                fill={st.color}
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {st.label}
              </text>

              <g transform={`translate(${halfW - 22}, 12)`}>
                <rect
                  x={-16}
                  y={-6.5}
                  width={32}
                  height={13}
                  rx={2}
                  fill={palette.badgeBg}
                  stroke={palette.border}
                  strokeWidth={0.9}
                />
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  fill="#dce6ff"
                  fontSize="8.2"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  ⇄{node.handoffCount}
                </text>
              </g>
            </g>
          );
        })}

        {/* Layer 3: Non-Occluded Midpoint Frequency Pills (×N) */}
        {computedEdges.map((edge) => {
          const active = isEdgeActive(edge);
          const dimmed = hasSelection && !active;
          const badgeText = `×${edge.count}`;
          const badgeW = Math.max(24, badgeText.length * 6.5 + 8);

          return (
            <g
              key={`badge-${edge.key}`}
              transform={`translate(${edge.badgeX.toFixed(1)}, ${edge.badgeY.toFixed(1)})`}
              style={{
                cursor: 'pointer',
                opacity: dimmed ? 0.22 : 1,
                transition: 'opacity 140ms ease',
              }}
              onClick={(ev) => {
                ev.stopPropagation();
                playSelectBlip();
                if (
                  selectedEdgeFromLow &&
                  selectedEdgeToLow &&
                  isNodeMatchedByAgent(edge.fromNode, selectedEdgeFromLow) &&
                  isNodeMatchedByAgent(edge.toNode, selectedEdgeToLow)
                ) {
                  onSelectEdge?.(null);
                } else {
                  onSelectEdge?.({ from: edge.rawFrom, to: edge.rawTo });
                }
              }}
            >
              <rect
                x={-badgeW / 2}
                y={-8.5}
                width={badgeW}
                height={16}
                rx={3}
                fill={active ? '#10263a' : '#101729'}
                stroke={active ? '#6ef2ff' : edge.strokeColor}
                strokeWidth={active ? 1.6 : 1.1}
              />
              <text
                x={0}
                y={3.2}
                textAnchor="middle"
                fill={active ? '#ffffff' : '#ffe082'}
                fontSize="9.5"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {badgeText}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default WorkflowDiagramSvg;
