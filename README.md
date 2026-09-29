# Qless

**Let the queue wait for you.** A working virtual queue for **Sathyabama Canteen · Counter 01**.

Students scan a QR code and automatically receive a token. They leave the counter area, track their place on their phone, and return when called. No app, account, registration, student ID, or join button. Operators control the same queue from a PIN-protected dashboard.

## Quick start — Windows CMD

Use Node.js 22 LTS or 24 LTS and npm. Run these commands in **Command Prompt**, not PowerShell (or use `npm.cmd` in PowerShell).

```cmd
cd /d "C:\Users\KANIMOZHI M\OneDrive\Desktop\Qless"
npm install
npm run demo:setup
npm run dev
```

`demo:setup` creates `.env.local` only if it does not already exist. It generates a private random admin PIN and session secret, selects a local network IP, and enables **local demo mode**. The PIN is printed once and remains in `.env.local`. The setup script never overwrites existing settings.

Open `http://localhost:3000/admin`. Enter the `ADMIN_PIN` from `.env.local`. In Settings, select **Load demo queue**. If that button is disabled, select **Start new queue**, confirm, then load the demo. Open **Overview → Show QR**.

Local demo mode is a real persistent embedded PostgreSQL database using PGlite at `.qless/pgdata`. It executes the same SQL schema and queue functions as Supabase. Updates use 2-second polling. It is explicitly labeled in the operator UI and is **not Supabase Realtime**. Run only one Qless server against this directory at a time. Local data and credentials are ignored by Git.

For a production-style local server, stop `npm run dev` first:

```cmd
npm run build
npm start
```

## Phone demo

1. Connect the laptop and phone to the same Wi-Fi network. On Windows, run `ipconfig` and find the **Wi-Fi adapter's IPv4 address**. Ignore VPN, virtual-machine, and disconnected adapters.
2. Set `NEXT_PUBLIC_APP_URL=http://YOUR_WIFI_IPV4:3000` in `.env.local`, then restart the dev server. `demo:setup` chooses the first non-loopback adapter; verify it is the Wi-Fi adapter.
3. If Windows asks, allow Node.js on your trusted **private** network. The phone must be able to open that URL; campus guest Wi-Fi can block device-to-device traffic. A laptop/phone hotspot or deployed HTTPS URL avoids that restriction.
4. Admin → Settings → Start new queue → Load demo queue. Q-001 is serving and Q-002–Q-005 are waiting.
5. Admin → Show QR. Scan it with Google Lens or a phone camera, then open its URL. Q-006 is created automatically and appears on both screens.
6. Return the laptop to Overview. Press **Complete & call next** repeatedly: 4 → 3 → 2 → 1 → 0 people ahead, then **It’s your turn!**. One final completion shows **All done!**
7. Rescan from the same browser while the token is active: it opens the same token. Refreshing/reopening the token URL also works.

There are five advances from serving Q-001 to serving Q-006. People ahead counts earlier **waiting** tokens, excluding the person at the counter, exactly as specified in the brief. At zero waiting people ahead, the student remains “You’re next” until the currently serving token finishes.

`localhost`, `127.0.0.1`, `0.0.0.0`, and `::1` QR destinations are deliberately disabled with an operator warning. QR codes have a four-module quiet zone, medium error correction, and dark modules on white.

## Features

- Automatic database token allocation with UUID identities and Q-001-style session numbers.
- Signed anonymous browser cookies, active-token recovery, and database uniqueness constraints.
- Mobile waiting, almost-there, next, serving, completed, skipped, and session-ended states.
- Supabase Realtime invalidation, 2-second fallback polling, 15-second reconciliation while connected, and reconnect on tab focus/network recovery.
- PIN authentication, 12-hour signed admin sessions, persistent login throttling, authenticated server mutations, same-origin checks, and RLS.
- Complete and call next, skip and call next, open/pause/close admissions, new session with confirmation, demo load/clear.
- Timestamp-based history and honest waiting, served-today, average wait/service, and peak waiting metrics.
- Configurable 90-second default service time and almost-turn threshold.
- Responsive off-white/emerald UI, Geist typography, Lucide icons, restrained motion, keyboard focus, reduced-motion support, and live status announcements.
- Missing configuration, unavailable database, invalid token, stale action, expired session, closed/paused queue, and connection error states.

## Stack and structure

Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS 4, Geist, Lucide React, Framer Motion, Supabase PostgreSQL/Realtime, `qrcode`, Vitest, and Playwright. Small semantic components and a native accessible dialog keep the UI dependency surface modest; shadcn is not required here.

