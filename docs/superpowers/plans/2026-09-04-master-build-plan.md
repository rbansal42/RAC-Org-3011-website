# RAC District 3011 Website — Master Build Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each phase plan task-by-task. This master plan defines architecture, schema, interfaces and phase order; each phase has its own detailed plan file (`2026-09-04-phase-NN-*.md`) with TDD steps.

**Goal:** Build the complete Rotaract District 3011 platform (public site, member/officer portal, admin, five project subdomains) as two greenfield repositories, with every feature in the master spec implemented to production quality. No time constraint; completeness and correctness over speed.

**Architecture:** `rac3011-api` (NestJS 11 + Prisma 6 + Postgres 18, layered controller→service→repository with transformers, Better Auth sessions, BullMQ workers) and `rac3011-web` (Vite + React 18 + TypeScript strict + Tailwind v4, single SPA that renders public site, portal and all five subdomains by hostname; no UI kit, components hand-built from the Claude Design mockups). The API is the only security boundary (RBAC guard on every mutation and scoped read); the web app uses the resolved permission set only for show/hide.

**Tech Stack:** TypeScript 5.x everywhere · NestJS 11 · Prisma 6 (pinned; v7 breaks `url` datasource) · Postgres 18 (`rac3011-postgres` on Oracle, WireGuard 10.44.44.2:5434) · Better Auth 1.x (email OTP + password + TOTP) via `@thallesp/nestjs-better-auth` · Zod 4 (shared DTO validation, `nestjs-zod`) · BullMQ + Redis 7 · Vitest (api unit + e2e via supertest, web unit) · Playwright (web e2e) · pino · Sentry · Vite 5 · React 18 · react-router 7 · TanStack Query 5 · Tailwind v4 (`@tailwindcss/vite`, CSS `@theme`) · lucide-react · Leaflet (map) · Docker → Dokploy on VPS (15.235.211.41), Cloudflare-proxied.

**Spec:**
- `docs/superpowers/specs/2026-09-04-website-master-spec.md` (entry point, sitemap, build order)
- `docs/superpowers/specs/2026-09-04-admin-portal-cms-rbac-design.md` (schema-level detail, sections A–W)
- Design mockups (authoritative for every screen, three breakpoints each): `design-export/v2/*.dc.html` — Public Pages 1–3 (25 screens), Portal 1–2 (15), Portal Admin 1–3 (19), Subdomains 1–2 (17), Design System (36 components, light + dark)
- Design decisions log: `design-export/chats/chat1.md`, and `design-export/Design Reconciliation.dc.html`

---

## Global Constraints

Copied from the specs and Rahul's standing preferences; every task in every phase plan inherits these.

