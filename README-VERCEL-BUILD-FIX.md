# Vercel build repair — v1.6.4

## What was wrong

The old `/api/maintenance/flush` handler imports `backupDirtyRooms`, which did not
exist in `lib/server/cloud-backup.ts`. This made the entire Vercel build fail
before deployment. This patch restores the bounded batch backup implementation
while preserving the existing authenticated maintenance route and Redis/Supabase
checkpoint behavior. A single failed room backup remains queued for retry.

Vercel also reported a missing module from `app/api/ably/token/route.ts`. That
route was retired when this app moved from Ably to Supabase Realtime. It is
**not** in the latest project archive, so your Git working tree probably still
contains it. Copying files over an older repository does not delete old files.

## Fix your Git repository

1. Apply the two changed TypeScript files from the patch ZIP (or replace your
   project with the full source archive).
2. In the repository root, remove the legacy Ably route if it exists:

   ```bash
   git rm -r --ignore-unmatch app/api/ably
   # If the route was untracked, delete the directory manually instead:
   rm -rf app/api/ably
   ```

3. Confirm no obsolete SDK imports remain:

   ```bash
   grep -R -n 'ably\|backupDirtyRooms' app lib --include='*.ts' --include='*.tsx'
   ```

   `backupDirtyRooms` should appear both as the import in the maintenance route
   and the export in `cloud-backup.ts`. Ably imports should be absent.
4. Check and commit the change:

   ```bash
   npm install
   npm test
   npm run typecheck
   npm run build
   git add -A
   git commit -m "Fix Vercel backup export and remove obsolete Ably route"
   git push
   ```

5. Redeploy the **new commit** in Vercel. If an old module path still appears in
   logs, check the deployment's Git commit and branch. You may also redeploy
   with Vercel's build cache cleared.

## Scheduled backups

The `POST /api/maintenance/flush` endpoint is still enabled only when you set
`BACKUP_CRON_SECRET` to a secret of at least 24 characters, and callers provide
`Authorization: Bearer <secret>`. The route processes up to five oldest dirty
rooms per invocation. It reports attempted/complete/pending counts; unresolved
rooms remain in Redis's dirty queue for a future attempt. It uses Supabase
Storage and PostgreSQL only when the private backup credentials and SQL setup
are configured. Do not expose the cron secret or service-role key to the browser.

**Note:** Vercel's built-in cron service makes GET requests. This route is POST
by design, so use an external trusted scheduler that can send an authenticated
POST, or add a separately reviewed Vercel-specific secure GET entrypoint.

## Verification limits

Source parsing and local automated tests have been performed. A full Next.js
build requires npm dependencies, which were unavailable in the packaging
runtime. The exact deployed repository and Vercel environment have not been
accessed, so confirm the build in your own pipeline.
