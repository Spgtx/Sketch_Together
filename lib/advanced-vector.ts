/** Pure geometry for continuous paths, snapping, and rectilinear vector booleans. */
export type VectorPoint = { x: number; y: number };
export type PenNode = VectorPoint & {
  incoming?: VectorPoint;
  outgoing?: VectorPoint;
};
export type ShapeBoolean = 'union' | 'difference' | 'intersection' | 'exclusion';
export type RectBounds = { left: number; top: number; width: number; height: number };

const round = (number: number) => Number(number.toFixed(2));
const position = (point: VectorPoint) => `${round(point.x)} ${round(point.y)}`;

export function continuousPath(nodes: PenNode[], closed = false): string {
  if (!nodes.length || nodes.some((node) => !Number.isFinite(node.x + node.y))) {
    return '';
  }
  const parts = [`M ${position(nodes[0])}`];
  for (let i = 1; i < nodes.length + Number(closed); i++) {
    const current = nodes[i % nodes.length];
    const previous = nodes[i - 1];
    if (previous.outgoing || current.incoming) {
      parts.push(`C ${position(previous.outgoing || previous)} ` +
        `${position(current.incoming || current)} ${position(current)}`);
    } else {
      parts.push(`L ${position(current)}`);
    }
  }
  if (closed) parts.push('Z');
  return parts.join(' ');
}

export function snapPosition(
  point: VectorPoint,
  grid: boolean,
  gridSize: number,
  anchors: VectorPoint[] = [],
  tolerance = 8,
): VectorPoint {
  const valid = Number.isFinite(point.x) && Number.isFinite(point.y);
  if (!valid) return point;
  let closest = point;
  let distance = tolerance;
  for (const anchor of anchors) {
    const d = Math.hypot(point.x - anchor.x, point.y - anchor.y);
    if (d < distance) {
      closest = anchor;
      distance = d;
    }
  }
  if (closest !== point) return { ...closest };
  if (!grid || gridSize <= 0) return { ...point };
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

/** Exact axis-aligned rectangle booleans, returned as adjacent non-overlapping SVG subpaths. */
export function rectangleBooleanPath(
  first: RectBounds,
  second: RectBounds,
  operation: ShapeBoolean,
): string {
  const rectangles = [first, second];
  if (rectangles.some((r) => !Number.isFinite(r.left + r.top + r.width + r.height) ||
    r.width <= 0 || r.height <= 0)) return '';
  const xs = [...new Set(rectangles.flatMap((r) => [r.left, r.left + r.width]))]
    .sort((a, b) => a - b);
  const ys = [...new Set(rectangles.flatMap((r) => [r.top, r.top + r.height]))]
    .sort((a, b) => a - b);
  const inside = (r: RectBounds, x: number, y: number) =>
    x >= r.left && x < r.left + r.width && y >= r.top && y < r.top + r.height;
  const cells: string[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x = (xs[i] + xs[i + 1]) / 2;
      const y = (ys[j] + ys[j + 1]) / 2;
      const a = inside(first, x, y);
      const b = inside(second, x, y);
      const keep = operation === 'union' ? a || b
        : operation === 'difference' ? a && !b
          : operation === 'intersection' ? a && b
            : a !== b;
      if (!keep) continue;
      const left = xs[i];
      const top = ys[j];
      const width = xs[i + 1] - left;
      const height = ys[j + 1] - top;
      cells.push(`M ${round(left)} ${round(top)} h ${round(width)} ` +
        `v ${round(height)} h ${round(-width)} Z`);
    }
  }
  return cells.join(' ');
}
