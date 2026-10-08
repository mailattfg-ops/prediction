# Football Match Prediction Platform (QR)

Event-style football prediction campaigns. An admin creates a prediction session for a match, prints the
QR code, and participants who scan it get a 10-minute window to predict the winner. After the match the
admin enters the score, the system marks every prediction WINNER or LOST, and WhatsApp notifications go
out through the Meta WhatsApp Business Cloud API.

```
QR scan → match + countdown → name / mobile / email (+ custom fields) → pick Home / Away / Draw → submit
       → WhatsApp confirmation → admin enters result → winners evaluated → WhatsApp winner / lost message
```

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, TypeScript), Tailwind CSS 4 |
| Database | PostgreSQL + Prisma 6 |
| Auth | bcrypt password hashing, HS256 JWT (`jose`) in an httpOnly cookie, roles `SUPER_ADMIN` / `ADMIN` |
| Validation | zod (server-side, every input) |
| QR | `qrcode` (PNG / SVG / data URL) |
| Export | CSV (built-in) and Excel (`exceljs`) |
| Notifications | DB-backed job queue (`Notification` table, `FOR UPDATE SKIP LOCKED`) + worker, Meta WhatsApp Cloud API |
| Tests | Vitest (unit + PostgreSQL integration) |

No Redis is required: the notification queue lives in PostgreSQL and is drained by `npm run worker`
(or by a cron hitting `POST /api/jobs/notifications` on serverless hosts).

## Quick start (local)

```bash
cp .env.example .env            # edit AUTH_SECRET at minimum
docker compose up -d            # PostgreSQL 16 on localhost:5432
npm install
npm run db:migrate              # creates the schema (prisma migrate dev)
npm run db:seed                 # creates the SUPER_ADMIN from SEED_ADMIN_* and a demo match
npm run dev                     # http://localhost:3000/admin
npm run worker                  # in a second terminal: sends queued WhatsApp messages (dry-run by default)
```

Login with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env` (defaults `admin@example.com` / `ChangeMe123!`).

To try the participant flow on a phone, set `APP_URL` to a URL the phone can reach (e.g.
`http://192.168.1.20:3000`, your PC's Wi-Fi IP, or an ngrok tunnel). The QR code embeds `APP_URL`, and the
phone must be on the same Wi-Fi for a LAN IP. In development Next.js only serves its scripts to hostnames
listed in `allowedDevOrigins` (`next.config.ts`); private LAN ranges and common tunnel domains are already
listed, so add yours there if the page loads but buttons do nothing. Restart `npm run dev` after changing
`next.config.ts`.

## How the 10-minute rule is enforced

* A session stores `startTime` and `expiryTime = startTime + durationMinutes`.
* `GET /api/public/sessions/:token` returns `serverTime`, `startTime`, `expiryTime` and the computed status.
  The browser renders a countdown from those values and re-syncs every 30 s. It never decides anything.
* `POST /api/public/sessions/:token/prediction` runs one transaction that re-reads the session, reads
  `SELECT now()` from PostgreSQL and accepts only when `startTime <= now < expiryTime`
  (`src/lib/window.ts`). A request at exactly `expiryTime` gets HTTP 410.
* `ACTIVE` and `EXPIRED` are never stored; they are derived from the clock on every read, so a stale row
  can never keep a window open.
* Client-supplied timestamps are stripped by the zod schema and ignored.

## Duplicate protection

* Participants are identified by mobile number (normalized to E.164, `DEFAULT_COUNTRY_CODE` is added to
  10-digit numbers). `Participant.mobile` is UNIQUE and `Prediction(sessionId, participantId)` is UNIQUE.
* Concurrent submissions from the same user hit the constraint; the API maps it to HTTP 409
  "You have already submitted your prediction for this match." A secondary session + email check runs
  inside the same transaction.

## Result finalization

1. Admin enters the score and clicks **Calculate Winners** → `POST /api/sessions/:id/result/preview`
   (reads only) → confirmation modal shows the outcome and winner / loser counts.
2. **Confirm Result** → `POST /api/sessions/:id/result` → one transaction: lock the match row, upsert
   `MatchResult` as FINAL, `UPDATE predictions SET resultStatus = WINNER` where
   `selectedOutcome = winningOutcome` and LOST otherwise, mark sessions COMPLETED, insert one notification
   job per prediction, write the audit log.
3. A FINAL result refuses further finalization (HTTP 409). Only a SUPER_ADMIN can **Reopen Result**
   (`POST /api/sessions/:id/result/reopen`), which resets evaluations to PENDING and is audit-logged.
   Re-finalizing bumps `MatchResult.version` and logs `ADMIN_RESULT_CORRECTED`.

Winner determination is `homeScore > awayScore → HOME`, `< → AWAY`, `= → DRAW`, with an optional explicit
override for official rulings. No randomness or heuristics anywhere (`src/lib/results.ts`).

