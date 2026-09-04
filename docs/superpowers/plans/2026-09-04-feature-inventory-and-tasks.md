# RAC District 3011 Platform — Feature Inventory & Task List

Companion to `docs/superpowers/specs/2026-09-04-implementation-spec.md` (the spec is
authoritative for schema/routes/algorithms; this document is the feature-by-role
inventory and the resulting task list, per Rahul's `/goal`: list features per
module/role first, turn into tasks, then build — deeply, nothing stubbed.

Repos: `round-robin-solutions/rac3011-api`, `round-robin-solutions/rac3011-web`.
Deploy: Oracle Dokploy, Blacksmith ARM64-only CI, live at `testing.rotaract3011.org`
(web) / `api.rotaract3011.org` (API).

## 1. Roles / perspectives considered

- **Anonymous visitor** — public site only, no login.
- **Member** — any approved club member (the base authenticated role).
- **President / Secretary** — club-scoped officer, superset of Member.
- **ZRR** — zone-scoped, read-heavy oversight + showcase publish.
- **DSC / Admin** — district-wide, the primary back-office user.
- **Super Admin** — DSC + role/permission management.
- **Editing Team** — unscoped, publish-only, no data access.
- **Project Admin** (×5: mission3011/drishti/rcl/careerbridge/ride) — project-scoped.
- **DRR** — functionally Super Admin + the DRR calendar's subject.

## 2. Features per surface/module, by role

### Public site (anonymous)
Home (hero, live counter, flagship carousel, showcase teaser) · club map with
zone filter and contact deep-links · showcase gallery + detail + per-club page ·
heritage (past DRRs) + DRR profile · leadership (core/DSC/club boards) ·
initiatives status per project (incl. unassigned/unreachable states) · resource
hub (documents/forms/logos/photos/guest-kit/templates, locked rows visible) ·
publications · new-club and sponsor enquiry forms · achievements · partners ·
contact · district calendar (read + RSVP once logged in) · DRR calendar
(availability, booking, confirmation) · privacy policy / terms · sitemap/SEO/a11y.

### Portal — Member
Register, pending state, profile (photo/bio/skills/interests/anniversary),
2FA settings (TOTP or email OTP, trusted devices), theme, QR member card,
my-club read view, submit a showcase project (with consent), my contribution
log (submit + see approval), my certificates, my badges, district directory
(opt-in, gated on privacy acceptance), personalised announcements feed,
feedback (general or event-scoped), event RSVP + QR check-in.

### Portal — President / Secretary
Everything Member has, plus: submit/query-reply monthly report, report
history, approve/reject/suspend own-club members, bulk import roster, edit
club board, log club (non-district) events, approve/award own-club member
contributions, send announcements scoped to own club, view own club's point
trend + category breakdown, request response (ad-hoc district asks).

### Portal — ZRR
Read reports/points/members across their zone, publish showcase submissions
from their zone, send zone-scoped announcements, zone dashboard (filed %,
clubs behind threshold).

### Portal — DSC / Admin / Super Admin
Score a month (computed trace + judged points + reason), point rules editor
(13 categories, 4 rule types, 3 periods, tiers), club facts editor, report
form builder (versioned, publish cutover), ad-hoc requests, content editor
(7 CMS areas, link-health status), roles & permissions editor, district
settings (subdomain activation + lead club, DRR availability, thresholds),
member approvals + bulk import (district-wide), member directory, effort log
(discretionary points), district event check-in (QR/manual/walk-in),
announcement audience builder, feedback review (open/reviewed/closed + reply),
showcase approval queue (edit-then-publish), public-content CRUD
(achievements/partners/publications/resources/past-DRRs/district-team), audit
log, DRR calendar admin (confirm/decline/block). Super Admin only: role
creation/permission grants.

### Editing Team
Content editor + publish only — no reports, points, members, or roles access.

### Subdomains (public + project-admin, ×5)
**Mission 3011**: dashboard (progress vessel vs 3,011-unit target), log a camp
(any officer), approvals desk. **Drishti**: dashboard (100-surgery target),
log a patient, pipeline board (screened→closed), encrypted PII. **RCL**: team
registration, fixtures & results, standings. **Career Bridge**: public
posting (no login, email-verified), browse/filter, verification desk,
posted-vs-filled. **RIDE**: support-club registration (capacity), incoming
delegations, gallery, host assignment split across clubs (points-integrated).

### Cross-cutting
RBAC (scoped multi-role, deny-by-default, audited) · storage (UploadThing
public tiers + R2 private, grant-based, link-health) · notifications (email
pool Oracle→Resend→Mailgun→Gmail, web push, outbox+worker, template
registry) · badges/certificates (evaluated on write, PDF issuance) · visitor
counter · SEO/sitemap/a11y throughout.

## 3. Task list = spec §13 build order, status-tracked

Legend: ✅ done and verified · 🔶 partially done · ⬜ not started.

- ✅ **Step 0** — scaffolds, DB baseline, all 36+ UI primitives, tokens, `/__ui`, CI, Docker.
- ✅ **Step 1** — Better Auth (password+email OTP+TOTP), RBAC resolver/guards/boot-audit, audit log, `/me`, clubs+board+zones, storage module (UploadThing/R2/stub), login+shells+route placeholders for every screen.
- 🔶 **Infra/deploy** — Oracle Dokploy live, Blacksmith ARM64 CI, `round-robin-solutions` org, `testing.rotaract3011.org` — in progress this session.
- ⬜ **Step 2** — public API module + all 25 public screens on real data.
- ⬜ **Step 3** — CMS/settings/content editor/link-health + public-content CRUD.
- ⬜ **Step 4** — report schema builder + reporting flow (submit/query/history/overview/assist).
- ⬜ **Step 5** — points engine (rules/tiers/facts/computed+judged/trace/dashboards).
- ⬜ **Step 6** — members portal (register/approve/import/profile/QR/directory/privacy gate).
- ⬜ **Step 7** — showcase workflow + collaboration point adapter.
- ⬜ **Step 8** — events/RSVP/check-in/attendance adapter/feedback.
- 🔶 **Step 9** — notifications skeleton done (pool+templates unit-tested); outbox worker, push, announcements+audience builder not wired.
- ⬜ **Step 10** — effort log/contributions/badges/certificates.
- ⬜ **Step 11** — DRR calendar (Google integration/booking/admin).
- ⬜ **Step 12** — Mission 3011 + Drishti.
- ⬜ **Step 13** — RCL + Career Bridge + RIDE.
- ⬜ **Step 14** — cutover, hardening, full regression, runbook.

Legacy migration completeness (flagged incomplete by the step-1 build, must
close before step 14): TOTP secret carry-over, non-bcrypt password reset
email, and the full §3.4 reports/projects/announcements legacy migration
(the last one is owned by steps 4/7/9 respectively, not step 1).

Next dispatched: Step 2 (public site) and Step 4 (reporting) in parallel —
both depend only on the completed Step 1.
