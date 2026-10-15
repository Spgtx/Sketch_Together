/** Keep capability tokens in fragments; they do not appear in server request URLs. */
export const accessKey = (id: string) => `sketchtogether:room-access:${id}`;

type RoomRole = 'owner' | 'editor';

type JoinResult = {
  role: RoomRole;
};

export function shareUrl(id: string, token: string) {
  return `${location.origin}/room/${encodeURIComponent(id)}#access=${encodeURIComponent(token)}`;
}

function storedAccess(id: string): string | null {
  try {
    return localStorage.getItem(accessKey(id));
  } catch {
    return null;
  }
}

function rememberAccess(id: string, token: string) {
  try {
    localStorage.setItem(accessKey(id), token);
  } catch {
    // The HttpOnly cookie still permits access until it expires.
  }
}

/** The server alone verifies whether a capability is an owner or editor token. */
async function joinWithToken(id: string, token: string): Promise<RoomRole | null> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(id)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ token }),
  });
  if (!response.ok) return null;
  const data = await response.json() as JoinResult;
  return data.role === 'owner' || data.role === 'editor' ? data.role : null;
}

/**
 * Preserve an existing owner capability when an owner opens a guest invite URL.
 * If a stored token was revoked, fall back to the incoming invitation or cookie.
 */
export async function enterRoom(id: string): Promise<boolean> {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const incoming = fragment.get('access');
  const saved = storedAccess(id);
  const candidates = Array.from(new Set([saved, incoming].filter(
    (token): token is string => Boolean(token),
  )));

  let selected: { token: string; role: RoomRole } | null = null;
  let lastJoined: string | null = null;
  for (const token of candidates) {
    const role = await joinWithToken(id, token);
    if (!role) continue;
    lastJoined = token;
    if (!selected || role === 'owner') selected = { token, role };
    if (role === 'owner') break;
  }

  // Keep the server cookie aligned with the chosen credential if two valid
  // invitations were tested. A valid owner secret always wins over an editor.
  if (selected) {
    if (lastJoined !== selected.token) {
      await joinWithToken(id, selected.token);
    }
    rememberAccess(id, selected.token);
  }

  // Cookie-only sessions remain usable if browser storage was disabled or
  // if a locally cached token was revoked while the cookie is still valid.
  const check = await fetch(`/api/sync/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!check.ok) return false;
  if (incoming) {
    history.replaceState(null, '', location.pathname + location.search);
  }
  return true;
}

async function requestEditorInvite(id: string, token?: string) {
  return fetch(`/api/rooms/${encodeURIComponent(id)}/share`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

async function inviteFromResponse(id: string, response: Response) {
  const data = await response.json() as { token: string };
  if (!data.token) throw new Error('The server returned an empty invitation');
  return shareUrl(id, data.token);
}

async function responseError(response: Response): Promise<string> {
  let reason = 'Could not generate a private invitation';
  try {
    const details = await response.json() as { error?: string };
    if (details.error) reason = details.error;
  } catch {
    // Non-JSON server errors still include their HTTP status.
  }
  return `${reason} (HTTP ${response.status})`;
}

/**
 * Recover a missing owner cookie using the creator's saved capability.
 * Editors can only reshare their already-issued editor link; they cannot
 * mint new capabilities. A lost owner secret cannot be recreated by guests.
 */
export async function editorInviteUrl(id: string) {
  const initial = await requestEditorInvite(id);
  if (initial.ok) return inviteFromResponse(id, initial);

  const saved = storedAccess(id);
  if (initial.status === 403 && saved) {
    // Bearer authorization avoids dependence on cookies being available,
    // while Redis still checks the saved secret against the owner hash.
    const retried = await requestEditorInvite(id, saved);
    if (retried.ok) {
      // Reissue the HttpOnly cookie so backup/revoke/policy actions work too.
      await joinWithToken(id, saved);
      return inviteFromResponse(id, retried);
    }

    const role = await joinWithToken(id, saved);
    if (role === 'editor') return shareUrl(id, saved);
    if (role === 'owner') throw new Error(await responseError(retried));
  }

  if (initial.status === 403) {
    throw new Error(
      'Owner access is missing on this browser. Open this room in the browser '
      + 'that created it, or use a saved owner access token. If you joined '
      + 'as a guest, ask the owner for an invitation.',
    );
  }
  throw new Error(await responseError(initial));
}