1. **Two repos, both new, on `rbansal42` GitHub:** `rac3011-api`, `rac3011-web`. Local paths: `/Volumes/Code/rac3011-api`, `/Volumes/Code/rac3011-web`. The existing fork `rac-org-3011-website` is reference only; it keeps `staging.`/`testing.` alive until cutover.
2. **Layered API architecture (binding):** `controllers` (HTTP only) → `services` (business rules) → `repositories` (the only place Prisma is called) ; `transformers` map Prisma models ⇄ DTOs with no I/O ; `dto/` per module uses Zod schemas exported to the web via the shared OpenAPI. No Prisma import outside `*.repository.ts`. Cross-module access only through the other module's exported service, never its repository.
3. **RBAC is server-side on every route.** `@RequirePermission('resource:action')` + `ScopeGuard` resolves the caller's `user_roles` (union across roles) and checks scope (club/zone/project) against the target resource. Reads are filtered by scope in the repository query, never post-filtered in the controller.
4. **Every club reference is `clubId` FK → `clubs.id`. Never free-text club names.** Existing free-text columns (`user_profiles.club_name`, `monthly_reports.club_name/club_email`) are migrated to FKs in Phase 1.
5. **No server-owned object storage.** Every asset field is an external URL (Drive/Photos/etc.). Link health is checked on submit and by a nightly scan (Google Drive API when the URL is a Drive link, HEAD request otherwise); broken links notify the owner. Never base64 in Postgres.
6. **Notifications go through one `NotificationDispatchService`** (email via provider pool Resend→Mailgun→Gmail SMTP with per-day counters and failover; web push via VAPID). No module calls a provider SDK directly.
7. **Audit log from day one** for point rules/tiers, club facts, judged points, roles/permissions, settings, content publishes.
8. **Design fidelity:** implement the `.dc.html` mockups faithfully (layout, spacing, copy tone, states drawn: loading/empty/error/unreachable). Tokens live in `src/styles/tokens.css` as a Tailwind v4 `@theme`. Light and dark both required (dark: pink lifts `#D81B60→#F0407F`, filled buttons use dark ink, warm near-black neutrals `#131316/#17171B/#1B1B20/#2C2C33`, never grey). Montserrat. 44px minimum interactive height everywhere. No scroll-jacking, no `scroll-snap-stop: always`, no `height:100vh; overflow:hidden` on the root.
9. **No UI component library** (HeroUI, shadcn, MUI…). Hand-built primitives in `src/components/ui/` that mirror the Design System file.
10. **Accessibility / SEO / mobile-first are standards, not phases:** semantic HTML, keyboard reachable, alt text, contrast; per-route `<title>`/OG meta via a `useDocumentMeta` hook; `sitemap.xml` and `robots.txt` generated at build from the public route table; layouts written mobile-first.
11. **Testing:** TDD per task. API: Vitest unit for services (repositories mocked) + e2e with supertest against a real Postgres testcontainer (one shared container per run, `fileParallelism:false`, `resetTestDatabase()` truncates). Web: Vitest + Testing Library for components/hooks; Playwright smoke per phase against the dev server with the API in `E2E_SEED=1` mode.
12. **Migrations:** Prisma migrations authored with `prisma migrate diff` into monotonic-timestamp folders; must replay from scratch in CI. Expand/contract only; never drop a column in the same migration that adds its replacement.
13. **Code style:** no comments unless a non-obvious constraint; 2-space; named exports for components; files ≤ ~300 lines, split by responsibility. Zod schema is the single source for a DTO's runtime and static type.
14. **Commits:** small, conventional (`feat(scope): …`), no Co-Authored-By lines. Push to `main` only through PRs merged after CI passes; check `gh run list` after each merge before the next.
15. **Secrets** only in env / `~/.claude/secrets.md` / Obsidian Keychain, never in the repo. New secrets created during the build (AUTH_SECRET, VAPID keys, provider API keys, Google service account) are written to Keychain `RAC 3011 Website Deployment` immediately.
16. **Emails in dev/test never reach real members:** `MAIL_DRIVER=console` locally and in tests; staging uses a real driver but `MAIL_ALLOWLIST=rtrrahulbansal@gmail.com`.

---

## 1. Repository layouts

### 1.1 `rac3011-api`

