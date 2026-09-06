# Remaining work: task list (2026-09-05)

Everything the District 3011 platform still needs before it matches the master
spec and can replace the Vercel site. Compiled by comparing the spec
(`2026-09-04-website-master-spec.md`, `2026-09-04-implementation-spec.md`) against
the code in `rac3011-api` and `rac3011-web` at commits `d9094b7` / `217653e`, the
live testing deployment, and the production DNS. Supersedes the status table in
`2026-09-04-feature-inventory-and-tasks.md`.

Legend: **S** under half a day · **M** one to two days · **L** three days or more.
"API done" means the endpoints exist and are e2e-tested; only the screen is missing.

What is already complete and not repeated below: spec build-order steps 0 to 7,
12 and 13 (scaffolds, auth, RBAC, public site, CMS and settings, reporting, points,
members, showcase, and all five subdomains), plus the 15-minute and daily
`pg_dump` cron jobs on Oracle.

---

## 0. Urgent: fix before anything else

- [x] **Wire real email behind `NotificationPort`.** (M) DONE 2026-09-05 (`aaa57c9`, deployed) `NotificationsModule` binds
  the port to `ConsoleNotificationAdapter`, so every notification, including the
  login OTP, is only written to the container log. The `EmailProviderPool` with
  four transports exists and is unit-tested but nothing calls it. Login in
  production works only because of the temporary bypass code.
- [ ] **Remove `GLOBAL_OTP=424242`** from the production API env once the item above
  is live and a real OTP email has been received end to end. (S)
- [ ] **Production project subdomains return HTTP 525.** (S) `mission3011.`,
  `drishti.`, `rcl.`, `careerbridge.` and `ride.rotaract3011.org` resolve to
  Cloudflare-proxied IPs with no working origin certificate, so anyone who types
  those URLs today gets a Cloudflare error page. Either point them at Oracle now
  (same pattern as `testing.*`) or remove the records until cutover.
- [ ] **Purge the 14 fake Drishti patient records** on Rahul's word. They read like
  real people with real phone numbers. (S)
- [ ] **Privacy policy and terms of service** real text (content from Rahul, see
  `content-needed-for-launch.md`). Legal basis for holding member PII; the member
  directory is already live behind login. (S once text arrives)

---

## 1. Spec step 9: notifications, push, announcements (largest gap)

Schema exists (`NotificationOutbox`, `PushSubscription`, `Announcement`,
`AnnouncementRead`, `EmailProviderUsage`). Nothing writes to the outbox and no
template exists.

### 1a. Dispatch and outbox
- [x] `NotificationDispatchService` implementing `NotificationPort`: resolve
  `userId` recipients to emails and push subscriptions, render template, insert
  one outbox row per recipient per channel, enqueue `notifications.send`. (M)
- [x] BullMQ `notifications.send` processor in the worker process (`WORKER=1`):
  email via `EmailProviderPool`, push via `web-push`; record `provider` on the
  outbox row; retry with backoff; dead-letter after N attempts. (M)
