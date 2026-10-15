# SketchTogether v1.6.4 — Cloud room HTTP 500 diagnosis

## Confirmed code defect

In v1.6.3 the `limited()` call in `POST /api/rooms` executed **outside** its
`try/catch`. Redis EVAL/network failures therefore produced an unhandled
Next.js HTTP 500. v1.6.4 moves the check inside the handler and returns
HTTP **503 with a meaningful stage**. The error category is logged on the
server, without exposing credentials.

This change **does not claim your actual Redis credentials are working**.
Until your server successfully executes Redis commands, room creation
will remain unavailable rather than silently falling back to local mode.

## Quick steps

1. Copy the patch files over your v1.6.3 project, including the new script.
2. From the project root run `npm install` if necessary.
3. Put your *server-side* Upstash REST values into `.env.local`:
   - `UPSTASH_REDIS_REST_URL` — HTTPS REST endpoint **not** a `redis://` URL
   - `UPSTASH_REDIS_REST_TOKEN` — REST access token from the **same** database
4. Run `npm run redis:check`. Expected: `PASS` for PING, EVAL, SET/GET/DEL.
5. Restart Next.js with `npm run dev` and create a **new** room.
6. If creation still fails, the browser now shows a 503 reason; the terminal
   prints `[rooms:create] rate-limit|metadata|document ...`.

Only share the pass/fail lines and redacted error category; **never share**
`.env.local`, tokens, room owner secrets or full Redis server logs.

`GET /api/config` returning `persistence: true` only proves env vars are set.
It does not prove the REST endpoint or token are correct.

## Additional safeguard

If Redis successfully creates room metadata but fails to write the initial
canvas document, v1.6.4 attempts to remove the incomplete metadata entry.
Rate limiting and ownership checks remain enabled.

## Validation limits

The new handler is covered by mocked route tests. A real Redis roundtrip and
full Next.js production build must be executed in your environment; credentials
and external network access are not available in this test workspace.