```
rac3011-api/
  prisma/schema.prisma            single schema, models grouped by module with comments-free @@map snake_case names
  prisma/migrations/
  prisma/seed.ts                  system roles + permissions, 13 point categories, official point rules, settings defaults
  src/main.ts                     helmet, cors (credentials, WEB_ORIGINS list), zod validation pipe, pino, sentry
  src/app.module.ts
  src/common/                     decorators (RequirePermission, CurrentUser, Scope), guards (AuthGuard, PermissionGuard, ScopeGuard), filters, pagination dto, zod pipe
  src/prisma/                     PrismaService (+ testing reset helper)
  src/auth/                       better-auth config (email+password, emailOTP plugin, twoFactor/TOTP), session cookie Domain=.rotaract3011.org, /auth/*
  src/rbac/                       roles, permissions, user_roles, resolver (effective permission set + scopes), audit hook
  src/clubs/                      clubs CRUD, zones, board (club_board_members), slugs
  src/members/                    user_profiles → members: registration, approval queue, bulk import (email dedup), profile, skills/interests, QR id
  src/content/                    content_blocks + publish, link-health checks
  src/settings/                   key-value settings, subdomain activation/lead club, DRR availability
  src/reports/                    report_form_schema versions + builder, monthly_reports (schema_version), queries/flags, ad-hoc requests
  src/points/                     point_rules, tiers, club_facts, computation engine (monthly/yearly/once), judged points, rule trace, club own-trend
  src/effort/                     effort_log (admin) + member contributions (self-submitted, approved)
  src/showcase/                   project_submissions + project_clubs (lead/collaborator), approval/publish queue, public listing
  src/heritage/                   past_drrs
  src/leadership/                 district core team, dsc_roster
  src/achievements/  src/partners/  src/publications/  src/resources/ (documents, categories, guest kit, sister-club form)
  src/calendar/                   events (is_district_event), rsvps, checkins (QR), attendance % per club
  src/drr-calendar/               Google Calendar OAuth (service account on DRR calendar), slots, bookings, admin
  src/announcements/              segmented audiences (roles×zones×clubs), channels (portal/email/push), read receipts
  src/feedback/                   feedback (general or event-scoped), replies
  src/badges/                     badge definitions + member_badges, evaluated on write
  src/certificates/               PDF generation (pdfkit) for milestones; stored as generated-on-demand, not uploaded
  src/notifications/              NotificationDispatchService, email provider pool (resend/mailgun/gmail), push (web-push), outbox table + BullMQ worker
  src/analytics/                  page_views counter (server-incremented, per-year), /public/visits
  src/subdomains/mission3011/     camps, approvals, dashboard aggregates
  src/subdomains/drishti/         beneficiaries, surgeries pipeline
  src/subdomains/rcl/             teams, players, fixtures, results, standings
  src/subdomains/careerbridge/    listings, verification desk, posted-vs-filled
  src/subdomains/ride/            support_clubs (capacity), delegations, delegation_hosts (split hosting), gallery links
  src/public/                     read-only aggregated endpoints for public pages (no auth), cache headers
  src/link-health/                nightly scan job (Drive API / HEAD), broken-link notifications
  src/health/                     /health, /ready
  test/                           e2e per module, global-setup with testcontainers
  Dockerfile  docker-compose.yml (postgres 18 + redis for local)  .github/workflows/ci.yml
```

### 1.2 `rac3011-web`

```
rac3011-web/
  src/main.tsx                    createBrowserRouter from hostname-specific route tree
  src/app/host.ts                 resolveSurface(hostname) → 'main' | 'mission3011' | 'drishti' | 'rcl' | 'careerbridge' | 'ride' (dev override ?surface=)
  src/app/routes/                 main.routes.tsx, portal.routes.tsx, admin.routes.tsx, subdomains/*.routes.tsx
  src/app/providers.tsx           QueryClient, AuthProvider, ThemeProvider (light/dark), Toaster
  src/styles/tokens.css           @theme from Design System (light + dark via [data-theme=dark])
  src/styles/global.css
  src/components/ui/              Button, IconButton, Input, Textarea, Select, Checkbox, Radio, Switch, Badge, Chip, Card, Table, Tabs, Modal, Drawer, Toast, Tooltip, Skeleton, EmptyState, ErrorState, Avatar, ImageSlot (external URL + designed fallback), Pagination, Stepper, ProgressBar, RadialGauge, DatePicker, Combobox, TagInput, Breadcrumbs, Kbd, Divider, Alert
  src/components/layout/          PublicHeader, PublicFooter (visitor counter), PortalShell (dark bar + sidebar), AdminShell, SubdomainShell (accent per project)
  src/features/<domain>/          api.ts (typed client calls), hooks.ts (TanStack Query), components/, pages/  — one folder per API module
  src/lib/api-client.ts           fetch wrapper (credentials: 'include', API_ORIGIN, zod-parsed responses), generated types from OpenAPI (`openapi-typescript`)
  src/lib/permissions.ts          can(permission, scope?) from /me
  src/lib/meta.ts                 useDocumentMeta
  src/sw.ts                       service worker for web push
  scripts/generate-sitemap.ts     from public route table → public/sitemap.xml, robots.txt
  e2e/                            Playwright
  Dockerfile (nginx static, SPA fallback, cache headers)  .github/workflows/ci.yml
```

