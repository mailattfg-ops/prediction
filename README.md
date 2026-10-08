# Football Match Prediction Platform

A QR-code prediction game for football events. The admin creates a **match**, opens a **prediction
session** for it and prints the QR code. Fans scan it, enter their details and predict the winner (or the
exact score) inside a 10-minute window. After the game the admin enters the final score; the system marks
every prediction as a winner or a loss, draws a score-prize winner where needed, shows the result on the
QR page and sends WhatsApp messages through the Meta WhatsApp Business Cloud API.

```
Admin: create match → create session → print QR
Fan:   scan QR → details + prediction → submit → WhatsApp confirmation
Admin: enter final score → calculate winners → confirm (permanent)
Fan:   WhatsApp winner / lost message → QR page shows score and winner
Admin: winners list, exports, notification delivery
```

Built for Green Jobs events by Think Forge Global.

---

## Contents

1. [Features](#1-features)
2. [Key concepts: matches, sessions, statuses](#2-key-concepts-matches-sessions-statuses)
3. [Running an event (admin guide)](#3-running-an-event-admin-guide)
4. [What participants see](#4-what-participants-see)
5. [Business rules](#5-business-rules)
6. [Quick start (local development)](#6-quick-start-local-development)
7. [Configuration (.env)](#7-configuration-env)
8. [WhatsApp setup](#8-whatsapp-setup)
9. [Architecture and project layout](#9-architecture-and-project-layout)
10. [Data model](#10-data-model)
11. [API reference](#11-api-reference)
12. [Testing](#12-testing)
13. [Deployment](#13-deployment)
14. [Troubleshooting](#14-troubleshooting)
15. [Security](#15-security)
16. [Extending the platform](#16-extending-the-platform)

---

## 1. Features

**Admin console** (`/admin`)
- Secure login (bcrypt passwords, signed httpOnly cookie), roles `SUPER_ADMIN` and `ADMIN`.
- Dashboard: totals, live sessions, participation chart, WhatsApp delivery, recent sessions.
- Matches: create, edit, delete (GitHub-style typed confirmation).
- Sessions: window start and duration, draw on/off, winner pick or exact score, consent checkbox, extra
  participant fields (text / number / select), event and campaign names, draft mode.
- QR poster page with PNG / SVG download and print layout, sponsor branding included.
- Live stats per session: vote split, predictions per minute, timed-out registrations.
- Result entry with a preview of winners and losers and a confirmation dialog.
- Winners page with the random-draw record, predictions table, CSV / Excel export.
- WhatsApp delivery table per message type with "Retry failed".
- Audit log of every admin action (session changes, finalization, draws, deletions, retries).

**Participant page** (`/predict/<token>`)
- Mobile-first, works from any QR scanner, sponsor strip, live countdown driven by the server clock.
- Name, mobile, email, optional custom fields and consent.
- Winner pick (Home / Away / Draw) or exact-score entry.
- Success screen with confetti, "time over" dialog for late submissions, final result and winner screen
  after the admin finalizes.

**Platform**
- Server-enforced 10-minute window using the database clock.
- One prediction per person per session, enforced by database constraints.
- Deterministic evaluation, cryptographically secure random draw for the score prize.
- WhatsApp notifications through a database-backed queue with retries (no Redis needed).
- Everything configurable per session or through environment variables; no fixtures are hard-coded.

## 2. Key concepts: matches, sessions, statuses

| | Match | Session |
|---|---|---|
| What it is | The football fixture: home team, away team, kick-off, competition, venue, logos | One prediction event on a match: its own QR code, window and settings |
| Created | Once per real fixture | One or more per match (one per venue, gate or campaign) |
| Holds | The final result | Predictions, timed-out registrations, winners, exports, notification counts |
| Where | Matches page | Sessions page, New session |

The result belongs to the match. Entering the score from any session evaluates every session on that
match; the confirmation dialog lists the other sessions that will be affected. A new session created on a
match that already has a final result shows the result screen immediately.

Session status is partly stored, partly computed from the clock:

| Status | Meaning |
|---|---|
| Draft | Saved but the QR link answers "invalid QR" |
| Scheduled | Published, window not open yet (countdown to opening) |
| Live | Window open: predictions accepted |
| Expired | Window closed, result not entered yet |
| Completed | Result finalized |
| Cancelled | Stopped by the admin, QR rejects submissions |

## 3. Running an event (admin guide)

1. **Sign in** at `/admin/login` with the admin account (see [Quick start](#6-quick-start-local-development)
   for the seeded credentials).
2. **Create the match** (Matches → New match): home team, away team, kick-off date and time. Logos,
   competition and venue are optional and appear on the participant page.
3. **Create the session** (New session). Settings:
   - *Prediction opens at* and *Duration*: the window; default 10 minutes. Expiry is start plus duration.
   - *Status*: Scheduled (live) or Draft.
   - *Exact score prediction*: participants enter a score instead of picking a team. Only the exact score
     wins; one score-prize winner is drawn at random among exact scores.
   - *Allow "Draw"*: offers Draw as an outcome, or accepts draw scores in score mode.
   - *Show result & winners on the QR page*: after finalization the QR page shows the score and winners.
   - *Show vote split to participants*: percentages on the success and result screens.
   - *Keep collecting details after the window closes*: late scanners still fill the form, see a
     "Prediction time over" dialog and are stored as timed-out registrations (no prediction).
   - *Require privacy consent checkbox*.
   - *Additional participant fields*: presets (Age, Gender, City, State, Country, Organization) or custom
     text / number / select fields, each optionally required.
4. **Print the QR** (session → QR code): download PNG or SVG, or Print. The poster shows the sponsor, the
   match and "Scan to predict". The QR embeds `APP_URL`, so set it to the public address before printing.
5. **During the window**: the session page shows live counts, the vote split and predictions per minute.
   Predictions lists every entry; timed-out registrations appear below it.
6. **Enter the result** (session → Enter match result): type both scores, optionally override the official
   outcome, click **Calculate winners**, check the preview (winners, losers, other sessions on the match,
   exact-score count) and **Confirm result**. This is permanent: predictions are marked, the score-prize
   winner is drawn, notifications are queued and the audit log is written.
7. **Winners and exports**: the Winners page lists winners and the draw record (method, pool, order with
   runners-up). Export CSV or Excel from the session, predictions or winners pages.
8. **WhatsApp delivery**: the session page shows sent / failed / queued per message type. Queued messages
   are sent by the worker (`npm run worker`) or the cron route; **Retry failed** re-queues failures.
9. **Cancel, archive, delete**: Cancel stops a session immediately (data kept). Archive hides a session and
   disables its QR (data kept). Delete match removes the match with all its sessions, predictions,
   registrations, result and notification logs after typing the match name; participant identities are kept.

## 4. What participants see

| Situation | Screen |
|---|---|
| Window not open yet | Match card with "Prediction opens in" countdown; the form appears automatically |
| Window open | "Live" badge, countdown, details form, Who will win? or score entry, Submit prediction |
| Submitted | "Prediction submitted" with their pick, confetti, note that the winner will be announced here and on WhatsApp |
| Already submitted | "You have already submitted your prediction for this match." |
| Scanned after the window (collect-after-close on) | Same form with the countdown at 00:00; on submit a "Prediction time over" dialog, details stored, nothing predicted |
| Scanned after the window (collect-after-close off) | "Prediction closed" |
| Result finalized | Full-time score, winning team, score-prize winner (name, masked number, predicted score, time), all winner names, sponsor line |
| Cancelled session | "Session cancelled" |
| Invalid or archived QR | "Invalid QR code" |

The page re-syncs with the server every 30 seconds, so a cancellation or a finalized result shows up
without a reload.

## 5. Business rules

**10-minute window.** A session stores `startTime` and `expiryTime`. The public API returns the server
time with them; the browser only animates a countdown. The submission transaction re-reads the session
and PostgreSQL's `now()` and accepts only when `startTime <= now < expiryTime`. A submission at exactly
the expiry second is rejected with HTTP 410. Client clocks and client-sent timestamps are ignored.
Active and expired are never stored; they are derived from the clock on every read.

**One prediction per person.** Participants are identified by mobile number, normalized to E.164
(`DEFAULT_COUNTRY_CODE` is added to 10-digit numbers). `Participant.mobile` and
`Prediction(sessionId, participantId)` are unique in the database, so simultaneous submissions cannot
create duplicates; the API answers 409. A session + email check runs in the same transaction.

**Winner-pick sessions.** `homeScore > awayScore` is Home, `<` is Away, `=` is Draw. Predictions equal to
the outcome become WINNER, all others LOST. The admin can override the official outcome for a ruling.

**Exact-score sessions.** Only an exact score counts: predictions matching both scores become WINNER,
every other prediction is LOST even when it named the right team. Among the exact scores one
**score-prize winner** is drawn at random: a Fisher–Yates shuffle (Durstenfeld variant) driven by Node's
`crypto.randomInt`, which uses the operating-system CSPRNG with rejection sampling, so every entry has
exactly the same chance. The draw (method, pool, resulting order, winner, time, admin) is written to the
audit log as `SCORE_WINNER_DRAWN` and shown on the Winners page with runners-up. The preview never draws;
the draw happens inside the finalization transaction. References:
[Fisher–Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle),
[crypto.randomInt](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback).

**Finalization is permanent.** A finalized result cannot be reopened or edited. Check the score in the
preview before confirming. A wrong result can only be removed together with its match.

**Timed-out registrations.** When collect-after-close is on, a submission after expiry stores name,
mobile, email, custom fields and consent as a `LateEntry` and never an outcome or score. One per person
per session; people who already predicted cannot also register late. They receive no WhatsApp messages
and appear in exports with `Result = TIMED_OUT`.

**Prediction mode is locked** once a session has predictions (switching between winner pick and exact
score would make existing entries unevaluable).

**Privacy.** Participant data is visible only in the authenticated admin area and exports. The public
result screen shows winner names and a masked mobile number of the score-prize winner, never emails or
full numbers. The participant form carries a short privacy note and an optional consent checkbox.

## 6. Quick start (local development)

Requirements: Node 20.9+ (22 recommended), Docker Desktop (for PostgreSQL) or any PostgreSQL 14+.

```bash
cp .env.example .env            # set AUTH_SECRET at minimum
docker compose up -d            # PostgreSQL 16 on localhost:5432
npm install                     # also runs prisma generate
npm run db:migrate              # creates the schema
npm run db:seed                 # creates the super admin and a demo match
npm run dev                     # http://localhost:3000/admin
npm run worker                  # second terminal: sends queued WhatsApp messages (dry run by default)
```

The super admin is created from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` in `.env`.
To add an admin or change a login later (no re-seeding needed):

```bash
npm run admin:set -- admin@example.com "new-password" "Admin Name" SUPER_ADMIN
npm run admin:set -- new@example.com "new-password" "Admin Name" SUPER_ADMIN --replace old@example.com   # rename an account
```

**Testing on a phone.** The QR embeds `APP_URL`, so set it to an address the phone can reach, for example
your PC's Wi-Fi IP and port (`http://192.168.1.20:3000`), a Tailscale address, or a tunnel URL. The phone
must be on the same network for a LAN address. In development Next.js serves its scripts only to
hostnames listed in `allowedDevOrigins` in `next.config.ts`; private LAN ranges, Tailscale and common
tunnel domains are already listed.

Useful scripts:

| Script | Purpose |
|---|---|
| `npm run dev` | development server (add `-- -p 3001` to pick a port) |
| `npm run build` / `npm start` | production build and server |
| `npm run worker` | WhatsApp sender loop |
| `npm test` | unit tests, plus integration tests when `DATABASE_URL` is set |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma migrations, production migrate, seed, data browser |
| `npm run admin:set -- <email> <password> [name] [role] [--replace old]` | create, update or rename an admin login |

## 7. Configuration (.env)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Secret for admin session cookies, at least 32 random characters |
| `APP_URL` | Public base URL embedded in QR codes, no trailing slash |
| `APP_TIMEZONE` | IANA zone for admin displays, exports and WhatsApp timestamps (e.g. `Asia/Kolkata`) |
| `DEFAULT_COUNTRY_CODE` | Digits added to 10-digit mobile numbers entered without a country code (e.g. `91`) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | Super admin created by `npm run db:seed` |
| `WHATSAPP_DRY_RUN` | `true` logs messages instead of sending them |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION` | Meta Cloud API credentials |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Template language code, default `en` |
| `WHATSAPP_TEMPLATE_SUBMITTED`, `_WINNER`, `_WINNER_DRAW`, `_LOST`, `_SCORE_WINNER`, `_RESULT` | Names of the approved templates |
| `CRON_SECRET` | Bearer token for `POST /api/jobs/notifications` (serverless alternative to the worker) |
| `SPONSOR_NAME`, `SPONSOR_TAGLINE`, `SPONSOR_LOGO_URL`, `SPONSOR_URL` | Sponsor branding; empty name hides it. Logo can be a file in `public/sponsors/` or an https URL || `FOOTBALL_API_KEY` | Reserved for a future football data provider |

## 8. WhatsApp setup

Business-initiated messages must use templates approved in Meta Business Manager. Create these templates
(positional parameters in this order) and put their names in `.env` if they differ from the defaults:

| Event | Default template | Parameters `{{1}}…{{n}}` |
|---|---|---|
| Prediction submitted | `prediction_submitted` | name, home_team, away_team, predicted_team, submission_time |
| Winner | `prediction_winner` | name, home_team, home_score, away_score, away_team, predicted_team |
| Winner (draw) | `prediction_winner_draw` | name, home_team, home_score, away_score, away_team |
| Lost | `prediction_lost` | name, home_team, home_score, away_score, away_team, predicted_team |
| Score-prize winner | `score_winner` | name, home_team, home_score, away_score, away_team |
| Result announcement (optional) | `result_announcement` | name, home_team, home_score, away_score, away_team, result |

The suggested copy for each template is in `src/lib/notifications/templates.ts`.

Delivery works through a queue in the `Notification` table. Submissions and finalization only enqueue
rows; the worker (`npm run worker`) or the cron route claims due rows with `FOR UPDATE SKIP LOCKED`
(safe with several workers), calls the Cloud API and records `SENT`, `RETRYING` or `FAILED` with the
provider message id or error. Retries: immediately, after 30 seconds, after 2 minutes, then failed.
Set `WHATSAPP_DRY_RUN=false` with the token and phone number id to send for real.

## 9. Architecture and project layout

One Next.js 16 application serves the participant page, the admin console and the REST API. All rules
live in `src/lib`; route handlers and server-rendered pages call those services. PostgreSQL via Prisma 6
is the only state store. A separate worker process drains the notification queue.

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, TypeScript), Tailwind CSS 4 |
| UI | shadcn/ui on Base UI primitives (`src/components/ui`), lucide-react icons, recharts, sonner toasts, Motion animations, canvas-confetti, Bebas Neue display font via next/font |
| Database | PostgreSQL + Prisma 6 |
| Auth | bcrypt, HS256 JWT (`jose`) in an httpOnly cookie, `src/proxy.ts` gate |
| Validation | zod on every input |
| QR / export | `qrcode`, built-in CSV, `exceljs` |
| Notifications | database queue + worker, Meta WhatsApp Cloud API |
| Tests | Vitest (unit + PostgreSQL integration) |

```
prisma/schema.prisma            data model · prisma/migrations · prisma/seed.ts
public/sponsors/                sponsor logo(s)
scripts/worker.ts               long-running WhatsApp sender
src/proxy.ts                    auth gate for /admin and admin APIs
src/lib/window.ts               the 10-minute decision (pure, unit-tested)
src/lib/predictions.ts          submission and timed-out registration transactions
src/lib/results.ts              preview, finalize, score draw record
src/lib/draw.ts                 Fisher-Yates + crypto.randomInt
src/lib/sessions.ts matches.ts  services and statistics
src/lib/notifications/          templates · queue · whatsapp client · worker
src/lib/export.ts qr.ts sponsor.ts auth.ts jwt.ts validation.ts rate-limit.ts audit.ts http.ts format.ts db.ts
src/app/api/**                  route handlers
src/app/admin/**                admin console pages
src/app/predict/[token]/        participant page
src/components/admin/           shell, page header, stat cards, charts, status badges, export menu
src/components/ui/              generated shadcn/ui components
tests/                          unit tests · tests/integration (needs DATABASE_URL)
```

## 10. Data model

| Model | Purpose and key constraints |
|---|---|
| `AdminUser` | name, email (unique), password hash, role |
| `Match` | teams, logos, competition, kick-off, venue, `externalId` (unique, for a future data provider) |
| `MatchResult` | one per match: scores, winning outcome, FINAL status, finalized by / at |
| `PredictionSession` | secure token (unique, 128 random bits), start / expiry, duration, status, allowDraw, enableScorePrediction, collectLateEntries, showWinnersToParticipants, showResultsToParticipants, requireConsent, campaign / event names, archivedAt |
| `FormField` | custom participant fields per session (unique session + key) |
| `Participant` | full name, mobile (unique, E.164), email |
| `Prediction` | unique session + participant; outcome, predicted score, result status, scoreCorrect, scoreWinner, custom data, consent, submittedAt (database time), ip, user agent |
| `LateEntry` | details captured after the window closed; unique session + participant |
| `Notification` | queue and delivery log: type, template, phone, payload, status, attempts, nextAttemptAt, provider id, error |
| `AuditLog` | actor, action, entity, before / after |

## 11. API reference

Admin routes require the login cookie; mutations also check the `Origin` header.

```
POST /api/auth/login                      POST /api/auth/logout
GET  /api/stats                           dashboard totals
GET|POST /api/matches                     GET|PUT|DELETE /api/matches/:id   (DELETE body: {"confirm":"Home vs Away"})
GET|POST /api/sessions                    GET|PUT|DELETE /api/sessions/:id  (DELETE = archive)
POST /api/sessions/:id/cancel             GET  /api/sessions/:id/qr?format=png|svg
GET  /api/sessions/:id/predictions[?winners=1]
GET  /api/sessions/:id/results            counts, percentages, per-minute timeline, score winner
GET  /api/sessions/:id/export?format=csv|xlsx[&winners=1]
POST /api/sessions/:id/result/preview     POST /api/sessions/:id/result   (finalize, permanent)
GET  /api/sessions/:id/notifications[?status=FAILED]     POST /api/sessions/:id/notifications/retry
GET  /api/public/sessions/:token          session, server time, window, settings, sponsor, result and winners
POST /api/public/sessions/:token/prediction
POST /api/public/sessions/:token/late-entry
POST /api/jobs/notifications              Authorization: Bearer $CRON_SECRET
```

Errors are always `{ "error": { "code", "message", "details?" } }`.

| Code | HTTP | When |
|---|---|---|
| `NOT_FOUND` | 404 | unknown, draft or archived token |
| `NOT_STARTED` | 403 | window not open yet |
| `EXPIRED` | 410 | window closed or session completed |
| `CANCELLED` | 410 | session cancelled |
| `DUPLICATE` | 409 | same person already submitted or registered |
| `WINDOW_OPEN` | 409 | late-entry while predictions are still open |
| `VALIDATION` | 422 | invalid fields (`details` maps field to message) |
| `RATE_LIMITED` | 429 | too many requests from one address |
| `ALREADY_FINAL`, `LOCKED`, `CONFIRMATION_REQUIRED` | 409 / 400 | admin rule violations |

## 12. Testing

```bash
npm test
```

Unit tests always run (window rule, evaluation, draw fairness, templates, validation). Integration tests
run against the database in `DATABASE_URL` and cover: 09:59 accepted, 10:00 and 10:01 rejected, invalid
token, cancelled and not-started sessions, next-day access, duplicate and concurrent submissions,
client timestamps ignored, finalization once with audit trail and queue drain, exact-score evaluation
with the random draw record and public winner info, timed-out registrations, match deletion.

## 13. Deployment

Any Node 20.9+ host with PostgreSQL works (Railway, Render, Fly.io, a VPS with PM2, Docker). Vercel works
too; use the cron route instead of the worker.

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set `AUTH_SECRET`, `APP_URL` (public https URL used in QR codes), `APP_TIMEZONE`,
   `DEFAULT_COUNTRY_CODE`, the WhatsApp variables, sponsor variables, and `CRON_SECRET` if using the cron route.
3. `npm ci && npm run build`.
4. `npm run db:deploy` to apply migrations, then `npm run db:seed` once to create the super admin.
5. Run `npm start` for the web app and `npm run worker` as a second always-on process
   (PM2: `pm2 start npm --name worker -- run worker`). On Vercel, schedule
   `POST /api/jobs/notifications` every minute with the `Authorization: Bearer $CRON_SECRET` header.
6. Serve over HTTPS (required for secure cookies and for phones to trust the QR link).
7. Set a strong admin password with `npm run admin:set -- <email> <password> "<name>"` (never commit real
   passwords; `.env.example` only carries a placeholder).

Docker: a `node:22-alpine` image running `npm ci && npm run build` then `npm start` works; the worker is
the same image running `npm run worker`.

## 14. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Phone says the site cannot be reached after scanning | `APP_URL` points to `localhost`. Set it to an address the phone can reach, restart, download the QR again. The QR page warns when the URL is local. |
| Page loads on the phone but buttons do nothing | Development only: add the hostname to `allowedDevOrigins` in `next.config.ts` and restart `npm run dev`. |
| Admin pages fail with "Unknown argument" after pulling changes | New migrations were applied; restart the dev server so it loads the regenerated Prisma client. |
| `npm run dev` picks a different port | Port 3000 is in use. Start with `npm run dev -- -p 3001` and set `APP_URL` to match. |
| Messages stay queued | Start `npm run worker` (or the cron job). Dry-run mode marks them sent without contacting Meta. |
| Messages fail | Check the error text under "Show failed" on the session page, fix credentials or template names, then "Retry failed". |
| Winners show 0 in a score session although people picked the right team | By design: only the exact score wins in score sessions. |
| A new session shows the result immediately | Its match already has a final result; create a new match for the next fixture. |

## 15. Security

- All rules run on the server; the browser is untrusted for time, status and validation.
- bcrypt (cost 12) passwords; signed JWT in an httpOnly, SameSite=Lax cookie (Secure in production), 12-hour expiry; Origin check on admin mutations; role checks in handlers.
- zod validation with length limits on every input, parameterized queries through Prisma, React output escaping, logo URLs limited to http(s), CSV cells neutralized against formula injection.
- Security headers and a production Content Security Policy in `next.config.ts`.
- Rate limits: login 10 per 15 minutes per IP, prediction 120 per minute per IP (tolerant of a venue behind one NAT), public reads 300 per minute per IP. The limiter is in-memory per instance.
- QR tokens are 128 random bits and never derived from database ids. Drafts and archived sessions answer 404.
- Every admin action is audit-logged.

## 16. Extending the platform

- `Match.externalId` and the match fields map directly to football data providers; a fetcher can create or
  update matches and results without schema changes (`FOOTBALL_API_KEY` is reserved for it).
- Additional prediction questions (first scorer, player of the match) fit as new columns or a question
  type next to `selectedOutcome`; evaluation lives in `src/lib/results.ts`.
- New notification events are a template entry in `templates.ts` plus an enqueue call.
- Leaderboards, points, rewards and coupons can build on `Prediction.resultStatus`, `scoreWinner` and the
  audit log without touching the submission path.
