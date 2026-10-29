import type { NextRequest } from 'next/server';

export class PayloadTooLarge extends Error {}

/** Enforce a byte limit even when the request is streamed without Content-Length. */
export async function readBodyLimited(request: NextRequest, maxBytes: number) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new PayloadTooLarge('Payload too large');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maxBytes) throw new PayloadTooLarge('Payload too large');
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.length;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(output);
}