## 2. Data model (Prisma, snake_case tables)

Groupings below define the tables; per-phase plans carry the exact Prisma model code. Every `clubId` is `String @db.Text` FK → `clubs.id` (existing text ids). Timestamps `createdAt/updatedAt` on every table.

**Identity & RBAC:** `user` (better-auth) + `member_profiles` (1:1 user: fullName, email unique lower, phone, rotaryId, clubId FK, photoUrl, bio, skills String[], interests String[], membershipAnniversary, status pending|approved|suspended, qrToken unique, directoryOptIn, legacyProfileId) · `roles` (name unique, description, isSystem, scopeType none|club|zone|project) · `permissions` (key unique `resource:action`, description) · `role_permissions` · `user_roles` (userId, roleId, scopeType, scopeId, grantedBy, grantedAt; unique on all four) · `audit_log` (actorId, action, resourceType, resourceId, before Json, after Json, at).

**Clubs:** `clubs` (existing 75 rows; add slug unique, charterDate, isActive, meetingInfo, socialLinks Json) · `zones` (name = Prithvi|Agni|Vayu|Akash, seeded from distinct `clubs.zone`, then `clubs.zoneId` FK) · `club_board_members` (clubId, memberId?, name, position, bloodGroup, phone, email, ryYear) · `club_facts` (clubId unique per ryYear; typed columns: duesPaidOn, riCitationCompleted, paulHarrisFellows Int, dualMembers Int, mdioCommitteeMembers Int, sisterClubSignedOn, riMembershipCount Int, clubWebsiteUrl, socialHandlesComplete Bool, updatedBy).

**Content & settings:** `content_blocks` (pageKey, sectionKey, type text|richtext|image|link|list, value Json, status draft|published, publishedAt, updatedBy; unique pageKey+sectionKey) · `settings` (key unique, value Json, updatedBy) · `asset_links` (url, kind drive|photos|other, lastCheckedAt, status ok|broken|private, ownerUserId, resourceType, resourceId).

**Reporting & points:** `report_form_schemas` (version Int unique, status draft|active|retired, publishedAt) · `report_form_fields` (schemaId, section, fieldKey, label, type text|number|select|multiselect|link|date|boolean|clubs, options Json, required, order, helpText, pointSourceKey) · `monthly_reports` (existing; add clubId FK, month Date first-of-month, schemaVersion, status draft|submitted|queried|scored, submittedById, notesFreeText, queriedById, queryText, resolvedAt; unique clubId+month) · `report_requests` (ad-hoc: title, questions Json, audience Json, dueAt, createdBy) + `report_request_responses` · `point_categories` (13, seeded, order) · `point_rules` (categoryId, label, ruleType flat|per_unit|tiered|penalty, period monthly|yearly|once, sourceType report_field|club_fact|event_attendance|project_collaboration|ride_hosting|effort, sourceKey, numeratorKey?, denominatorKey?, points Decimal?, isActive, ryYear) · `point_rule_tiers` (ruleId, min, max?, points) · `club_point_entries` (clubId, ryYear, month?, ruleId?, kind computed|judged, points, reason?, traceJson, sourceType, sourceId, createdBy?; idempotency key `(clubId, ruleId, periodKey)` for computed) · `effort_log` (memberId?, personName, clubId FK, taskDescription, hours, date, loggedBy, kind admin|self, status pending|approved|rejected, approvedBy, pointsAwarded?, pointEntryId?).

