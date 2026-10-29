/** Closed-shape polygon operations. Curves are sampled; the result stays editable as a Path. */
import polygonClipping from 'polygon-clipping';
import {
  Ellipse,
  FabricObject,
  Path,
  Polygon,
  Rect,
  Point,
  util,
} from 'fabric';
import type { ShapeBoolean, VectorPoint } from './advanced-vector';

export type Ring = [number, number][];
export type MultiPolygon = Ring[][];
const SEGMENTS = 64;
const MIN_AREA = 0.01;

function pointInRing(point: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

function signedArea(ring: Ring): number {
  return ring.reduce((area, point, index) => {
    const next = ring[(index + 1) % ring.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function close(ring: Ring): Ring {
  if (ring.length < 3 || Math.abs(signedArea(ring)) < MIN_AREA) return [];
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1]
    ? ring : [...ring, first];
}

/** Even-odd nesting: an island inside a hole is another exterior polygon. */
export function ringsToMulti(rings: Ring[]): MultiPolygon {
  const clean = rings.map(close).filter((ring) => ring.length >= 4);
  const order = clean.map((ring, index) => ({ ring, index,
    area: Math.abs(signedArea(ring)) })).sort((a, b) => b.area - a.area);
  const polygons: MultiPolygon = [];
  const depth: number[] = [];
  const hosts: number[] = [];
  order.forEach(({ ring }, index) => {
    let parent = -1;
    for (let j = index - 1; j >= 0; j--) {
      if (pointInRing(ring[0], order[j].ring)) {
        parent = j;
        break;
      }
    }
    depth[index] = parent < 0 ? 0 : depth[parent] + 1;
    if (depth[index] % 2 === 0) {
      hosts[index] = polygons.length;
      polygons.push([ring]);
    } else {
      const outer = parent < 0 ? -1 : hosts[parent];
      if (outer >= 0) polygons[outer].push(ring);
      hosts[index] = outer;
    }
  });
  return polygons;
}

function approximatePath(path: Path): Ring[] {
  const rings: Ring[] = [];
  let current: Ring = [];
  let cursor: [number, number] = [0, 0];
  let start: [number, number] = [0, 0];
  const add = (x: number, y: number) => {
    if (!Number.isFinite(x + y)) throw new Error('Invalid path coordinate');
    current.push([x - path.pathOffset.x, y - path.pathOffset.y]);
  };
  const finish = () => {
    if (current.length >= 3) rings.push(current);
    current = [];
  };
  for (const segment of path.path) {
    const [command, ...values] = segment;
    const v = values as number[];
    if (command === 'M') {
      finish();
      cursor = [v[0], v[1]];
      start = cursor;
      add(...cursor);
    } else if (command === 'L') {
      cursor = [v[0], v[1]];
      add(...cursor);
    } else if (command === 'H') {
      cursor = [v[0], cursor[1]];
      add(...cursor);
    } else if (command === 'V') {
      cursor = [cursor[0], v[0]];
      add(...cursor);
    } else if (command === 'C' || command === 'Q') {
      const origin = cursor;
      const finishPoint: [number, number] = command === 'C'
        ? [v[4], v[5]] : [v[2], v[3]];
      const steps = command === 'C' ? 20 : 14;
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const s = 1 - t;
        const x = command === 'C'
          ? s ** 3 * origin[0] + 3 * s * s * t * v[0] +
            3 * s * t * t * v[2] + t ** 3 * finishPoint[0]
          : s * s * origin[0] + 2 * s * t * v[0] + t * t * finishPoint[0];
        const y = command === 'C'
          ? s ** 3 * origin[1] + 3 * s * s * t * v[1] +
            3 * s * t * t * v[3] + t ** 3 * finishPoint[1]
          : s * s * origin[1] + 2 * s * t * v[1] + t * t * finishPoint[1];
        add(x, y);
      }
      cursor = finishPoint;
    } else if (command === 'Z' || command === 'z') {
      cursor = start;
      finish();
    } else {
      throw new Error(`Unsupported vector segment: ${command}`);
    }
  }
  // Open strokes must not silently become filled polygons.
  if (current.length) throw new Error('Close the vector path before applying booleans');
  return rings;
}

/** Returns the exact shape for rectangles, approximate boundary for curves and ellipses. */
export function objectPolygons(object: FabricObject): MultiPolygon {
  let rings: Ring[] = [];
  if (object instanceof Rect) {
    const x = object.width / 2;
    const y = object.height / 2;
    rings = [[[-x, -y], [x, -y], [x, y], [-x, y]]];
  } else if (object instanceof Ellipse) {
    rings = [Array.from({ length: SEGMENTS }, (_, i) => {
      const angle = 2 * Math.PI * i / SEGMENTS;
      return [object.rx * Math.cos(angle), object.ry * Math.sin(angle)];
    })];
  } else if (object instanceof Polygon) {
    rings = [object.points.map((p) => [
      p.x - object.pathOffset.x, p.y - object.pathOffset.y,
    ])];
  } else if (object instanceof Path) {
    rings = approximatePath(object);
  } else {
    throw new Error('Use two closed paths, rectangles, ellipses, or polygons');
  }
  const transform = object.calcTransformMatrix();
  return ringsToMulti(rings.map((ring) => ring.map(([x, y]) => {
    const point = util.transformPoint(new Point(x, y), transform);
    return [point.x, point.y];
  })));
}

const fmt = (number: number) => Number(number.toFixed(3));
export function multipolygonToPath(polygons: MultiPolygon): string {
  return polygons.flatMap((polygon) => polygon.map((ring) => {
    const closed = close(ring);
    if (closed.length < 4) return '';
    const commands = closed.slice(1).map(([x, y]) => `L ${fmt(x)} ${fmt(y)}`);
    return `M ${fmt(closed[0][0])} ${fmt(closed[0][1])} ${commands.join(' ')} Z`;
  })).filter(Boolean).join(' ');
}

export function booleanPath(
  first: MultiPolygon,
  second: MultiPolygon,
  operation: ShapeBoolean,
): string {
  if (!first.length || !second.length) return '';
  const a = first as Parameters<typeof polygonClipping.union>[0];
  const b = second as Parameters<typeof polygonClipping.union>[0];
  const result = operation === 'union' ? polygonClipping.union(a, b)
    : operation === 'difference' ? polygonClipping.difference(a, b)
      : operation === 'intersection' ? polygonClipping.intersection(a, b)
        : polygonClipping.xor(a, b);
  return multipolygonToPath(result as MultiPolygon);
}