A result belongs to the **match**, not to a session. If several sessions (QR codes / venues) point at the
same match, finalizing from any of them evaluates all of them; the confirmation modal shows the counts for
the current session and lists the other sessions that will be evaluated. Use one match per real fixture
and one session per venue or campaign.

## Exact score prediction (optional per session)

Enable **Ask for the exact score** on a session. The Home/Away/Draw buttons are replaced by one question:
the final score for each team. The winning outcome is derived from the score on the server (a draw score
is rejected when draws are off), so winner/lost evaluation and statistics keep working unchanged.

On finalization every prediction with the exact score is marked `scoreCorrect` (a plain comparison, no
randomness). If several participants got it right, one **score winner** is drawn at random, like a raffle:

* Pool = all exact-score predictions of the session.
* Draw = Fisher–Yates shuffle (Durstenfeld variant, Knuth TAOCP vol. 2 Algorithm P) where every swap
  index comes from Node's `crypto.randomInt`, a cryptographically secure generator that uses rejection
  sampling, so there is no modulo bias. Every entry in the pool has exactly the same chance; submission
  time, position or anything else plays no role (`src/lib/draw.ts`, tested in `tests/draw.test.ts`).
* The winner is the first entry of the shuffled order. The whole draw (method, pool, order, winner,
  time, admin) is written to the audit log as `SCORE_WINNER_DRAWN`, and the Winners page shows the draw
  record with runners-up in case a winner has to be replaced.
* The draw happens inside the finalization transaction only; the preview never draws. Reopening and
  re-finalizing performs a new draw and keeps the old record.

References: https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle and
https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback.

The score winner receives the `score_winner` WhatsApp template, appears on the Winners page, and is
flagged in the exports (`Predicted Score`, `Exact Score`, `Score Winner` columns).

## Timed-out registrations (details after the window closes)

By default a session keeps collecting **participant details** after its window has closed (toggle: "After
the window closes, keep collecting participant details"). The participant page then keeps showing the
normal form with the countdown at `00:00`. On submit the server rejects the prediction (410), the browser
stores the details as a `LateEntry` (name, mobile, email, custom fields, consent, timestamp) and shows a
**Prediction Time Over** popup saying the prediction was not counted. No
outcome or score is ever stored or evaluated for these rows. With the toggle off, the page shows the plain
"Prediction Closed" screen instead and nothing is collected.

Rules: `POST /api/public/sessions/:token/late-entry` is accepted only when the database clock is past
`expiryTime` (409 `WINDOW_OPEN` otherwise), one entry per session + mobile (409 `DUPLICATE`, also when the
person already has a prediction), 410 for cancelled or opted-out sessions. Admins see them on the session
page and under the predictions table ("Timed-out registrations"), and exports append them with
`Result = TIMED_OUT`. They receive no WhatsApp messages.

## WhatsApp notifications

Messages are sent only through approved templates. Register these templates in Meta Business Manager
(names are configurable through env, parameters are positional in this order):

| Event | Default template name | Parameters `{{1}}..{{n}}` |
|---|---|---|
| Prediction submitted | `prediction_submitted` | name, home_team, away_team, predicted_team, submission_time |
| Winner | `prediction_winner` | name, home_team, home_score, away_score, away_team, predicted_team |
| Winner (draw) | `prediction_winner_draw` | name, home_team, home_score, away_score, away_team |
| Lost | `prediction_lost` | name, home_team, home_score, away_score, away_team, predicted_team |
| Score winner | `score_winner` | name, home_team, home_score, away_score, away_team |
| Result announcement (optional) | `result_announcement` | name, home_team, home_score, away_score, away_team, result |

The approved copy for each template is in `src/lib/notifications/templates.ts`.

Delivery: submissions and finalization only *enqueue* rows in `Notification`. The worker claims due rows
with `FOR UPDATE SKIP LOCKED`, calls the Cloud API, and records `SENT` / `RETRYING` / `FAILED` with the
provider message id or error. Retries: immediately, after 30 s, after 2 min, then FAILED. Admins see
per-session counts on the session page and can **Retry Failed**.

Set `WHATSAPP_DRY_RUN=false` plus `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` to send for real.

## API

```
POST /api/auth/login                      POST /api/auth/logout
GET  /api/stats                           (dashboard totals)
GET|POST /api/matches                     GET|PUT|DELETE /api/matches/:id
GET|POST /api/sessions                    GET|PUT|DELETE /api/sessions/:id   (DELETE = archive)
POST /api/sessions/:id/cancel             GET  /api/sessions/:id/qr?format=png|svg
GET  /api/sessions/:id/predictions[?winners=1]
GET  /api/sessions/:id/results            (counts, percentages, per-minute timeline)
GET  /api/sessions/:id/export?format=csv|xlsx[&winners=1]
POST /api/sessions/:id/result/preview     POST /api/sessions/:id/result     POST /api/sessions/:id/result/reopen (SUPER_ADMIN)
GET  /api/sessions/:id/notifications[?status=FAILED]   POST /api/sessions/:id/notifications/retry
GET  /api/public/sessions/:token          POST /api/public/sessions/:token/prediction
POST /api/jobs/notifications              (Authorization: Bearer $CRON_SECRET)
```

Errors are always `{ "error": { "code", "message", "details?" } }`. Public prediction codes:
`NOT_FOUND` 404, `NOT_STARTED` 403, `EXPIRED` 410, `CANCELLED` 410, `DUPLICATE` 409, `VALIDATION` 422,
`RATE_LIMITED` 429.

## Project layout

```
prisma/schema.prisma          data model (see below) · prisma/seed.ts
src/proxy.ts                  auth gate for /admin and admin APIs
src/lib/window.ts             the 10-minute decision (pure, unit-tested)
src/lib/predictions.ts        submission transaction        src/lib/results.ts   finalize / reopen
src/lib/sessions.ts           session service + stats       src/lib/matches.ts
src/lib/notifications/        templates · queue · whatsapp client · worker
src/lib/export.ts qr.ts auth.ts jwt.ts validation.ts rate-limit.ts audit.ts http.ts format.ts db.ts
src/app/api/**                thin route handlers           src/app/admin/**     dashboard UI
src/app/predict/[token]/      participant page              scripts/worker.ts    long-running sender
tests/                        vitest unit tests · tests/integration (needs DATABASE_URL)
```

Data model: `AdminUser`, `Match`, `MatchResult`, `PredictionSession` (secureToken, startTime, expiryTime,
status DRAFT/SCHEDULED/CANCELLED/COMPLETED, allowDraw, …), `FormField` (custom participant fields per
session), `Participant` (unique mobile), `Prediction` (unique session + participant, `customData` JSON,
`resultStatus` PENDING/WINNER/LOST), `Notification` (queue + delivery log), `AuditLog`.

## Security notes

* All business rules run on the server; the browser is untrusted (time, status, validation).
* Passwords: bcrypt (cost 12). Sessions: signed JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in
  production), 12 h expiry. Admin mutations also verify the `Origin` header.
