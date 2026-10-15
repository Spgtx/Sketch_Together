# Room invitation link fix

The SQL in `supabase/schema.sql` is a one-time Supabase setup script.
It is never generated as a room invite URL.

## Fixed behavior

In a room: Share -> Generate editor invitation. A private `#access=` link is
shown directly in the dialog, with a separate Copy invitation button. If your
browser denies clipboard access, select the visible link and copy it manually.

On the homepage: copying a board link also shows the invitation URL below
the saved boards. Real API error reasons now appear instead of being hidden.

**Important:** Treat the entire URL as an editing credential. Do not post it
publicly. The link grants editor access, not view-only access.

## Troubleshooting

1. `npm install && npm run typecheck && npm run dev`.
2. Click New board and note the `/room/<id>` address.
3. From the room, Share -> Generate editor invitation.
4. Copy the URL ending in `#access=<token>` and test in a private window.
5. If an error is shown, inspect Network: `POST /api/rooms/[roomId]/share`.
6. HTTP 403 means the browser is not an owner (or doesn't have a valid editor
   invitation to reshare); HTTP 429 means rate-limited; HTTP 503 suggests
   unavailable Redis. SQL setup affects backups and private Realtime, not
   creation of room invitation URLs.

The actual SQL script still needs to be run in Supabase once for backups and
Realtime policies. Do not paste its contents into an invitation link box.

## v1.6.2 owner-session recovery

If you created the room but receive "Only room owners can invite editors"
(HTTP 403), see `README-OWNER-ACCESS-FIX.md`. Share now retries a valid saved
owner token against Redis without granting new ownership to guests.
