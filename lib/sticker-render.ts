/** Normalize same-origin SVG artwork into a portable transparent PNG for Fabric. */
const MAX_SOURCE_BYTES = 128_000;
const TARGET_SIZE = 640;

export function svgSize(source: string): { width: number; height: number } {
  const viewBox = source.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  if (!viewBox) return { width: 180, height: 180 };
  const coordinates = viewBox[1].trim().split(/[\s,]+/).map(Number);
  const width = coordinates[2];
  const height = coordinates[3];
  if (!(width > 0 && height > 0)) return { width: 180, height: 180 };
  return { width, height };
}

export function normalizeSvg(source: string): string {
  if (!/^\s*<svg\b/i.test(source)) throw new Error('Not an SVG illustration');
  if (/<(?:script|foreignObject)\b|\bon\w+\s*=/i.test(source)) {
    throw new Error('Unexpected executable SVG content');
  }
  const { width, height } = svgSize(source);
  return source.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    const namespace = /\bxmlns\s*=/.test(attrs)
      ? '' : ' xmlns="http://www.w3.org/2000/svg"';
    const withWidth = /\bwidth\s*=/.test(attrs)
      ? attrs : `${attrs} width="${width}"`;
    const withHeight = /\bheight\s*=/.test(withWidth)
      ? withWidth : `${withWidth} height="${height}"`;
    return `<svg${withHeight}${namespace}>`;
  });
}

function decodeSvg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The browser could not decode the sticker SVG'));
    image.src = url;
  });
}

export async function stickerPngDataUrl(path: string): Promise<string> {
  if (!/^\/stickers\/[a-z0-9-]+\.svg$/.test(path)) {
    throw new Error('Sticker path must be local');
  }
  const response = await fetch(path, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Sticker request failed: ${response.status}`);
  const source = await response.text();
  if (source.length > MAX_SOURCE_BYTES) throw new Error('Sticker SVG is too large');
  const normalized = normalizeSvg(source);
  const { width, height } = svgSize(normalized);
  const blobUrl = URL.createObjectURL(new Blob([normalized], {
    type: 'image/svg+xml;charset=utf-8',
  }));
  try {
    const image = await decodeSvg(blobUrl);
    const scale = TARGET_SIZE / Math.max(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas image conversion is unavailable');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