* Role checks in handlers (`requireAdmin(req, "SUPER_ADMIN")` for reopen).
* zod validation with length limits on every input, Prisma parameterized queries, React escaping, logo
  URLs restricted to http(s), CSV cells neutralized against formula injection.
* Security headers + CSP in production (`next.config.ts`), `X-Powered-By` removed.
* Rate limits: login 10 / 15 min per IP, prediction POST 120 / min per IP (generous so a venue behind one
  NAT keeps working; the DB constraint is the real duplicate guard), public GET 300 / min per IP.
  The limiter is in-memory per instance; move it to Postgres/Redis if you scale horizontally.
* QR tokens are 128 random bits (base64url), never derived from ids. Drafts and archived sessions are 404.
* Participant data is only visible in the authenticated admin area and exports.

## Tests

```bash
npm test                 # unit tests always run; integration tests run when DATABASE_URL is set in .env
```

Covered: 09:59 accepted, exactly 10:00 rejected, 10:01 rejected, duplicate user rejected, invalid token,
cancelled session, not-started session, concurrent submissions (two users both succeed, one user three
times yields one record), client timestamps ignored, next-day access rejected, deterministic winner
evaluation, finalize-once idempotency, reopen + correction audit trail, draw template selection, worker
draining in dry-run.

## Deployment

Any Node 20.9+ host with PostgreSQL works (Railway, Render, Fly.io, a VPS with PM2, Docker). Vercel works
too; use the cron route instead of the worker.

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set `AUTH_SECRET` (random, ≥ 32 chars), `APP_URL` (public https URL, used in QR codes), `APP_TIMEZONE`,
   `DEFAULT_COUNTRY_CODE`, WhatsApp variables, and `CRON_SECRET` if using the cron route.
3. `npm ci && npm run build` (runs `prisma generate`).
4. `npm run db:deploy` (applies migrations) and `npm run db:seed` once to create the super admin.
5. Run `npm start` for the web app and `npm run worker` as a second always-on process
   (PM2: `pm2 start npm --name worker -- run worker`). On Vercel, add a cron job calling
   `POST /api/jobs/notifications` every minute with the `Authorization: Bearer $CRON_SECRET` header.
6. Put the app behind HTTPS (required for `Secure` cookies and for phones to trust the QR URL).
7. Change the seeded admin password: create a new SUPER_ADMIN by re-running the seed with new
   `SEED_ADMIN_*` values, or update `AdminUser.passwordHash` with a bcrypt hash.

Docker (web): a plain `node:22-alpine` image running `npm ci && npm run build` then `npm start` works;
the worker is the same image with `npm run worker`.

## Future extensions (designed for, not built)

`Match.externalId` and the match fields map 1:1 to football data providers, so a fetcher can create or
update matches and results without schema changes. `Prediction.selectedOutcome` can be joined by a
`questionType` column for correct-score / first-scorer questions. Notification events are an enum; new
events (reminders, announcements) are a template entry plus an enqueue call.