**Showcase & public content:** `project_submissions` (existing; add slug, title, category (7 focus areas), summary, body, date, beneficiaries Int, photos String[] urls, submittedById, status draft|submitted|approved|published|rejected, editorNotes, publishedAt, consentConfirmed) · `project_clubs` (projectId, clubId, role lead|collaborator; unique) · `past_drrs` (name, slug, ryYear(s) String[], homeClubId?, photoUrl, bio, term order) · `district_team` (memberId?, name, designation, kind core|dsc, order, photoUrl, phone, email, bio) · `achievements` (type chartered_club|award|milestone, title, clubId?, date, certificateUrl, description) · `partners` (name, logoUrl, tier, website, permissionStatus pending|granted, order) · `publications` (title, type directory|newsletter, url, month, coverUrl) · `resources` (category documents|forms|logos|photos|guest_kit|templates, title, url, isLocked, requiredPermission?, description, order) · `sister_club_requests` (clubId, partnerClubName, partnerDistrict, country, contact, status, signedOn).

**Calendar, attendance, feedback, comms:** `events` (title, slug, startsAt, endsAt, location, isDistrictEvent, rsvpOpen, capacity?, coverUrl, description, createdBy) · `event_rsvps` (eventId, memberId, status going|maybe|not_going; unique) · `event_checkins` (eventId, memberId, checkedInAt, checkedInBy, method qr|manual|walk_in; unique eventId+memberId) · `drr_slots`/`drr_bookings` (clubId, requestedBy, purpose installation|club_event|meeting, startsAt, endsAt, status requested|held|confirmed|declined, googleEventId) · `announcements` (title, body, audience Json {roles[], zoneIds[], clubIds[], memberIds[]}, channels String[], sentAt, createdBy) · `announcement_reads` · `feedback` (submittedById?, clubId?, category, message, eventId?, status open|reviewed|closed, reply, reviewedBy, reviewedAt) · `notification_outbox` (channel email|push, to, subject, payload Json, status queued|sent|failed, provider, attempts, error) · `email_provider_usage` (provider, day Date, count) · `push_subscriptions` (userId, endpoint unique, keys Json) · `badges` + `member_badges` · `certificates` (memberId, kind, issuedAt, dataJson) · `page_views` (year Int, count BigInt) .

**Subdomains:** `m3011_camps` (clubId lead + `m3011_camp_clubs`, date, venue, unitsCollected, donorsRegistered, photos[], status submitted|approved|rejected, reviewedBy) · `drishti_beneficiaries` (clubId, name/age/contact minimal PII, eye, screenedOn, status screened|scheduled|operated|followup|closed) + `drishti_surgeries` (beneficiaryId, hospital, operatedOn, outcome) · `rcl_teams` (clubId, name, captainMemberId?, status registered|confirmed), `rcl_players`, `rcl_fixtures` (homeTeamId, awayTeamId, scheduledAt, venue, status), `rcl_results` (fixtureId, scores, winnerTeamId, points), standings computed · `cb_listings` (title, company, type job|internship|mentorship, location, mode, stipend, description, applyUrl, contactEmail, postedByName, postedByEmail, rotaryAffiliation, status pending|verified|filled|expired, verifiedBy, filledAt) · `ride_support_clubs` (clubId unique per ryYear, capacityDelegates, homestayAvailable, preferredMonths String[], contactMemberId) · `ride_delegations` (visitingDistrict, country, startsAt, endsAt, headcount, contact, status planned|confirmed|completed) · `ride_delegation_hosts` (delegationId, clubId, daysHosted, membersSent, assignedBy) · `ride_gallery_items` (year, url, kind photo|video, caption).

## 3. Cross-cutting interfaces (names later phases rely on)

