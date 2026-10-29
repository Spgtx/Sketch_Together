/** Small, deterministic mesh-color interpolation used to render paintable assets. */
export type MeshColors = [string, string, string, string];

export function rgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error('Expected a six-digit color');
  return [0, 2, 4].map((index) =>
    parseInt(match[1].slice(index, index + 2), 16)) as [number, number, number];
}

export function interpolateMesh(colors: MeshColors, x: number, y: number) {
  const corners = colors.map(rgb);
  const u = Math.max(0, Math.min(1, x));
  const v = Math.max(0, Math.min(1, y));
  return [0, 1, 2].map((channel) => Math.round(
    corners[0][channel] * (1 - u) * (1 - v) +
    corners[1][channel] * u * (1 - v) +
    corners[2][channel] * (1 - u) * v +
    corners[3][channel] * u * v,
  )) as [number, number, number];
}

/** Raster-backed mesh, stored as an editable image plus corner-color metadata. */
export function makeMeshImage(colors: MeshColors, width = 320, height = 240): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D support is required');
  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgb = interpolateMesh(colors, x / (width - 1), y / (height - 1));
      const index = (y * width + x) * 4;
      image.data.set([...rgb, 255], index);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
