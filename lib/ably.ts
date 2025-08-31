import Ably from 'ably/promises';

if (!process.env.NEXT_PUBLIC_ABLY_KEY) {
  throw new Error('NEXT_PUBLIC_ABLY_KEY environment variable is required');
}

export const ably = new Ably.Realtime({
  key: process.env.NEXT_PUBLIC_ABLY_KEY,
  clientId: Math.random().toString(36).substring(2, 15),
});