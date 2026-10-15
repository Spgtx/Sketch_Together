# v1.6.3 cloud/local mode fix

See **README-CLOUD-MODE-FIX.md** for the new room creation and
local-to-cloud migration workflow.

**v1.6.2 owner invitation fix:** See `README-OWNER-ACCESS-FIX.md` for the HTTP 403
room-owner recovery fix and migration guidance.

# SketchTogether v1.6 — Secure Cloud Rooms

The Endless Sketchpage/Art Studio UI, custom stickers, painting tools and
smart connectors are preserved. New work: room authorization, rate limiting,
object-level protected saving, private Realtime authorization and optional
Supabase Storage/Postgres backup.

**Start with [README-SECURE-CLOUD.md](README-SECURE-CLOUD.md).**

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Existing v1.5 room IDs have **no secure owner secret**. They are not silently
migrated or made public. Open them through the homepage on a browser with its
local saved artwork to clone the local copy into a new private cloud room.

The API configuration flags only indicate credentials, not successful writes.
Check a real room's Redis sync response and its optional Supabase backup status
before claiming durable persistence. The database backup job requires separate
credentials and scheduled execution.

All guest edit links remain bearer credentials. Do not use private client artwork
for a public beta until rate limits and Supabase RLS are configured and tested.


## v1.6.4 Redis HTTP 500 fix

See `README-REDIS-500-FIX.md`. Run `npm run redis:check` to verify
real Redis connectivity and commands before trying to create cloud rooms.
