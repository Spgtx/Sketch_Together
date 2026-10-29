/** Geometry helpers shared by the drawing UI and offline unit tests. */
export type StrokePoint = { x: number; y: number; pressure?: number };
export type CurveNode = { x: number; y: number };
export type BrushPreset = 'pencil' | 'ink' | 'marker' | 'spray' | 'pressure';

export const BRUSH_PRESETS: { id: BrushPreset; label: string; caption: string }[] = [
  { id: 'pencil', label: 'Pencil', caption: 'Everyday sketching' },
  { id: 'ink', label: 'Ink pen', caption: 'Clean solid strokes' },
  { id: 'marker', label: 'Marker', caption: 'Layered translucent marks' },
  { id: 'spray', label: 'Spray', caption: 'Soft scattered dots' },
  { id: 'pressure', label: 'Pressure pen', caption: 'Tapered tablet strokes' },
];

const fmt = (value: number) => Number(value.toFixed(2));
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * Creates a closed filled vector outline for a pressure-sensitive stroke.
 * No bitmaps are involved: the resulting Fabric Path can be saved and shared.
 */
export function pressureStrokePath(points: StrokePoint[], width: number): string {
  if (!points.length || !Number.isFinite(width) || width <= 0) return '';
  const clean = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!clean.length) return '';
  const unique = clean.filter((p, i) =>
    i === 0 || Math.hypot(p.x - clean[i - 1].x, p.y - clean[i - 1].y) >= 0.5);
  if (!unique.length) return '';
  if (unique.length === 1) {
    const { x, y } = unique[0];
    const radius = Math.max(0.5, width * (unique[0].pressure ?? 0.5) / 2);
    return `M ${fmt(x - radius)} ${fmt(y)} ` +
      `a ${fmt(radius)} ${fmt(radius)} 0 1 0 ${fmt(radius * 2)} 0 ` +
      `a ${fmt(radius)} ${fmt(radius)} 0 1 0 ${fmt(-radius * 2)} 0 Z`;
  }
  const left: CurveNode[] = [];
  const right: CurveNode[] = [];
  for (let i = 0; i < unique.length; i++) {
    const point = unique[i];
    const before = unique[Math.max(i - 1, 0)];
    const after = unique[Math.min(i + 1, unique.length - 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const factor = clamp(point.pressure ?? 0.5, 0.08, 1);
    // Round ends and lightly taper the first and last sample.
    const cap = i === 0 || i === unique.length - 1 ? 0.55 : 1;
    const radius = Math.max(0.45, width * factor * cap / 2);
    const nx = -dy / length * radius;
    const ny = dx / length * radius;
    left.push({ x: point.x + nx, y: point.y + ny });
    right.push({ x: point.x - nx, y: point.y - ny });
  }
  const loop = [...left, ...right.reverse()];
  const commands = [`M ${fmt(loop[0].x)} ${fmt(loop[0].y)}`];
  for (let i = 1; i < loop.length; i++) {
    commands.push(`L ${fmt(loop[i].x)} ${fmt(loop[i].y)}`);
  }
  return `${commands.join(' ')} Z`;
}

/** A three-node quadratic curve. Endpoints and control point remain editable. */
export function quadraticPath(nodes: CurveNode[]): string {
  if (nodes.length !== 3 || nodes.some((node) =>
    !Number.isFinite(node.x) || !Number.isFinite(node.y))) return '';
  const [from, control, to] = nodes;
  return `M ${fmt(from.x)} ${fmt(from.y)} ` +
    `Q ${fmt(control.x)} ${fmt(control.y)} ${fmt(to.x)} ${fmt(to.y)}`;
}

export function hexWithOpacity(color: string, opacity: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${fmt(clamp(opacity, 0.05, 1))})`;
}