- `PermissionKey` string union generated from `permissions` seed: `reports:submit|reports:review|reports:score|showcase:submit|showcase:publish|content:edit|content:publish|announcements:send|members:approve|members:import|roles:manage|point_rules:manage|club_facts:edit|effort:log|effort:approve|events:manage|events:checkin|feedback:review|settings:manage|drr_calendar:manage|subdomain:<key>:manage|directory:view|club:view_own|club:view_zone|club:view_all`.
- `Scope = { type: 'none'|'club'|'zone'|'project'; id?: string }` ; `MeResponse = { user, profile, roles: {role, scope}[], permissions: {key, scopes: Scope[]}[] }` at `GET /me`.
- `NotificationDispatchService.dispatch({ kind, recipients: {userId}[] | {email}[], subject, template, data, channels: ('email'|'push')[] })`.
- `PointsEngine.recompute({ clubId, ryYear, month?, trigger: 'report'|'club_fact'|'attendance'|'collaboration'|'ride'|'rule_change' })` — idempotent, writes `club_point_entries` (kind computed) with `traceJson` `{ruleId, label, inputs, tierMatched?, points}`.
- `AuditService.record({ actorId, action, resourceType, resourceId, before, after })`.
- Web: `api.<module>.<fn>()` typed via generated `openapi.d.ts`; `useMe()`, `can(key, scope?)`, `<Guard permission scope>`; `ImageSlot src fallback` ; `resolveSurface()`.

## 4. Phases

Each phase = one plan file, produces working, deployed software. Dependencies listed. Phases 6–9 and 11–13 can run in parallel worktrees once their dependencies are merged.

