'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { StudioIcon } from '@/components/StudioIcon';

const INKS = ['#292A25', '#426ED6', '#E5795C', '#278F73', '#A06DB2'];
type SketchTool = 'pen' | 'star' | 'heart' | 'buddy';

function stamp(
  context: CanvasRenderingContext2D,
  tool: SketchTool,
  x: number,
  y: number,
) {
  if (tool === 'star') {
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? 18 : 8;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
  } else {
    context.beginPath();
    context.moveTo(x, y + 15);
    context.bezierCurveTo(x - 38, y - 10, x - 18, y - 25, x, y - 8);
    context.bezierCurveTo(x + 18, y - 25, x + 38, y - 10, x, y + 15);
  }
  context.fill();
  context.stroke();
}

export function SketchPad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buddyRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const [tool, setTool] = useState<SketchTool>('pen');
  const [ink, setInk] = useState(INKS[1]);
  const [touchEnabled, setTouchEnabled] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const buddy = new Image();
    buddy.src = '/art/world/inkling.svg';
    buddyRef.current = buddy;
    setTouchEnabled(!window.matchMedia('(pointer: coarse)').matches);

    const resize = () => {
      const previous = document.createElement('canvas');
      previous.width = canvas.width;
      previous.height = canvas.height;
      previous.getContext('2d')?.drawImage(canvas, 0, 0);

      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width === width && canvas.height === height) return;

      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (previous.width && previous.height) {
        context?.drawImage(previous, 0, 0, bounds.width, bounds.height);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (!touchEnabled || event.button !== 0) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const { x, y } = point(event);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 3;
    context.strokeStyle = '#292A25';
    context.fillStyle = ink;

    if (tool === 'buddy') {
      const buddy = buddyRef.current;
      if (buddy?.complete && buddy.naturalWidth) {
        context.drawImage(buddy, x - 29, y - 29, 58, 58);
      }
      return;
    }

    if (tool !== 'pen') {
      stamp(context, tool, x, y);
      return;
    }

    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.strokeStyle = ink;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 0.1, y + 0.1);
    context.stroke();
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || tool !== 'pen') return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function stop() {
    drawingRef.current = false;
    canvasRef.current?.getContext('2d')?.closePath();
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div className="world-pad" aria-label="Try drawing on a small practice canvas">
      <div className="world-pad-canvas-wrap">
        <canvas
          ref={canvasRef}
          className={`world-pad-canvas ${touchEnabled ? 'is-active' : ''}`}
          aria-label="Practice sketch area, draw with the selected tool"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={stop}
        />
        {!touchEnabled && (
          <button type="button" className="world-pad-arm"
            onClick={() => setTouchEnabled(true)}>
            <StudioIcon name="pen" size={18} /> Tap to enable drawing
          </button>
        )}
      </div>
      <div className="world-pad-tray">
        <div className="world-pad-tools" aria-label="Doodle tools">
          <span className="world-tool-label">YOUR TOOLS ↗</span>
          {(['pen', 'star', 'heart', 'buddy'] as const).map((item) => (
            <button
              type="button"
              key={item}
              className={tool === item ? 'is-picked' : ''}
              onClick={() => setTool(item)}
              aria-pressed={tool === item}
              aria-label={`Use ${item === 'pen' ? 'pencil' : item} tool`}
              title={item}
            >
              {item === 'pen' && <StudioIcon name="pen" size={22} />}
              {item === 'star' && <span aria-hidden="true">☆</span>}
              {item === 'heart' && <span aria-hidden="true">♡</span>}
              {item === 'buddy' && (
                <img src="/art/world/inkling.svg" alt="" className="world-buddy-tool" />
              )}
            </button>
          ))}
        </div>
        <div className="world-pad-inks" aria-label="Choose an ink color">
          {INKS.map((color) => (
            <button
              type="button" key={color} aria-label={`Use ${color} ink`}
              aria-pressed={ink === color}
              className={ink === color ? 'is-picked' : ''}
              style={{ backgroundColor: color }}
              onClick={() => setInk(color)}
            />
          ))}
        </div>
        <button type="button" className="world-pad-clear" onClick={clear}>
          <StudioIcon name="trash" size={15} /> Clear
        </button>
        {touchEnabled && (
          <button type="button" className="world-pad-touch-off"
            onClick={() => setTouchEnabled(false)}>
            Scroll mode
          </button>
        )}
      </div>
    </div>
  );
}