- [x] Template registry `src/notifications/templates/<key>.ts` exporting
  `subject`, `html`, `text`, `push`. All 26 keys from spec §7: `otp`,
  `member-registered`, `member-approved`, `member-rejected`, `report-queried`,
  `report-replied`, `report-scored`, `showcase-submitted`, `showcase-published`,
  `showcase-rejected`, `announcement`, `feedback-replied`, `booking-requested`,
  `booking-confirmed`, `booking-declined`, `booking-reminder`, `link-broken`,
  `event-reminder`, `enquiry-received`, `listing-verify`, `listing-verified`,
  `camp-submitted`, `camp-approved`, `ride-host-assigned`,
  `contribution-approved`, `certificate-issued`. (L) DONE 2026-09-05
  (`rac3011-api` PR #2, `6e27ed5`, merged+deployed). **Caveat**: 9 of the 26 keys
  (`announcement`, all four `booking-*`, `event-reminder`, `contribution-approved`,
  `certificate-issued`, `report-scored`) have no real caller anywhere in the
  codebase yet — those modules (DRR bookings, announcements, effort log,
  certificates) don't exist. Field names in those templates are best-effort
  guesses from the spec; whoever wires up sections 1c/2A/3/4 below must
  double-check the `notify({ data: {...} })` payload against the template file.
- [x] Recipient rewrite for non-production (`recipient-rewrite.ts` exists) verified
  so testing never emails real members. (S)
- [x] Audit every existing `.notify()` call site (auth, enquiries, feedback,
  link-health, members, imports, reports, showcase, careerbridge, mission3011,
  ride) passes the data each template needs. (S) DONE 2026-09-05 — found and fixed
  two real gaps: `showcase-admin.service.ts` wasn't passing `title`/`slug` to the
  showcase-published/rejected templates, and `mission3011-camps.service.ts` was
  passing a raw club id (`profile.clubId`) where the template needed a readable
  club name (now resolved via `MeService.getClub()`).
- [ ] Add the missing triggers: `event-reminder` (24h before RSVP going, cron),
  `report-scored`, `feedback-replied`, `drishti` and `rcl` have none and may not
  need any; confirm. (M)
- [ ] Wire Oracle Email Delivery credentials, Resend, Mailgun and Gmail SMTP in
  the production env; verify daily-cap failover with acceptance tests #12 and #19. (M)

### 1b. Web push
- [ ] `POST /me/push-subscriptions` and `DELETE`, VAPID keys in env
  (`VAPID_*` already declared). (S)
- [ ] Service worker in `rac3011-web/public/sw.js` handling `push` and
  `notificationclick`; register from `App.tsx`. (M)
- [ ] Wire the existing `PushPermissionSection` on `/portal/me/settings` to
  actually subscribe and post the subscription; unsubscribe path. (S)
- [ ] Prune subscriptions on 404/410 from the push service. (S)

### 1c. Announcements (spec §6.W)
- [x] API: `GET /announcements` (feed for caller, marks `AnnouncementRead`),
  `POST /announcements` (`announcements:send`, club-scoped for presidents;
  `announcements:send_all` for district-wide), `POST /announcements/audience/estimate`. (M)
  DONE 2026-09-05 (`rac3011-api` PR #3, `4b97b2d`, merged+deployed).
- [x] Audience resolver per spec §6.6: roles ∩ zones/clubs ∪ explicit members;
  empty audience is 400. President targeting another club is 403. (M) DONE
  2026-09-05, same PR. Code review before merge found and fixed two real bugs:
  a zoneIds scope-escalation (a club-scoped sender's own club always overlaps
  its zone, so any zoneIds audience bypassed the scope check — fixed to
  require the whole zone be in scope) and a cross-dimension gap (a club-scoped
  role grant never matched a zoneIds query and vice versa — fixed to expand
  each grant to both dimensions). 11 e2e tests, including regression coverage
  for both.
- [x] Web: `/portal/announcements` member feed (replaces ComingSoon). (S) DONE 2026-09-05
  (`rac3011-web` PR #1, `d599c5d`), verified on `main` 2026-09-06: `AnnouncementsFeedPage.tsx`
  is wired into `portalMember.routes.tsx`, no ComingSoon left on that route.
- [x] Web: `/portal/admin/announcements` compose + `/portal/admin/announcements/audience`
  builder with live estimate (replaces two ComingSoon routes). (M) DONE 2026-09-05
  (`rac3011-web` PR #1, `d599c5d`), verified on `main` 2026-09-06: `AdminAnnouncementsPage.tsx`,
  `AnnouncementAudiencePage.tsx` and `components/announcements/AudienceBuilder.tsx` all live. **Business rule,
  corrected 2026-09-05 by Rahul**: the original §6.6 reading (clubIds/zoneIds alone
  select nobody without roleKeys) was wrong. Fixed in `rac3011-api` PR #4 (`a6affb1`):
  `roleKeys` given → existing intersection (role holders ∩ those clubs/zones), unchanged;
  `roleKeys` absent + `clubIds`/`zoneIds` given → every approved member of those
  clubs/zones directly. `roleKeys` in the builder is now an optional narrowing filter,
  not a required field — a club/zone picker alone is a valid, meaningful "everyone in
  this club/zone" send.
- [x] Club dashboard "announcements" panel reads the real feed. (S) DONE 2026-09-05
  (`rac3011-web` PR #1, `d599c5d`), verified 2026-09-06: `DashboardPage.tsx` `AnnouncementsWidget`
  calls `fetchAnnouncementFeed({ page: 1, pageSize: 3 })`.
- [x] Acceptance test #11. (S) DONE 2026-09-05, part of the API PR above.

---

## 2. Spec step 8 leftovers: events, check-in, feedback screens (API done)

- [ ] `/portal/admin/events` EventsAdmin CRUD screen (create/edit/delete
  district events, capacity, RSVP toggle, cover image via AssetUrlField). (M)
- [ ] `/portal/events` ClubEventTracker for `club_events:log` (club's own
  non-district events, feeds attendance adapter). (M)

> The check-in desk that used to sit here (`/portal/admin/events/:slug`) is
> superseded by section 2A: the members-only RSVP model it assumed cannot carry
> guests, coupons, or an offline desk.
- [ ] `/portal/feedback` member submit (general or event-scoped) and "mine" list. (S)
- [ ] `/portal/admin/feedback` review queue: open/reviewed/closed, reply. (S)
- [ ] `/portal/resources` member-side view of unlocked resources for the caller. (S)
- [ ] `/portal/dashboard` role variants per spec §9.5: OfficerDashboard
  (`reports:review`), ClubDashboard, MemberDashboard, DAC variant. Today it is one
  page with permission-gated widgets. (M)
- [ ] Calendar page: RSVP button state and "feedback after event" link on
  `EventPage` verified against the real API once feedback UI exists. (S)

---

## 2A. Event registration and check-in desk

Design: `docs/superpowers/specs/2026-09-05-event-checkin-registration-design.md`
(agreed with Rahul 2026-09-05). Replaces the members-only RSVP model with one
registration spine covering members with accounts, members without, outside guests
and walk-ins; folds check-in into that row; adds coupons and a live stats board.
Needs its own implementation plan before dispatch.

### Phase 1: usable at a venue with working wifi
- [ ] Schema and expand migration: `event_registrations`, `event_coupons`,
  `event_coupon_redemptions`, `Event.registrationRequired`, the identity check
  constraint and the partial unique index on `(event_id, lower(guest_email))`;
  backfill from `event_rsvps` and `event_checkins`. Old tables left in place. (L)
- [ ] Registration paths: public form (`POST /public/events/:slug/registrations`,
  throttled, honeypot, 409 at capacity), member self-registration
  (`PUT /events/:id/registration`), desk-created registrations. (M)
- [ ] Short-code generation (6 chars, no O/0/I/1, unique per event, retry on
  collision) and per-registration tokens. (S)
- [ ] `event-registered` template plus a reworked `event-reminder`, and the public
  `GET /public/registrations/:token/qr.png` endpoint the email embeds. (M)
- [ ] Desk endpoints: `POST /events/:id/checkins` accepting token, short code or
  registration id with `clientId` idempotency and `occurredAt` clamping;
  `POST /events/:id/coupon-redemptions`; both club-scoped per `events:checkin`. (M)
- [ ] Coupon definition CRUD under `events:manage`, and a registrations CSV export. (S)
- [ ] `GET /events/:id/stats`: registered/arrived/expected, ten-minute arrivals
  histogram, per-club and per-zone turnout including registered-but-absent clubs,
  per-coupon issued against redeemed. (M)
- [ ] Move `PointsSourceRepository.countCheckinsForClubAtEvents` onto the new table
  (members only, guests excluded by kind); acceptance test 6 must stay green. (S)
- [ ] Web: online desk at `/portal/admin/events/:slug` (continuous camera via
  `@zxing/browser`, green/amber/red full-screen confirm cards, per-outcome haptics,
  name and phone lookup, coupon mode) and the stats board. (L)
- [ ] Web: public registration form, and the calendar's RSVP control becoming a
  registration action for `registrationRequired` events. (M)
- [ ] Acceptance tests 1 to 9 from the design doc. (M)

### Phase 2: safe at a venue without
- [ ] `GET /events/:id/roster` snapshot with ETag and 304, carrying tokens, member
  card `qrToken`, `phoneLast4` only (no full phones or emails on volunteer
  devices). (M)
- [ ] IndexedDB roster cache and scan queue, service worker flush with a foreground
  fallback, offline badge and pending count. (L)
- [ ] Offline conflict paths: own-replay by `clientId` returns success, another
  device's win returns the amber result. (M)
- [ ] Playwright offline test (design doc acceptance test 10). (S)

### Later, after a real event has used it
- [ ] Contract migration: drop `event_rsvps` and `event_checkins`, rename
  `Event.rsvpOpen` to `registrationOpen`. Never bundled with the additive
  migration. (S)

---

## 3. Spec step 10: effort log, contributions, badges, certificates

Only tables exist (`EffortLog`, `Badge`, `MemberBadge`, `Certificate`).
Permissions `effort:log` and `effort:approve` are seeded but unused.

- [ ] Effort log API: `POST /effort` (member submits own hours), `GET /effort?mine`,
  `GET /effort` (scoped list for officers), `PATCH /effort/:id` approve/reject
  with discretionary points and reason, audited. (M)
- [ ] Points adapter: approved effort points into `ClubPointEntry` under the
  subjective category. (S)
- [ ] `/portal/me/contributions` submit + status list (replaces ComingSoon). (S)
- [ ] `/portal/admin/effort-log` approvals desk with points input (replaces
  ComingSoon). (M)
- [ ] Badge evaluators per spec §6.7: `first_project`, `events_10`, `events_25`,
  `hours_25`, `hours_100`, `service_1y`, `service_3y`, `phf` (manual
  `POST /members/:id/badges/phf`). Triggered on `showcase.published`,
  `checkin.created`, `effort.approved`, nightly anniversaries job. (M)
- [ ] Certificate issuance: pdfkit A4 landscape per spec (Montserrat, pink rule,
  district logo, reference id), stored in R2 private tier, `certificate-issued`
  notification. Auto-issue for `service_1y`, `service_3y`, `hours_100`. (M)
- [ ] `/portal/me/certificates` list + download and `/portal/me/badges` (or
  badges on the member card). (S)
- [ ] Badges visible to own club's officers on the member detail view, never
  cross-club. (S)

---

## 4. Spec step 11: DRR calendar

Only tables exist (`DrrBlock`, `DrrBooking`). Public route is ComingSoon.
Permission `drr_calendar:manage` is seeded but unused.

- [ ] Google Calendar OAuth (service account or DRR's consent), freebusy client
  with a fake for tests. (M)
- [ ] Pure `slots.ts` per spec §6.3 using settings `drr.*` keys (seed them),
  Asia/Kolkata, buffer, blackout dates, `unreachable` status on Google failure. (M)
- [ ] API: `GET /drr-calendar/slots`, `POST /drr-calendar/bookings` (overlap → 409,
  creates Google event, `booking-requested` to admins), `PATCH .../:id`
  confirm/decline, `GET/POST/DELETE /drr-calendar/blocks`. (M)
- [ ] `booking-reminder` cron 24h before confirmed bookings. (S)
- [ ] Web: `/drr-calendar` (checking / unreachable states), `/drr-calendar/book/:slot`
  form + confirmation with reference, `/drr-calendar/admin`. (M)
- [ ] Acceptance test #13. (S)

---

## 5. Admin screens where the API already exists

- [x] `/portal/admin/roles`: roles list, create role, grant and
  revoke permissions. API: `roles.controller`, `permissions.controller`. (M) DONE 2026-09-06
  (`rac3011-web` branch `admin-rbac-screens`, `b63a7bb`). Note: the "(super admin)" qualifier was
  deliberately NOT implemented as a frontend check. Spec 4.8.5 says `super_admin` is a role, not a
  code path, and 4.8.6 says the frontend never enforces, so the create control is gated on the same
  `roles:manage` route guard as the rest of the screen and the API remains the boundary.
- [x] `/portal/admin/users`: search users, view held roles with scope, grant and
  revoke scoped roles (`user-roles.controller`). (M) DONE 2026-09-06 (`26e2060`, `c6c5b8f`, `c66166f`).
  There is no `GET /users` endpoint, so user discovery goes through `GET /members` (whose DTO exposes
  `userId`) plus a pasted-user-id fallback for users with no member row. **This screen surfaced a real
  backend bug**: `GET /user-roles?filter[userId]=` was silently ignored under express 5's `simple`
  query parser, returning every grant in the district, which would have made Revoke delete another
  member's role. Fixed separately in `rac3011-api` branch `fix/user-roles-userid-filter` (`c8b8f3f`,
  regression test proven to fail pre-fix); the screen also filters client-side as defence in depth.
- [x] `/portal/admin/audit`: filterable audit log viewer (`audit.controller`). (S) DONE 2026-09-06
  (`4ff97fa`). `actorId` renders raw because the audit API exposes no actor name; enriching it is an
  api-repo change, logged as a follow-up rather than done here.
- [ ] Remove `ComingSoon` component and its 15 route usages once every screen
  above exists; add a lint rule or test that fails on any remaining import. (S)

---

## 6. Legacy data migration completeness (blocks cutover)

- [ ] `scripts/migrate-legacy.ts` per spec §3.4: `legacy_monthly_reports` →
  `reports` (club resolution by email then name, month parse, `schema_version=1`,
  queried status from `flag_reason`), `legacy_project_submissions` → `projects` +
  lead `project_clubs` row, `legacy_announcements` → `announcements`. Unmatched
  clubs to `scripts/out/unmatched-*.csv`, resolved via `club-aliases.json`. Only
  `migrate-legacy-users.ts` exists today. (M)
- [ ] TOTP secret carry-over for legacy users with `totp_secret` (flagged
  incomplete by the step-1 build). (S)
- [ ] Password reset email path for legacy users whose hash is not bcrypt. (S)
- [ ] Dry-run the full migration against a fresh Postgres from the latest Supabase
  export and diff row counts. (S)

---

## 7. Spec step 14: cutover and hardening

### 7a. Domains and hosting
- [ ] Decide origin path: Cloudflare Tunnel (spec §14.8, currently rolled back and
  `cloudflared` inactive on Oracle) or DNS-only A records as `testing.*` uses. (decision)
- [ ] Add production hostnames to the Oracle Dokploy web app (`rotaract3011.org`,
  `www`, five subdomains) and API; issue certificates. (S)
- [ ] Freeze Supabase writes, run legacy migration, reconcile rows changed since
  2026-09-03. (S)
- [ ] Flip `rotaract3011.org` DNS from Vercel to Oracle; keep `www` → apex redirect. (S)
- [ ] Decommission the Vercel project and the `rbansal42/RAC-Org-3011-website`
  Dokploy app on the VPS (`staging.rotaract3011.org` already 404s). (S)
- [ ] Verify spec §14.7.4 live: `cf-cache-status: HIT` on second `/public/home`
  request and p50 under 100 ms from India. (S)

### 7b. Operational
- [ ] Initialise Sentry in `main.ts` (dependency and `SENTRY_DSN` exist, never
  called); web-side error reporting too. (S)
- [ ] Rate limits on auth endpoints (`/auth/sign-in/email`, `/second-factor/*`,
  `/members/register` already throttled; sign-in is not). (S)
- [ ] Backups: confirm the Oracle cron uploads to `rac3011-backups` R2 or
  `onedrive:Backup/RAC3011-15min/` as the spec says, 30-day retention, and run
  one restore drill into a throwaway container. (S)
- [ ] Confirm `STORAGE_DRIVER=live` with both UploadThing tokens and R2 keys in
  the production API env (could not be read via the Dokploy API this session). (S)
- [ ] `docs/runbook.md`: deploy, rollback, rotate secrets, restore backup, purge
  cache, add a subdomain, add a lead club. (M)
- [ ] Drop `user_profiles` and legacy text columns after cutover soak. (S)
- [ ] Sitemap and robots: include the five subdomain hosts or serve per-host
  sitemaps; submit to Search Console for the apex. (S)

---

## 8. Verification gaps

- [ ] Spec §12 acceptance tests with no implementation yet: #11 (announcement
  audience), #12 and #19 (email pool failover through the real port), #13 (DRR
  booking). Re-audit #1 to #10, #14 to #18, #20 against `test/*.e2e.ts` titles and
  fill any that are only partially asserted. (M)
- [ ] RBAC e2e gaps noted during the subdomain review: RCL cross-club team
  update denial (404), Career Bridge admin route with no permission (403). (S)
- [ ] Lighthouse mobile ≥ 90 on Home, Map, Showcase (spec step 14); not run yet. (S)
- [ ] Playwright coverage for every screen added in sections 1 to 5 at 390/768/1440
  with axe, extending `e2e/mock-api.ts`. (ongoing)
- [ ] The flaky BullMQ purge test in `test/cache.e2e.ts` (passes alone, fails under
  load): fix the timing or isolate it. (S)
- [ ] Web `e2e/mock-api.ts` contract drift: add a test that the mock's routes match
  the OpenAPI document (`npm run typegen` source), so the login 404 class of bug
  cannot recur. (S)

---

## 9. Polish and open decisions

- [ ] Sweep for leftover `picsum.photos` and `example.org` URLs before launch
  (5 demo markers in `/public/projects` alone today). (S)
- [ ] Decision: report form field changes apply immediately or on a scheduled
  cutover (open since the RBAC/CMS spec §C). (decision)
- [ ] Decision: effective-dated role transitions (president change at RY end);
  currently a manual revoke and grant. (decision, deferred by spec)
- [ ] Decision: the "AI/innovation" SERIC requirement; chatbot ruled out, nothing
  chosen. (decision)
- [ ] Mobile app: out of scope now, but keep the OpenAPI document and cookie
  auth compatible (`export-openapi.ts` exists). (note)

---

## 10. Content and decisions needed from Rahul

Full detail is in `docs/content-needed-for-launch.md`. The items that gate code
work rather than just appearance:

- [ ] Lead club per subdomain (sets `subdomain.<key>.leadClubId` and grants
  project admin automatically).
- [ ] Wipe or keep each subdomain's demo data (camps, surgeries, teams, listings,
  delegations).
- [ ] Sponsor calculator ratios (`sponsor.ratios` setting) confirmed.
- [ ] Routing for new-club, sponsor and contact enquiries (who receives
  `enquiry-received`).
- [ ] District public email, phone, social links for the contact page and footer.
- [ ] Who moderates Career Bridge listings.

---

## Suggested order

1. Section 0 (all five items).
2. Section 1a and 1c (dispatch, templates, announcements). Everything else that
   "notifies" stays silent until this lands.
3. Section 2 and 5 (screens over existing APIs; fast wins, closes 15 placeholders).
3a. Section 2A phase 1 (event registration and check-in desk), once its
   implementation plan is written. Phase 2 follows after a real event.
4. Section 6 then 7 (migration, cutover), with section 8 running alongside.
5. Sections 3, 4 and 1b (effort/badges, DRR calendar, push). Spec marks
   gamification as the most deferrable.

---

## Follow-ups opened 2026-09-06 (from the section 5 build)

- [ ] **Frontend super-admin code path (spec 4.8.5 violation, pre-existing).**
  `rac3011-web/src/lib/permissions.ts:17` short-circuits `can()` to true when
  `roleKey === 'super_admin'`. Dates to `4e90966`, not introduced by the section 5 work, and the API
  still enforces so it is not exploitable. But it is exactly the frontend super-admin check the spec
  forbids, and section 5's screens are the highest-value ones it unlocks. (S)
- [ ] **Create-role inline validation messages are unreachable.** `AdminRolesPage.tsx`
  `CreateRoleModal` disables Submit using the same predicate `submit()` uses, and `submit()` is the
  only caller of `setKeyError`/`setNameError`, so the inline field errors never render. A super admin
  typing a 1-char key gets a dead button with no explanation. Invalid input still cannot be
  submitted. (S)
- [ ] **Audit log shows raw `actorId` UUIDs.** Enrich `GET /audit` with an actor name (or add a bulk
  user-lookup endpoint) so the audit viewer is readable. (S, api + web)
- [ ] **No `GET /users` search.** `/portal/admin/users` reaches users through their member record
  plus a pasted-id fallback, so a user with no member row is only reachable by id. (S, api)