| # | Plan file | Scope | Depends on |
|---|-----------|-------|-----------|
| 00 | `phase-00-foundations` | Both repos scaffolded; CI; Docker; Dokploy apps `api.rotaract3011.org` + web (main + 5 subdomains); Prisma baseline importing existing 5 tables from `rac3011-postgres` (introspect → baseline migration); tokens.css + Design System `ui/` primitives (all 36, light+dark) + Storybook-less preview route `/__ui`; host resolver; api-client + OpenAPI typegen; health endpoints; testcontainers harness | — |
| 01 | `phase-01-auth-rbac-members-core` | Better Auth (password + email OTP + TOTP), `.rotaract3011.org` cookie, legacy `user_profiles` → `user`+`member_profiles` migration (password hash compatibility or forced reset), roles/permissions/user_roles + resolver + guards + audit_log; clubs/zones normalisation (zoneId, slug, FK migration of club_name columns); `/me`; portal login screen + shells (PortalShell/AdminShell) + Roles & Permissions admin screen | 00 |
| 02 | `phase-02-public-site` | All 25 public screens on real data: Home, Map (Leaflet, zone filter, states), Showcase + detail + club showcase page, Heritage + DRR profile, Leadership + club leadership, Initiatives (incl. unassigned state), Resources + documents, Publications, New Club, Sponsor, Achievements, Partners, Contact, Calendar (read), Privacy, Terms; `public/` API module; visitor counter; sitemap/meta; content_blocks read path | 00, 01 (clubs/zones) |
| 03 | `phase-03-cms-settings-content-editor` | content_blocks CRUD/publish, asset_links + link-health service (Drive API + HEAD, nightly BullMQ), settings (subdomain activation/lead club, DRR availability, thresholds), Content editor screen (7 areas), District settings screen, Editing Team role; dedicated CRUD for achievements/partners/publications/resources/past_drrs/district_team | 01, 02 |
| 04 | `phase-04-reporting` | report_form_schemas/fields + builder screen; New Report (schema-rendered, notes box), Review & Submit, Report History, Queried report flow, Admin Clubs table, ad-hoc requests + responses; officer-side AI assist (Anthropic SDK, officer-only, suggestions never persisted unreviewed) | 01 |
| 05 | `phase-05-points-engine` | point_categories/rules/tiers seeded from the official document, club_facts, PointsEngine (monthly/yearly/once idempotency, ratio tiers), judged points with mandatory reason + audit, rule trace; screens: Score a month, Point rules, Club facts, club own-trend with per-category breakdown, officer dashboard | 04 |
| 06 | `phase-06-members-portal` | Self-registration + pending, approval queue, bulk import (CSV, email dedup), profile (skills/interests/photo link), QR member id, member dashboard (club member view), My club, Member card/milestones, Profile + Settings screens (theme, 2FA, push permission moment), directory (opt-in), privacy gate | 01, 03 (privacy page) |
| 07 | `phase-07-showcase-workflow` | Member showcase submission (consent tick, collaborators as club FKs), approval queue edit-then-publish, project_clubs → collaboration points hook, public showcase already reading published rows | 05, 06 |
| 08 | `phase-08-events-attendance-feedback` | events CRUD, public calendar with RSVP, QR check-in screen (camera + manual + walk-in), attendance % → PointsEngine, Club event tracker, feedback channel (general + event-scoped) with reply | 05, 06 |
| 09 | `phase-09-notifications-announcements` | NotificationDispatchService, email provider pool + daily counters + failover, web push (VAPID, sw.ts, subscription), outbox worker, templates; announcements with audience builder (roles×zones×clubs) + channels + reads; wire triggers from phases 4–8 | 01 (used by 04–08 via a stub port until this lands) |
| 10 | `phase-10-effort-badges-certificates` | effort_log admin screen + discretionary points, member self-contributions + approval, badges evaluated on write, certificates (pdfkit) | 05, 06, 08 |
| 11 | `phase-11-drr-calendar` | Google Calendar integration (service account on DRR calendar), slots from availability settings, public DRR calendar, booking form + confirmation, admin (hold/confirm/decline), notifications | 03, 09 |
| 12 | `phase-12-subdomains-health` | Mission 3011 (dashboard vessel, log a camp, approvals) and Drishti (dashboard, log a patient, pipeline) with scoped project admin roles; SubdomainShell accents | 01, 05 (flagship points) , 09 |
| 13 | `phase-13-subdomains-rcl-careerbridge-ride` | RCL (registration, fixtures & results, standings), Career Bridge (browse, listing, post, verification desk, posted-vs-filled), RIDE (support club registration w/ capacity, incoming delegations, gallery, host assignment split across clubs → points) | 01, 05, 09 |
| 14 | `phase-14-cutover-hardening` | Supabase retirement, data reconciliation, DNS cutover of `rotaract3011.org` from Vercel, backups (pg_dump → OneDrive 15-min pattern), rate limiting, Sentry, Playwright full regression, Lighthouse/a11y pass, load test of points recompute, runbook | all |

## 5. Deployment topology

- Dokploy project `rac3011` on VPS: `rac3011-api` (GHCR image, env from Keychain, `DATABASE_URL` → `postgresql://rac3011:***@10.44.44.2:5434/rac3011`, Redis container `rac3011-redis`), `rac3011-worker` (same image, `WORKER=1`), `rac3011-web` (static nginx image). Domains: `api.rotaract3011.org`, `staging.rotaract3011.org` (web, until cutover), then `rotaract3011.org`, `www`, `mission3011`, `drishti`, `rcl`, `careerbridge`, `ride` all → web app. Cloudflare proxied, origin cert already at `/etc/ssl/cloudflare/rotaract3011.pem`.
- Cookie: `Domain=.rotaract3011.org; Secure; HttpOnly; SameSite=Lax`. CORS allowlist = every web hostname. Local dev: `*.localhost` hostnames (`mission3011.localhost:5173`) or `?surface=`.
- Google: one GCP project, service account with Drive read (link health) and Calendar (DRR calendar shared to it); keys in Keychain.

## 6. Verification standard per phase

Phase is done when: all its tasks' tests pass in CI on both repos; migrations replay from scratch; Playwright smoke for its screens passes at 390/768/1440; deployed to staging and clicked through against the mockups; spec sections it covers ticked in `docs/superpowers/plans/progress.md`.
