'use client';

import { useRef, useState, type PointerEvent } from 'react';
import type { PenNode, VectorPoint } from '@/lib/advanced-vector';

type Position = { x: number; y: number };
type Handle = { index: number; kind: 'anchor' | 'incoming' | 'outgoing' };

type Props = {
  nodes: PenNode[];
  toScreen: (point: VectorPoint) => Position;
  toWorld: (point: Position) => VectorPoint;
  onCommit: (nodes: PenNode[]) => void;
};

export function PenHandles({ nodes, toScreen, toWorld, onCommit }: Props) {
  const [draft, setDraft] = useState<PenNode[] | null>(null);
  const active = useRef<Handle | null>(null);
  const current = useRef<PenNode[] | null>(null);
  const shown = draft || nodes;

  function start(event: PointerEvent<SVGCircleElement>, handle: Handle) {
    event.stopPropagation();
    event.preventDefault();
    active.current = handle;
    current.current = shown.map((node) => ({ ...node }));
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<SVGCircleElement>) {
    if (!active.current || !current.current) return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const point = toWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    const { index, kind } = active.current;
    const next = current.current.map((node) => ({ ...node }));
    const node = next[index];
    if (kind === 'anchor') {
      const dx = point.x - node.x;
      const dy = point.y - node.y;
      for (const key of ['incoming', 'outgoing'] as const) {
        if (node[key]) node[key] = { x: node[key]!.x + dx, y: node[key]!.y + dy };
      }
      node.x = point.x;
      node.y = point.y;
    } else {
      node[kind] = point;
    }
    current.current = next;
    setDraft(next);
  }

  function finish(event: PointerEvent<SVGCircleElement>) {
    if (!active.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const result = current.current;
    active.current = null;
    current.current = null;
    setDraft(null);
    if (result) onCommit(result);
  }

  const dots: { position: Position; handle: Handle; color: string }[] = [];
  shown.forEach((node, index) => {
    dots.push({ position: toScreen(node), handle: { index, kind: 'anchor' },
      color: '#fffdf6' });
    if (node.incoming) dots.push({ position: toScreen(node.incoming),
      handle: { index, kind: 'incoming' }, color: '#f8d474' });
    if (node.outgoing) dots.push({ position: toScreen(node.outgoing),
      handle: { index, kind: 'outgoing' }, color: '#a6d6c4' });
  });

  return (
    <svg className="curve-handle-overlay" aria-label="Editable vector path nodes">
      {shown.map((node, index) => (
        <g key={index} stroke="#ad7a4e" strokeDasharray="4 4" strokeWidth="1.3">
          {node.incoming && <line x1={toScreen(node).x} y1={toScreen(node).y}
            x2={toScreen(node.incoming).x} y2={toScreen(node.incoming).y} />}
          {node.outgoing && <line x1={toScreen(node).x} y1={toScreen(node).y}
            x2={toScreen(node.outgoing).x} y2={toScreen(node.outgoing).y} />}
        </g>
      ))}
      {dots.map(({ position, handle, color }) => (
        <circle key={`${handle.index}-${handle.kind}`} cx={position.x} cy={position.y}
          r={handle.kind === 'anchor' ? 7 : 5} fill={color} stroke="#292923"
          strokeWidth="1.8" style={{ cursor: 'move', pointerEvents: 'auto' }}
          onPointerDown={(event) => start(event, handle)}
          onPointerMove={move} onPointerUp={finish}
          onPointerCancel={() => { active.current = null; current.current = null;
            setDraft(null); }} />
      ))}
    </svg>
  );
}
