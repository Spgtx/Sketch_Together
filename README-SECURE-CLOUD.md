# SketchTogether v1.6 — secure guest rooms and cloud backup

## What the earlier config response means

`{"realtime":true,"persistence":true}` in v1.5 indicated both providers were
configured, not that cloud writes succeeded. Redis is the **immediate live
cloud store**. Supabase Realtime is only a transport and does not save boards
in PostgreSQL. In this release, `realtime:true` additionally requires a
room-scoped JWT signing secret, because public channels are not safe for private
sketches. The config response is a capability check, not a save-health check.

## Set up

1. Install Node 22 LTS or newer and run `npm install`.
2. Configure the Upstash REST URL and token from `.env.example`. Keep both
   server-only. Make a new room from the homepage; that creates a Redis document
   and a random owner secret. Test a new board and reopen it in a fresh tab.
3. In Supabase, apply `supabase/schema.sql` in the SQL editor. It creates a
   private Storage bucket, an RLS-protected backup metadata table, and room-scoped
   Realtime policies. In **Realtime Settings**, disable **Allow public access**.
4. Configure `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and **server-only**
   `SUPABASE_JWT_SECRET` for private Broadcast and Presence. Obtain the signing
   secret from your project's JWT settings if your project supports HS256
   custom JWTs. Some newer signing-key configurations need a different signing
   integration; do not substitute the public anon/publishable key here.
5. Set `SUPABASE_SERVICE_ROLE_KEY` (SERVER ONLY) for optional durable backups.
6. Set a long `BACKUP_CRON_SECRET` and schedule a trusted HTTPS POST to
   `/api/maintenance/flush` with the `Authorization: Bearer <secret>` header.
   For example, every 5 minutes with a trusted scheduler. Do not use an
   unauthenticated public GET cron endpoint. The manual **Back up to Supabase**
   room command works even before scheduling a cron job (owner only).
7. Use `npm test`, `npm run typecheck`, `npm run build`, and `npm run dev`.

## Changes from v1.5

- Cloud room creation is explicit: `POST /api/rooms` (5/hour per trusted IP).
- Cloud rooms are **private**: links contain a random secret after `#access=`.
  The fragment is not sent in HTTP requests. The browser exchanges it for an
  HttpOnly, SameSite=Strict cookie. Editing APIs check owner/editor membership
  on every request. The client also keeps the token locally for recovery;
  therefore XSS protection remains important. A link grants editing access.
- Existing unprotected room IDs are **not** automatically assigned to whoever
  opens them first. From the homepage, a board with a local snapshot can be
  cloned into a new protected room. Existing room links need new invitations.
- Only owners may mint new invite tokens and change Protected/Classic policy.
  The policy lives on the server. A client cannot force Classic via JSON.
- The old full-snapshot `POST /api/canvas/[roomId]` endpoint was removed.
  All cloud modifications pass the versioned Redis Lua operation endpoint.
- Redis updates are atomic and deduplicated. Multiple rapid modifications of
  the same unsent object are coalesced; the client waits 450ms before flushing
  and retains its pending queue locally after errors.
- GET board reads support revision ETags (304) and poll every 8 seconds as a
  fallback to private Realtime notifications, only when the page is visible.
- Edited rooms are marked dirty atomically with their Redis writes. A cron or
  owner command compresses the latest board and stores it in a PRIVATE Supabase
  Storage bucket, with revision/permissions hashes in PostgreSQL. The dirty
  marker is removed only if the board revision hasn't changed during upload.
  A short Redis lock prevents concurrent backup writers for the same room.
- Repeated API requests receive 429 with `Retry-After`, invalid room reads
  no longer create Redis documents, and oversized streamed operations are
  rejected before they fill server memory.
- Owners may invalidate all editor invites with
  `DELETE /api/rooms/[roomId]/share` (a custom room-management interface for
  this is not implemented yet). Revoked cookies stop working on API requests
  immediately. Previously issued Realtime JWTs can last up to ten minutes.

## Saving and failure modes

- **Local copy**: saved to browser localStorage; private mode or quota limits
  may block it. Export JSON for a separate backup.
- **Cloud synced**: changes accepted into Upstash Redis, but not necessarily
  backed up to Supabase Storage yet.
- **Supabase backup**: a compressed server-side snapshot and metadata record
  written to Storage/PostgreSQL. Runs when explicitly requested or via cron.
  A backup failure leaves the dirty marker and Redis copy in place for retry.

This release **does not** automatically recover a lost Redis database from
Supabase backups. The encrypted/non-public bucket must be restored by an
operator before attempting room recovery; no public restore endpoint exists.
Do not clear Redis assuming PostgreSQL immediately becomes the live store.

The Redis store can keep edits permanently while under configured quotas;
periodic Supabase backup means fewer database writes but also means the last
few minutes may not yet be in the durable backup. For stricter recovery point
objectives, shorten the trusted scheduler interval.

## Security limits

This is a capability-link guest system, not an identity/authenticated-account
system. Shared secrets can be copied or leaked. Anyone with an active editor
link may still send many direct Supabase Realtime Broadcast messages within
that service's project limits. Server-side API rate limits do not cover direct
Realtime sends. Apply Supabase project quotas and configure room expiry,
account sign-in, bot challenges, monitoring, and content rules before a large
public launch. Rate limits also require trustworthy client IP headers at the
edge; don't trust `X-Forwarded-For` from arbitrary internet clients. On
self-hosted deployments without a trusted proxy, the fail-closed anonymous
limit may affect multiple visitors; configure a trusted ingress.

The maximum live board is 4.5 MB. Raster-heavy paintings may still exceed
free-tier storage or Realtime quotas; large artwork eventually needs tile-based
storage and separately bounded upload endpoints.

## Two-browser acceptance test

1. Open a new room: note that both cloud create and GET sync succeed.
2. Use Share to issue an invitation. Join it in an incognito browser; verify
   both browsers can edit separate objects and reload their results.
3. Attempt to open the raw room URL without its `#access` secret in a new
   incognito window: it must show **private room** and GET sync must return 403.
4. Simultaneously edit the same object. Protected mode should return 409 for a
   stale edit without overwriting the other person's work.
5. Try submitting a Classic operation from DevTools while the server policy is
   Protected: it must still enforce conflict checks.
6. Verify GET unknown room IDs does not create a board; repeated edit attempts
   return 429. With a revoked invitation, edits must return 403.
7. Draw several strokes; verify Redis revision advances. Press **Back up to
   Supabase**, then GET `/api/rooms/<id>/backup` as the owner to confirm the
   durable revision and date.
8. Turn Supabase off briefly, edit locally, reconnect, and confirm the pending
   queue replays or a conflict is offered, without silently dropping strokes.
9. Apply private Realtime RLS policies and disable public access; confirm
   Presence/Broadcast work only through approved room links.

## Source map

- `lib/server/room-security.ts`: guest room authorization, token signing and limits
- `app/api/rooms`: create, join, invites, policy, live token, manual backup
- `app/api/sync`: authorized operation sync + conditional reads
- `lib/sync-lua.ts`: atomic collaboration + dirty-backup marking
- `lib/server/cloud-backup.ts`: durable snapshots with revision-safe retry
- `app/api/maintenance/flush`: authenticated cron endpoint
- `supabase/schema.sql`: private Storage/database/Realtime policies
