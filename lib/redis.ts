import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables are required');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getCanvasState(roomId: string) {
  try {
    const state = await redis.get(`canvas:${roomId}`);
    return state;
  } catch (error) {
    console.error('Failed to get canvas state:', error);
    return null;
  }
}

export async function setCanvasState(roomId: string, state: string) {
  try {
    await redis.set(`canvas:${roomId}`, state);
    return true;
  } catch (error) {
    console.error('Failed to set canvas state:', error);
    return false;
  }
}