```text
src/
  app/                    Pages and authenticated API route handlers
    join/canteen/         Automatic entry screen
    token/[id]/           Live student token
    admin/                Dashboard, QR display, history, settings
    api/                  Session, join, snapshots, login/logout, queue actions
  components/             Landing, student, admin, QR and shared UI
  hooks/                  Realtime/polling and guarded operator actions
  lib/                    Database adapter, auth, environment, metrics, types
supabase/migrations/      Actual PostgreSQL schema/functions/security
scripts/setup-demo.mjs    Non-overwriting local setup
tests/                   SQL-backed integration and security tests
tests/e2e/               Two-browser judge flow, QR decoding, mobile/network tests
```

Routes: `/`, `/join/canteen`, `/token/[id]`, `/admin`, `/admin/display`, `/admin/history`, `/admin/settings`.

## Architecture and queue algorithm

```text
Laptop QR → phone /join/canteen
                ↓ automatic POST
         Next.js server + signed browser cookie
                ↓ service-role RPC
         PostgreSQL transaction + row lock
                ↓ committed queue change
         Supabase queue_signals event
                ↓
         phone + admin fetch fresh state

Admin action → authenticated Next.js endpoint → same database transaction
```

`qless_join` locks the single canteen row with `FOR UPDATE`. Every mutating queue function takes that same lock, so joins cannot race with each other or a session rollover. It first recovers the browser's active token, then checks admissions. It increments `next_sequence` atomically and inserts the token. There is no client-side number generator and no unprotected `MAX + 1`.

The database additionally enforces `UNIQUE(queue_session_id, sequence_number)`, one active token per browser/session, one active queue per canteen, and one serving token per session. UUIDs are internal identities; visible numbers restart per session. Numbers beyond 999 expand naturally rather than truncating.

`qless_action` completes/skips the current token and calls the earliest waiting token in one transaction. The request carries both the session UUID and expected serving UUID. A stale double-click or old dashboard tab cannot advance a second token. Buttons also lock immediately in the browser. No waiting tokens is a safe no-op for Call next.

Database states: WAITING → SERVING → COMPLETED, SERVING → SKIPPED, active token → CANCELLED when a session ends or demo tokens are cleared. NEXT is derived; the first waiting row is “Up next.” The student heads-up shows “You’re next” with one or zero waiting people ahead, following the requested demo wording. Skipped/completed/cancelled records are excluded from positions.

New session cancels active tokens, closes/archives the old session, creates the new one, and preserves all history. Demo load is allowed only on a fresh open session; it creates exactly five clearly marked records and serves the first. Clearing demo tokens cancels only active demo records; it never deletes history or real tokens.

### ETA and metrics

Service duration = `completed_at - called_at`. ETA = earlier waiting count × rolling average of the latest 20 completed, non-demo service durations. With no completed real durations, the configured default (90 seconds) applies. Rapidly completing real tokens during a rehearsal will therefore produce very short genuine estimates. Demo records never bias averages or served-today counts.

Average wait = `called_at - joined_at` for real tokens completed today. Served-today uses Asia/Kolkata dates. Peak waiting is derived from queue-size events in the current session (including explicitly marked demo records). Missing duration data displays **No data yet**. Estimates below one minute display **<1 min**; estimates are not guarantees.

### Database schema

| Table            | Purpose                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `canteens`       | Fixed campus/counter identity                                          |
| `queue_sessions` | Open/paused/closed state, sequence, start/end dates                    |
| `tokens`         | UUID, display number, status, browser reference, demo flag, timestamps |
| `queue_events`   | Durable action audit and peak queue evidence                           |
| `settings`       | Default duration and alert threshold                                   |
| `queue_signals`  | Public revision/timestamp only, for realtime invalidation              |
| `auth_attempts`  | Hashed-IP login attempt windows                                        |

All seven tables have RLS. Anon/authenticated users can only read `queue_signals`; they cannot read token tables or execute mutating RPCs. Service-role credentials remain server-only. The student API returns only that token and aggregate position data; admin snapshots require an admin cookie. A token UUID URL is an unguessable bearer link: anyone you share it with can view that token, but cannot change it.

### Realtime design

