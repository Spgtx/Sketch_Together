import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export type RoomRole = 'owner' | 'editor';
export type RoomMeta = {
  id: string;
  ownerHash: string;
  createdAt: number;
};

export const validRoomId = (id: string) => /^[A-Za-z0-9_-]{8,32}$/.test(id);
export const metaKey = (id: string) => `sketch:room:meta:${id}`;
export const editorsKey = (id: string) => `sketch:room:editors:${id}`;
export const docKey = (id: string) => `sketch:v3:${id}`;
export const dirtyKey = 'sketch:backups:dirty';

export function newSecret() {
  return randomBytes(32).toString('base64url');
}

export function secretHash(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

function sameHash(left: string, right: string) {
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function roomCookie(id: string) {
  return `sketch_room_${id}`;
}

export function setRoomCookie(response: NextResponse, id: string, token: string) {
  response.cookies.set(roomCookie(id), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function roomRole(
  roomId: string,
  token: string | undefined,
): Promise<RoomRole | null> {
  if (!validRoomId(roomId) || !token || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) {
    return null;
  }
  const redis = getRedis();
  if (!redis) return null;
  const meta = await redis.get<RoomMeta>(metaKey(roomId));
  if (!meta || !/^[0-9a-f]{64}$/.test(meta.ownerHash)) return null;
  const hash = secretHash(token);
  if (sameHash(hash, meta.ownerHash)) return 'owner';
  return (await redis.sismember(editorsKey(roomId), hash)) ? 'editor' : null;
}

export async function authorizeRoom(request: NextRequest, id: string) {
  const authorization = request.headers.get('authorization');
  const bearer = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : undefined;
  return roomRole(id, bearer || request.cookies.get(roomCookie(id))?.value);
}

export function allowedOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return Boolean(request.headers.get('authorization'));
  return origin === new URL(request.url).origin;
}

export function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export function jsonError(message: string, status: number, retryAfter?: number) {
  const response = NextResponse.json({ error: message }, { status });
  if (retryAfter) response.headers.set('Retry-After', String(retryAfter));
  return noStore(response);
}

/** Only trust proxy IP headers when deployed behind that specific trusted proxy. */
function rateIdentity(request: NextRequest, roomId: string) {
  const ip = process.env.VERCEL
    ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    : process.env.TRUST_PROXY_IP === 'true'
      ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      : undefined;
  const identity = ip && /^[0-9a-fA-F:.]{3,48}$/.test(ip)
    ? ip : 'unknown-client';
  // Hash IPs so Redis doesn't retain them in plaintext keys.
  return secretHash(`${process.env.RATE_LIMIT_SALT || 'sketch'}:${identity}:${roomId}`);
}

const RATE_LUA = `
local total = redis.call('INCR', KEYS[1])
if total == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end
return total
`;

export async function limited(
  request: NextRequest,
  action: string,
  id: string,
  limit: number,
  seconds: number,
) {
  const redis = getRedis();
  if (!redis) return true;
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const identity = rateIdentity(request, id);
  const key = `sketch:rl:${action}:${identity}:${bucket}`;
  const count = Number(await redis.eval(RATE_LUA, [key], [seconds * 2]));
  return count <= limit;
}

export function signedRoomJwt(id: string, role: RoomRole) {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  const now = Math.floor(Date.now() / 1000);
  const encode = (item: object) => Buffer.from(JSON.stringify(item)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    iss: 'sketchtogether',
    aud: 'authenticated',
    role: 'authenticated',
    sub: `sketch-${id}`,
    room_id: id,
    room_role: role,
    iat: now,
    exp: now + 10 * 60,
  });
  const content = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(content).digest('base64url');
  return `${content}.${signature}`;
}
