'use client';

import { useRef, useState, type PointerEvent } from 'react';
import type { CurveNode } from '@/lib/art-strokes';

export type ScreenPoint = { x: number; y: number };

type Props = {
  nodes: CurveNode[];
  screen: ScreenPoint[];
  screenToWorld: (point: ScreenPoint) => CurveNode;
  onCommit: (nodes: CurveNode[]) => void;
};

/** Selection overlay: every handle is draggable without manipulating Fabric's path matrix. */
export function CurveHandles({ nodes, screen, screenToWorld, onCommit }: Props) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [draft, setDraft] = useState<ScreenPoint[] | null>(null);
  const latest = useRef<ScreenPoint[] | null>(null);
  const displayed = draft || screen;
  if (nodes.length !== 3 || displayed.length !== 3) return null;

  function move(event: PointerEvent<SVGCircleElement>) {
    if (dragging === null) return;
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return;
    const next = [...(latest.current || screen)];
    next[dragging] = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    latest.current = next;
    setDraft(next);
  }

  function finish(event: PointerEvent<SVGCircleElement>) {
    if (dragging === null) return;
    const result = latest.current;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(null);
    setDraft(null);
    latest.current = null;
    if (result) onCommit(result.map(screenToWorld));
  }

  const [start, control, end] = displayed;
  return (
    <svg className="curve-handle-overlay" aria-label="Editable curve handles">
      <path
        d={`M ${start.x} ${start.y} L ${control.x} ${control.y} L ${end.x} ${end.y}`}
        stroke="#de784f"
        strokeWidth="1.5"
        strokeDasharray="5 5"
        fill="none"
      />
      <path
        d={`M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`}
        stroke="#327e71"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      {displayed.map((node, index) => (
        <circle
          key={index}
          cx={node.x}
          cy={node.y}
          r={index === 1 ? 9 : 7}
          fill={index === 1 ? '#f3c76a' : '#ffffff'}
          stroke="#282721"
          strokeWidth="2"
          className="curve-drag-handle"
          aria-label={['Start point', 'Control handle', 'End point'][index]}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            latest.current = [...screen];
            setDragging(index);
          }}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={() => {
            setDragging(null);
            setDraft(null);
            latest.current = null;
          }}
        />
      ))}
    </svg>
  );
}
