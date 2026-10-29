/** Live transport only. Cloud conflicts are validated separately in Redis. */
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

export type LiveEvent = 'board:event' | 'cursor:move' | 'room:reaction';

export interface LiveRoom {
  send(event: LiveEvent, payload: unknown): Promise<void>;
  updateName(name: string): Promise<void>;
  close(): Promise<void>;
}

export interface LiveHandlers {
  onConnected(connected: boolean): void;
  onBoard(payload: unknown): void;
  onCursor(payload: unknown): void;
  onReaction(payload: unknown): void;
  onPeople(names: string[]): void;
}

function peopleFrom(channel: RealtimeChannel): string[] {
  const state = channel.presenceState<{ name?: string }>();
  return Object.values(state).flatMap((entries) =>
    entries.map(({ name }) => name?.slice(0, 22) || 'Guest'),
  );
}

/** A private channel uses a short-lived, room-scoped server-signed JWT. */
export function connectLiveRoom(
  roomId: string,
  clientId: string,
  displayName: string,
  handlers: LiveHandlers,
  url: string,
  publishableKey: string,
): LiveRoom {
  const client = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  let active = true;
  let connected = false;
  let channel: RealtimeChannel | null = null;
  let refresher: ReturnType<typeof setInterval> | null = null;

  async function refreshToken() {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/live`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Realtime access denied');
    const { token } = await response.json() as { token: string };
    await client.realtime.setAuth(token);
  }

  async function start() {
    try {
      await refreshToken();
      if (!active) return;
      channel = client.channel(`sketch:${roomId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: clientId },
          private: true,
        },
      });
      channel
        .on('broadcast', { event: 'board:event' }, ({ payload }) => handlers.onBoard(payload))
        .on('broadcast', { event: 'cursor:move' }, ({ payload }) => {
          handlers.onCursor(payload);
        })
        .on('broadcast', { event: 'room:reaction' }, ({ payload }) => {
          handlers.onReaction(payload);
        })
        .on('presence', { event: 'sync' }, () => {
          if (active && channel) handlers.onPeople(peopleFrom(channel));
        })
        .subscribe((status) => {
          if (!active) return;
          connected = status === 'SUBSCRIBED';
          handlers.onConnected(connected);
          if (connected && channel) {
            void channel.track({ name: displayName }).catch(() => {
              handlers.onConnected(false);
            });
          }
        });
      refresher = setInterval(() => {
        void refreshToken().catch(() => handlers.onConnected(false));
      }, 5 * 60 * 1000);
    } catch {
      if (active) handlers.onConnected(false);
    }
  }
  void start();

  return {
    async send(event, payload) {
      if (!active || !connected) return;
      if (!channel) return;
      const result = await channel.send({ type: 'broadcast', event, payload });
      if (result !== 'ok') throw new Error(`Realtime send returned ${result}`);
    },
    async updateName(name) {
      if (!active || !connected) return;
      if (!channel) return;
      const result = await channel.track({ name: name.slice(0, 22) });
      if (result !== 'ok') throw new Error(`Presence update returned ${result}`);
    },
    async close() {
      if (!active) return;
      active = false;
      connected = false;
      if (refresher) clearInterval(refresher);
      if (channel) await client.removeChannel(channel);
      handlers.onConnected(false);
    },
  };
}