Triggers on token, session, and settings changes update `queue_signals` in the same transaction. Clients subscribe to its Postgres UPDATE events and immediately refetch their authorized view. This deliberately avoids publishing private browser IDs or bearer token URLs to all students. [Supabase Postgres Changes documentation](https://supabase.com/docs/guides/realtime/postgres-changes) describes publication and RLS prerequisites.

Disconnected subscriptions use 2-second polling and automatically retry. Connected subscriptions also reconcile every 15 seconds. Labels distinguish **Live**, **Live · 2s updates**, and **Reconnecting…**. HTTP failures retain the last visible token while showing an error; invalid tokens and expired admin access stop automatic retries. Keep the student page open: background push/SMS and notifications after closing the browser are not implemented.

## Supabase setup (required for hosted use)

1. Create a Supabase project you control and wait for its database to become ready.
2. Open **SQL Editor → New query**. Paste the complete contents of [`supabase/migrations/001_qless.sql`](supabase/migrations/001_qless.sql) and run it **once on a fresh project/database**. This creates the canteen, an empty open session, settings, indexes, RPCs, RLS, grants, triggers, and the realtime publication entry. It does not insert fake analytics or silently load demo tokens.
3. In **Project Settings → API / API Keys**, copy the project URL and public key and keep the server key private. The variable names match the brief: `NEXT_PUBLIC_SUPABASE_ANON_KEY` accepts a publishable `sb_publishable_...` key or enabled legacy anon key; `SUPABASE_SERVICE_ROLE_KEY` accepts a secret `sb_secret_...` key or enabled legacy service-role key. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys). Never put the server key in a `NEXT_PUBLIC_*` variable.
4. In **Database → Publications**, check that `supabase_realtime` includes **queue_signals**. No token table should be made publicly readable. The SQL adds this entry automatically when the publication exists. Verify with:

   ```sql
   select schemaname, tablename
   from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename = 'queue_signals';
   ```

   If no row is returned and the publication exists, run once:

   ```sql
   alter publication supabase_realtime add table public.queue_signals;
   ```

5. Populate environment variables below. Set `QLESS_LOCAL_DB=false` or omit it. Restart locally / redeploy on Vercel.
6. Log in at `/admin`, load a fresh demo, scan from a separate phone/browser, and run the acceptance flow. **Live** indicates a websocket subscription; **Live · 2s updates** means the fallback is functioning but you should check the publication/key/network.

Hosted Supabase credentials are not bundled. Cloud execution and actual Supabase websocket delivery must be verified after you supply your project. Local tests execute the SQL on PGlite; its single connection does not reproduce contention among multiple hosted PostgreSQL connections. The database row-lock/unique-index design is included for that concurrency safety.

## Environment variables

Copy `.env.example` to `.env.local` for Supabase development, or use the local setup command above. Never commit `.env.local`.

| Variable                        | Value                                                                                     | Browser-visible? |
| ------------------------------- | ----------------------------------------------------------------------------------------- | ---------------- |
| `NEXT_PUBLIC_APP_URL`           | Origin only, e.g. `https://YOUR-PROJECT.vercel.app` or `http://192.168.1.7:3000`; no path | Yes              |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project's HTTPS API URL                                                     | Yes              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public publishable/anon key                                                               | Yes              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Private server secret/service-role key                                                    | **No**           |
| `ADMIN_PIN`                     | Your private operator PIN, at least 4 characters; use 6+ digits                           | **No**           |
| `SESSION_SECRET`                | Random secret of at least 32 characters                                                   | **No**           |
| `QLESS_LOCAL_DB`                | Optional; `true` for one-process local demo only. Omit/false on Vercel                    | No secret        |

Generate a session secret in CMD:

```cmd
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Changing the session secret invalidates existing signed sessions. Production cookies are HttpOnly, SameSite=Lax, Secure, and signed; local HTTP uses non-Secure cookies so phone demos work. The admin PIN is never sent back to the browser. The login throttle permits 10 attempts per hashed IP per 10-minute window.

## Testing

```cmd
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` runs SQL-backed tests against isolated in-memory PGlite, plus cookie/PIN/QR validation. Coverage includes unique sequence allocation, concurrent requests, duplicate recovery, queue states, position, safe advancement, unique serving, stale actions, rollover/history, demo controls, real timestamps/ETA, RLS, invalid IDs, and login throttling.

Browser tests use your `.env.local` and port 3000, starting a dev server if needed. **Run them against a disposable local demo queue**: they start/archive sessions, add demo tokens, and advance the queue. They verify the two-browser Q-006 flow, independently decode the generated PNG QR, check unauthenticated requests, simulate 12 simultaneous HTTP joins and first-visit tabs, test network loss/recovery, and check no horizontal overflow at 375×667, 390×844, 393×852, and 430×932. They leave a fresh five-token demo queue. Screenshots/traces are in ignored `test-results/`.

Browser throttling is real: repeated test runs can reach the 10-attempt login window; wait for expiry instead of disabling authentication. Never point these tests at a live event queue. Physical Google Lens/iPhone camera scanning, public-domain reachability, and Supabase websocket delivery are separate final checks after setup.

## GitHub preparation

Install Git for Windows if `git` is not recognized, then reopen CMD. Create an empty GitHub repository in your own account. From this project:

```cmd
git init
git add .
git status
git commit -m "Build Qless virtual canteen queue"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Check `git status` before committing: `.env.local`, `.qless`, `node_modules`, `.next`, and browser-test artifacts must not appear. The lockfile, source, migration, `.env.example`, and README belong in the repository. Git initialization, remote creation/push, and deployment are intentionally left to you.

