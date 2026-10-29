/** Bounded raster painting primitives. One Fabric image represents one raster layer. */
export const PAINT_WIDTH = 1600;
export const PAINT_HEIGHT = 1000;
export const MAX_PAINT_LAYERS = 5;

export const BLEND_MODES = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
] as const;

export type BlendMode = (typeof BLEND_MODES)[number]['value'];
export type PaintPoint = { x: number; y: number };

export function validBlendMode(value: unknown): value is BlendMode {
  return BLEND_MODES.some((mode) => mode.value === value);
}

export function insidePaintArea(point: PaintPoint): boolean {
  return point.x >= 0 && point.y >= 0 &&
    point.x < PAINT_WIDTH && point.y < PAINT_HEIGHT;
}

export function createPaintSurface(): HTMLCanvasElement {
  const element = document.createElement('canvas');
  element.width = PAINT_WIDTH;
  element.height = PAINT_HEIGHT;
  return element;
}

/** Make a new immutable image source: never mutate a Fabric image's old source. */
export function copyPaintSurface(source: CanvasImageSource): HTMLCanvasElement {
  const next = createPaintSurface();
  const ctx = next.getContext('2d');
  if (!ctx) throw new Error('2D painting is not available in this browser.');
  ctx.drawImage(source, 0, 0, PAINT_WIDTH, PAINT_HEIGHT);
  return next;
}

/** Erasing uses destination-out, preserving alpha in every unaffected pixel. */
export function paintStroke(
  surface: HTMLCanvasElement,
  points: PaintPoint[],
  width: number,
  color: string,
  opacity: number,
  erase: boolean,
): void {
  if (!points.length) return;
  const ctx = surface.getContext('2d');
  if (!ctx) throw new Error('2D painting is not available in this browser.');
  ctx.save();
  ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  ctx.globalAlpha = erase ? 1 : Math.max(0.05, Math.min(1, opacity));
  ctx.strokeStyle = erase ? '#000000' : color;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(1, Math.min(150, width));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 1) {
    ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Tolerance-based contiguous bucket fill (4-neighbour). Returns changed pixel count. */
export function floodFillPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  origin: PaintPoint,
  hex: string,
  opacity: number,
  tolerance = 25,
): number {
  const x = Math.floor(origin.x);
  const y = Math.floor(origin.y);
  if (x < 0 || x >= width || y < 0 || y >= height) return 0;
  if (!/^#[\da-f]{6}$/i.test(hex)) return 0;
  const start = (y * width + x) * 4;
  const target = Array.from(pixels.slice(start, start + 4));
  const color = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
    Math.round(Math.max(0.05, Math.min(1, opacity)) * 255),
  ];
  if (target.every((channel, i) => channel === color[i])) return 0;
  const visited = new Uint8Array(width * height);
  const pending = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const seed = y * width + x;
  pending[tail++] = seed;
  visited[seed] = 1;
  let count = 0;
  while (head < tail) {
    const index = pending[head++];
    const at = index * 4;
    if (target.some((channel, i) => Math.abs(pixels[at + i] - channel) > tolerance)) {
      continue;
    }
    for (let i = 0; i < 4; i++) pixels[at + i] = color[i];
    count++;
    const col = index % width;
    const row = Math.floor(index / width);
    const nearby = [
      col > 0 ? index - 1 : -1,
      col < width - 1 ? index + 1 : -1,
      row > 0 ? index - width : -1,
      row < height - 1 ? index + width : -1,
    ];
    nearby.forEach((next) => {
      if (next < 0 || visited[next]) return;
      visited[next] = 1;
      pending[tail++] = next;
    });
  }
  return count;
}

export function bucketFill(
  surface: HTMLCanvasElement,
  point: PaintPoint,
  hex: string,
  opacity: number,
): number {
  const ctx = surface.getContext('2d');
  if (!ctx) throw new Error('2D pixel access is unavailable.');
  const image = ctx.getImageData(0, 0, surface.width, surface.height);
  const changed = floodFillPixels(image.data, image.width, image.height,
    point, hex, opacity);
  if (changed) ctx.putImageData(image, 0, 0);
  return changed;
}
