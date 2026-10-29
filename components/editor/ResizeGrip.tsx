'use client';

import { useRef, type PointerEvent } from 'react';

type Props = {
  side: 'left' | 'right';
  label: string;
  width: number;
  height: number;
  onResize: (width: number, height: number) => void;
};

/** Pointer capture keeps drag-to-resize functional for mouse, touchpad and touch. */
export function ResizeGrip({ side, label, width, height, onResize }: Props) {
  const drag = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  function start(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      width,
      height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    event.preventDefault();
    const initial = drag.current;
    const direction = side === 'right' ? -1 : 1;
    const maxWidth = Math.max(220, window.innerWidth - 32);
    const maxHeight = Math.max(220, window.innerHeight - 120);
    const minWidth = side === 'right' ? 240 : 54;
    const minHeight = side === 'right' ? 260 : 180;
    const nextWidth = Math.min(maxWidth, Math.max(minWidth,
      initial.width + (event.clientX - initial.x) * direction));
    const nextHeight = Math.min(maxHeight, Math.max(minHeight,
      initial.height + event.clientY - initial.y));
    onResize(Math.round(nextWidth), Math.round(nextHeight));
  }

  function finish(event: PointerEvent<HTMLButtonElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <button
      type="button"
      className={`studio-resize-grip grip-${side}`}
      aria-label={label}
      title={label}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <img src="/art/room/grip.svg" alt="" width={26} height={19} />
    </button>
  );
}