## Vercel deployment — manual

1. Complete Supabase setup and push this folder to your GitHub repository.
2. In Vercel choose **Add New → Project**, import the repository, and select **Next.js**. Project root is this folder. Use Node.js 22 or 24, install with `npm ci`, build with `npm run build`, and keep Next.js output defaults.
3. Add the Supabase URL, public key, server key, `ADMIN_PIN`, and `SESSION_SECRET` to the **Production** environment. Add Preview too only if you intend previews to use this database. Set `QLESS_LOCAL_DB=false` or leave it unset. The app refuses local database mode on Vercel.
4. If the domain is not known yet, leave `NEXT_PUBLIC_APP_URL` unset for the first deployment. Deploy. The app displays a clear QR configuration message until this is set.
5. Copy the stable **production** URL (not a per-commit preview URL). Set `NEXT_PUBLIC_APP_URL=https://YOUR-PROJECT.vercel.app` in Vercel environment variables.
6. **Redeploy** so the public settings are included in the build. This requires no source edit. If using a custom domain later, update the variable and redeploy again. [Vercel deployment documentation](https://vercel.com/docs/deployments) covers importing Git repositories and redeployments.
7. Open the production `/admin`, enter your production PIN, load demo data, and open `/admin/display`. Ensure the phone can access the public production URL without Vercel deployment-protection login.
8. Scan on your phone and complete the judge flow. Confirm the UUID token persists across refresh and both screens advance automatically.

No deployment has been performed by this project setup.

## Troubleshooting and limits

| Symptom                                   | Action                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.ps1 cannot be loaded`                | Use Windows CMD, or `npm.cmd` / `npx.cmd` in PowerShell.                                                                                          |
| Database/setup error                      | Configure all Supabase keys and run the migration, or deliberately enable local demo mode with `demo:setup`. No silent fake-data fallback exists. |
| Local database startup error              | Keep a single server open. Stop dev before `npm start`. A writable project folder is required. Do not delete `.qless` if you need its history.    |
| QR missing                                | Set a valid reachable `NEXT_PUBLIC_APP_URL`, restart/rebuild. Settings shows the destination.                                                     |
| QR opens on laptop but not phone          | Use Wi-Fi IPv4, same network, Node firewall permission, or deployed HTTPS. Check guest Wi-Fi isolation and VPN adapters.                          |
| New scans return paused/closed            | Reopen admissions in Settings. Existing active tokens are recovered even while paused/closed.                                                     |
| Token appears twice in different browsers | Each browser profile has its own anonymous identity. Camera in-app browsers and Safari/Chrome may differ. Use the same browser for repeat scans.  |
| Realtime says 2s updates                  | Check `queue_signals` publication, public key and websocket access. Polling continues automatically.                                              |
| Student stops updating in background      | Browsers suspend background tabs. Reopen the page; it immediately reconciles. There is no push notification service.                              |
| PIN rejected                              | Check server-side `ADMIN_PIN`, restart/redeploy after changes. After 10 attempts, wait 10 minutes.                                                |
| Demo load disabled                        | Start a new open session first. Demo numbering is never spliced into an existing queue.                                                           |
| Serving Q-006 takes five clicks           | Correct: the four waiting tokens plus the current serving token must finish.                                                                      |
| History has repeated Q-001                | Numbers reset per session. Rows include date/session shorthand; UUIDs remain unique.                                                              |
| Build works but production cannot connect | Check Vercel Production environment variables, Supabase project availability, RPC migration, server key, and `QLESS_LOCAL_DB=false`.              |

This is a one-canteen/one-counter hackathon prototype. History UI shows the latest 200 entries; the server currently aggregates all records and is intended for modest demo volumes. There is no skipped-token restore, background push, student identity verification, multi-counter system, ordering, or payment flow. Anonymous queue access is intentionally frictionless and not a full public-internet anti-abuse system. A new browser/cleared cookies can obtain another token. Web Locks serialize simultaneous first-visit tabs where the browser supports them; normal repeat scans are always deduplicated by signed cookie plus database constraint.
