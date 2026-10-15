# SketchTogether v1.6.3 — local/cloud creation & owner invitations

## What caused the owner invitation error

In v1.6.2, the homepage wrapped cloud room creation in a broad `try/catch`.
If `POST /api/rooms` failed for *any* reason, it created a browser-local
board and navigated to `/room/<local-id>?local=1`. The failed cloud creation
message was stored in homepage React state, which was lost on navigation.
The new board had no cloud owner capability to authorize invitations, so
clicking Share produced an HTTP 403 even in the original browser.

The room header also equated an unavailable Supabase Realtime connection
with “Local mode,” even when Redis cloud persistence was available.
Realtime connectivity and cloud board storage are now shown separately.

## Changes

- A failed cloud creation no longer silently falls back to local mode.
  The homepage displays the actual HTTP error and offers **Retry cloud
  creation** or an explicit **Continue with a local-only board** option.
- Existing local boards can be opened and upgraded via **Share → Move this
  board to cloud**. The editor keeps the original local copy; it creates
  a private Redis room and uploads a complete snapshot as a protected,
  revision-checked update *before* navigating to the new room.
- The new owner capability is stored for later invitation generation.
  Authorization continues to be checked server-side.
- On failed upload the local canvas remains unchanged. If Redis confirms
  the upload but localStorage is full, the Redis copy is still usable.
- The homepage board collection does not try to generate a cloud invite
  for boards explicitly marked local-only.
- Room status distinguishes **Local-only board**, **Redis cloud** and
  **Realtime reconnecting**.
- Six regression tests cover creation, validation, authorization header
  for initial snapshot, persistence acknowledgement, and error handling.

## Fix existing local rooms

1. Open the local board in your original browser. If its URL ends with
   `?local=1`, it was explicitly created in local mode.
2. Click **Share → Move this board to cloud**. Wait for creation and upload.
3. The app opens a *new* room URL and preserves the old local room.
4. Click **Share → Generate editor invitation** on the new cloud room.
5. Open the generated `#access=` invitation in a separate browser.

## If cloud creation still fails

The homepage now displays the API's actual error; don't ignore it:

- HTTP 429: room creation has been rate limited. The v1.6 server uses a
  fixed anonymous creation limit of 5/hour per recognized request identity.
  Without a trusted proxy IP header, identities may share a coarse global
  rate bucket. Don't disable rate limiting on a public deployment; configure
  a trusted identity and review the creation quotas instead.
- HTTP 503: Redis credentials are absent or the Redis command failed.
  `/api/config` returning `persistence: true` means variables are present,
  NOT that a Redis write succeeded.
- HTTP 403 Invalid origin: check the public origin and reverse-proxy setup.
  `POST /api/rooms` enforces same-origin requests.

In the browser Developer Tools → Network, inspect the **POST /api/rooms**
status and JSON error body. Never share owner tokens, editor tokens, Redis
credentials, or service-role secrets in debugging output.

## Validation

`npm test` passes 41 local tests. TypeScript/TSX sources parse, and new
lines stay within 100 columns. A complete production build and real cloud
roundtrip have not been run in this environment; verify them locally.
