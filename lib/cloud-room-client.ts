/** Cloud room creation must never quietly become a local-only room. */
export type CreatedCloudRoom = {
  id: string;
  token: string;
  policy: 'protected' | 'classic';
};

export async function createCloudRoom(): Promise<CreatedCloudRoom> {
  let response: Response;
  try {
    response = await fetch('/api/rooms', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
    throw new Error('Cannot reach the room server. Check your connection.');
  }

  if (!response.ok) {
    let reason = `Cloud room creation failed (HTTP ${response.status})`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) reason = `${body.error} (HTTP ${response.status})`;
    } catch {
      // Some infrastructure failures return HTML rather than JSON.
    }
    if (response.status === 429) {
      throw new Error(`${reason}. You reached the room creation rate limit.`);
    }
    throw new Error(reason);
  }

  const body: unknown = await response.json();
  if (!body || typeof body !== 'object') {
    throw new Error('Room server returned an invalid creation response.');
  }
  const room = body as Partial<CreatedCloudRoom>;
  if (!room.id || !/^[A-Za-z0-9_-]{8,32}$/.test(room.id)
    || !room.token || !/^[A-Za-z0-9_-]{40,64}$/.test(room.token)) {
    throw new Error('Room was not created with a valid owner credential.');
  }
  return {
    id: room.id,
    token: room.token,
    policy: room.policy === 'classic' ? 'classic' : 'protected',
  };
}

export function saveOwnerAccess(room: CreatedCloudRoom): boolean {
  try {
    localStorage.setItem(`sketchtogether:room-access:${room.id}`, room.token);
    return true;
  } catch {
    return false;
  }
}

/** Save the entire current document before navigating away from a local room. */
export async function uploadLocalDocument(
  room: CreatedCloudRoom,
  state: Record<string, unknown> & { objects: unknown[] },
): Promise<void> {
  const operation = {
    opId: crypto.randomUUID(),
    actor: crypto.randomUUID(),
    kind: 'replace',
    policy: 'protected',
    baseRevision: 0,
    state,
  };
  const response = await fetch(`/api/sync/${encodeURIComponent(room.id)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${room.token}`,
    },
    body: JSON.stringify(operation),
  });
  if (!response.ok) {
    let reason = `HTTP ${response.status}`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) reason = body.error;
    } catch { /* Keep the status code. */ }
    throw new Error(`Could not save artwork to Redis: ${reason}`);
  }
  const result = await response.json() as { revision?: number };
  if (!Number.isSafeInteger(result.revision) || (result.revision ?? 0) < 1) {
    throw new Error('Cloud did not confirm the artwork was saved.');
  }
}
