/** Safe path algebra for filled polygons and open polyline segments. */
import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Ring } from './vector-booleans';
import { multipolygonToPath } from './vector-booleans';
import type { PenNode } from './advanced-vector';

const round = (n: number) => Number(n.toFixed(3));
const typed = (p: MultiPolygon) => p as Parameters<typeof polygonClipping.union>[0];

/** Return separate editable objects; cutter is always the second shape. */
export function dividePolygons(
  first: MultiPolygon,
  second: MultiPolygon,
  mode: 'division' | 'fracture',
): string[] {
  if (!first.length || !second.length) throw new Error('Select two closed shapes.');
  const a = typed(first);
  const b = typed(second);
  const pieces = [
    polygonClipping.difference(a, b),
    polygonClipping.intersection(a, b),
  ];
  if (mode === 'fracture') pieces.push(polygonClipping.difference(b, a));
  return pieces.flatMap((shape) => shape.map((polygon) =>
    multipolygonToPath([polygon] as MultiPolygon))).filter(Boolean);
}

/** One compound SVG path, preserving multiple independent subpaths. */
export function combinePaths(paths: string[]): string {
  const valid = paths.map((path) => path.trim()).filter(Boolean);
  if (valid.length < 2) throw new Error('Select at least two vector paths.');
  return valid.join(' ');
}

/** Split an SVG path at subpath move commands, without changing its coordinates. */
export function breakApartPath(path: string): string[] {
  const matches = path.trim().match(/M\s*[-+\d.]/gi);
  if (!matches || matches.length < 2) return [];
  return path.trim().split(/(?=\bM\s*[-+\d.])/i)
    .map((piece) => piece.trim()).filter(Boolean);
}

/** Split a continuous pen path at an internal anchor, retaining its tangent handles. */
export function splitPenNodes(nodes: PenNode[], index: number): [PenNode[], PenNode[]] {
  if (nodes.length < 3 || index <= 0 || index >= nodes.length - 1) {
    throw new Error('Choose an interior node on an open path.');
  }
  return [nodes.slice(0, index + 1), nodes.slice(index)];
}

/** Polygon offset using parallel edge intersections; best for non-self-crossing contours. */
export function offsetRing(ring: Ring, amount: number): Ring {
  if (!Number.isFinite(amount) || Math.abs(amount) > 100) {
    throw new Error('Offset must be between -100 and 100 pixels.');
  }
  const input = ring.length > 1 && ring[0][0] === ring.at(-1)?.[0] &&
    ring[0][1] === ring.at(-1)?.[1] ? ring.slice(0, -1) : ring;
  if (input.length < 3 || input.length > 1800) throw new Error('Invalid contour size.');
  const area = input.reduce((sum, [x, y], i) => {
    const [xx, yy] = input[(i + 1) % input.length];
    return sum + x * yy - xx * y;
  }, 0);
  const orientation = area >= 0 ? 1 : -1;
  const results: Ring = [];
  for (let i = 0; i < input.length; i++) {
    const previous = input[(i - 1 + input.length) % input.length];
    const current = input[i];
    const next = input[(i + 1) % input.length];
    const normal = (from: number[], to: number[]) => {
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const length = Math.hypot(dx, dy) || 1;
      return [orientation * dy / length, -orientation * dx / length];
    };
    const a = normal(previous, current);
    const b = normal(current, next);
    const sum = [a[0] + b[0], a[1] + b[1]];
    const dot = (sum[0] * b[0] + sum[1] * b[1]) || 1;
    const miter = Math.min(4, Math.abs(1 / dot)) * Math.sign(1 / dot);
    results.push([
      round(current[0] + sum[0] * amount * miter),
      round(current[1] + sum[1] * amount * miter),
    ]);
  }
  return [...results, results[0]];
}

export function offsetPolygons(polygons: MultiPolygon, amount: number): string {
  if (!polygons.length) throw new Error('Select a closed shape for offset.');
  // Hole contours have the opposite orientation and move in the reverse direction.
  const result = polygons.map((polygon) => polygon.map((ring, index) =>
    offsetRing(ring, index === 0 ? amount : -amount)));
  return multipolygonToPath(result);
}

type Segment = [[number, number], [number, number]];
function segmentIntersection(a: Segment, b: Segment): number | null {
  const [[x1, y1], [x2, y2]] = a;
  const [[x3, y3], [x4, y4]] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const ex = x4 - x3;
  const ey = y4 - y3;
  const denominator = dx * ey - dy * ex;
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((x3 - x1) * ey - (y3 - y1) * ex) / denominator;
  const u = ((x3 - x1) * dy - (y3 - y1) * dx) / denominator;
  return t > 1e-6 && t < 1 - 1e-6 && u >= 0 && u <= 1 ? t : null;
}

/** Cut an OPEN straight-segment path wherever it crosses the cutter boundary. */
export function cutPolyline(points: Ring, cutter: MultiPolygon): Ring[] {
  if (points.length < 2) throw new Error('Choose an open line as the first object.');
  const edges: Segment[] = cutter.flatMap((poly) => poly.flatMap((ring) =>
    ring.slice(0, -1).map((point, i) => [point, ring[i + 1]] as Segment)));
  const pieces: Ring[] = [];
  let current: Ring = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const line: Segment = [points[i], points[i + 1]];
    const stops = [0, ...edges.map((edge) => segmentIntersection(line, edge))
      .filter((t): t is number => t !== null).sort((a, b) => a - b), 1];
    for (let j = 1; j < stops.length; j++) {
      const t = stops[j];
      const point: [number, number] = [
        round(line[0][0] + (line[1][0] - line[0][0]) * t),
        round(line[0][1] + (line[1][1] - line[0][1]) * t),
      ];
      current.push(point);
      if (j < stops.length - 1) {
        if (current.length > 1) pieces.push(current);
        current = [point];
      }
    }
  }
  if (current.length > 1) pieces.push(current);
  return pieces.filter((piece) => piece.some((p, i) => i &&
    (p[0] !== piece[0][0] || p[1] !== piece[0][1])));
}

export function openPolylinePath(points: Ring): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'} ${round(x)} ${round(y)}`)
    .join(' ');
}
