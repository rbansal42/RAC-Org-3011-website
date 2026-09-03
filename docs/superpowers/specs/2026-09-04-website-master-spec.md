# RAC District 3011 Website — Master Spec

Status: compiled 2026-09-04 from planning-call notes, the district bidding
document, the RID 3011 Points System document, and iterative design sessions.
Supersedes/consolidates `features.md`, `docs/data-requirements.md`, and
`docs/superpowers/specs/2026-09-04-admin-portal-cms-rbac-design.md` into one
reference — those files stay as-is for their original detail, this is the
single entry point.

---

## 1. Vision

Rebuild the district's website as the single stop for anything Rotaract
District 3011-related — not a static brochure, but a living system updated
weekly, with district-wide dashboards, club self-service tooling, and a
member-facing portal open to everyone across all 75 clubs, not just officers.
Explicit non-goal: this is not being built to win an award — it's being built
because the district needs a real operating system, and the SERIC/CLS
presentation on the 6th is just the first checkpoint, not the finish line.

## 2. Current infrastructure state

- **Live today:** `staging.rotaract3011.org` and `testing.rotaract3011.org`,
  Dokploy-deployed on the VPS (15.235.211.41), building from
  `rbansal42/RAC-Org-3011-website` (fork, branch `deploy-oracle-vps`), Vite +
  React SPA, calling Supabase directly from the browser.
- **Production** (`rotaract3011.org` itself) is still live on Vercel,
  untouched — no cutover has happened.
- **Datastore decision (confirmed 2026-09-04):** move off Supabase. A new
  self-managed Postgres 18 instance (`rac3011-postgres`) is already
  provisioned on the Oracle Cloud instance, reachable from the VPS over the
  existing WireGuard tunnel, and already holds a verified 1:1 copy of the
  Supabase data (5 tables, row counts matched exactly at migration time).
  The planned NestJS API targets this Postgres instance, not Supabase.
  Supabase stays live as a bridge for the current frontend until the new API
  ships — nothing breaks mid-build.
- Credentials for both databases are in `~/.claude/secrets.md`.

## 3. Architecture

- **Two repos**, matching the Healing Pouch / RotaractOS precedent (not a
  single monorepo): a NestJS + TypeScript + Prisma API, and a Vite + React +
  TypeScript + Tailwind web frontend. Reason: a mobile app is planned for the
  future, so the frontend cannot be the only client of the data layer.
- **Layered backend architecture**, matching the pattern used in
  `house-of-urve` and `racddl`: `app`/routes (thin) → `controllers` → `services`
  → `repositories` (data access), with `transformers` doing doc⇄DTO mapping
  (no I/O) and shared `types`/`lib`. No business logic or DB access in
  routes/components.
- **RBAC is the actual security boundary**, enforced server-side on every
  mutation. The frontend only uses permission data for UX (show/hide), never
  as enforcement. See §6.
- **Migration style:** incremental, file-by-file — not a big-bang rewrite.
  Convert `.jsx` → `.tsx`, inline styles → Tailwind, page by page.
- **Styling:** Tailwind, matching the design-system-refinement approach in
  `docs/claude-design-prompt.md` — snappy over decorative, no scroll-jacking,
  reuse existing tokens rather than inventing new ones.

## 4. Sitemap

### Main site — `rotaract3011.org`

```
/                              — Home (hero, hero carousel, showcase teaser, CTAs)
/map                           — Interactive district map (club pins, zone filter)
/showcase                      — Rotaract Showcase (club project gallery)
└── /showcase/[project-id]
/heritage                      — Past DRRs
└── /heritage/[drr-slug]
/leadership                    — Core team, DSC roster, club leadership directory
└── /leadership/clubs/[club-slug]
/initiatives                   — Aggregated dashboards, links to project subdomains
/resources                     — Resource Hub
├── /resources/documents       — Point-system doc, ISD guidelines, sister-club template
├── /resources/sister-club     — Sister Club Agreement form
├── /resources/logos
├── /resources/photos          — Google Photos album links
├── /resources/guest-kit       — Bio+photo bundle, sources from /leadership
└── /resources/forms
/publications                  — District directory (PDF), newsletters
/get-involved
├── /get-involved/new-club
└── /get-involved/sponsor
/achievements                  — Newly chartered clubs
/partners
/contact
/calendar                      — District Calendar (events + downloadable year calendar)
/drr-calendar                  — DRR's Calendar (Google Calendar-backed booking)
├── /drr-calendar/book/[slot-id]
└── /drr-calendar/admin

/portal/register                — Member self-registration
/portal/pending                 — Awaiting officer approval
/portal/dashboard               — Role-aware landing
/portal/profile                 — Photo, bio, skills, interests, anniversary
/portal/my-club                 — Read-only club roster/projects/reports/announcements
/portal/showcase/new            — Submit a project (member or officer)
/portal/contributions
├── /portal/contributions/new
└── /portal/contributions/mine
/portal/certificates
/portal/badges
/portal/directory               — District-wide member search
/portal/reports
├── /portal/reports/new
└── /portal/reports/history
/portal/announcements
/portal/admin
├── /portal/admin/clubs         — Report review + point assignment
├── /portal/admin/showcase      — Approve/publish queue
├── /portal/admin/users         — Bulk import, approve pending registrations
├── /portal/admin/effort-log    — Log + approve contribution entries, assign points
├── /portal/admin/content       — CMS: edit content_blocks
├── /portal/admin/roles         — RBAC: manage roles/permissions
├── /portal/admin/report-form   — Form-builder: report_form_schema
├── /portal/admin/point-rules   — Configure objective point rules
└── /portal/admin/settings      — Site-wide settings
```

### Project subdomains

```
mission3011.rotaract3011.org     — Mission 3011 (3,011 blood units target)
├── /camps
├── /dashboard
└── /admin

drishti.rotaract3011.org         — Project Drishti (100 cataract surgeries)
├── /beneficiaries
├── /surgeries
└── /dashboard

rcl.rotaract3011.org             — Rotaract Cricket League
├── /register
├── /fixtures
├── /standings
└── /admin

careerbridge.rotaract3011.org    — Career Bridge (jobs/internships/mentorship)
├── /post
├── /opportunities
├── /[listing-id]
└── /admin

ride.rotaract3011.org            — RIDE (Rotaract Inter District Exchange)
├── /support-club                — District-wide Support Club registration
├── /incoming                    — Incoming delegations, host club assigned per-delegation
├── /gallery                     — Past 2 RIDEs' media
└── /admin
```

## 5. Data model summary

Existing tables (migrated from Supabase, verified row counts): `clubs` (75),
`user_profiles` (145), `monthly_reports` (0), `project_submissions` (0),
`announcements` (0). Full breakdown of what's covered vs. needed per sitemap
section is in `docs/data-requirements.md` — key asks outstanding:

- **From Sarthak:** July-August project submissions (photos+summaries) for
  Showcase; past-DRR list for Heritage; DSC roster + club BOD dump for
  Leadership; newly chartered clubs list for Achievements.
- **From Shefali:** point-system doc (now in hand, see §6), ISD guidelines,
  sister-club template for Resources; district year calendar as structured
  data for Calendar.
- **Not blocked on the team:** partner logos (Archit), DRR Calendar OAuth
  (infra), the 5 project-subdomain schemas (Mission 3011, Drishti, RCL,
  Career Bridge, RIDE — all start empty, populated by lead clubs after CLS
  bidding concludes).

New tables required beyond what's migrated: `roles`, `permissions`,
`role_permissions`, `user_roles`, `content_blocks`, `report_form_schema`,
`point_rules`, `point_rule_tiers`, `club_facts`, `settings`, `effort_log`,
`badges`, `member_badges`, plus dedicated tables for Heritage/DRRs, DSC
roster, club BOD, Achievements, Partners, Calendar events, and one
operational table per project subdomain (camps, beneficiaries/surgeries,
teams/fixtures, job postings, RIDE delegations/support-clubs).

## 6. RBAC, CMS, and configuration — full detail

This section was previously its own spec
(`docs/superpowers/specs/2026-09-04-admin-portal-cms-rbac-design.md`, sections
A-K) and is summarized here; **that file remains the authoritative detail**
for schema fields and reasoning.

### A. RBAC — multi-role, scoped

`user_roles` (`user_id`, `role_id`, `scope_type`, `scope_id`) — **a user can
hold multiple roles simultaneously** (e.g. Member of their own club +
President of that club + DSC/Admin). Effective permissions are the union of
every role held. Scoped roles (President scoped to a club, project-subdomain
Admin scoped to that project) only grant permissions within scope; global
roles (Super Admin, Member) are unscoped. Seed roles: Member, President,
Secretary, DSC/Admin, Super Admin — Super Admin can create new roles via UI.
**Backend enforces every mutation server-side; frontend only uses
permissions for conditional rendering, never as the security boundary.**

### B. CMS — content blocks, not a page builder

`content_blocks` (`page_key`, `section_key`, `type`, `value` jsonb) for
free-form copy (hero text, intros, footer). List-like data (Achievements,
Partners, Calendar events, Resources, Heritage/DRRs) gets dedicated tables
and CRUD screens instead — no layout flexibility, only content edits without
a deploy. Images via object storage, never base64-in-Postgres.

### C. Dynamic reporting form

`report_form_schema` (versioned, ordered fields) drives the monthly report
form. `monthly_reports.sections_json` (already migrated) stores submissions,
tagged with `schema_version` so form changes never reshape past data.
Admin gets a form-builder UI. **Open question:** immediate vs. scheduled
cutover for form changes — deferred.

### D. Point system — objective (auto) + subjective (manual)

Matches the actual **RID 3011 Points System RY 2026-27** document — 13
categories (Community Services, Vocational Services/Professional
Development, International Services, Club Services, Flagship Projects, Club
& District, Reporting to District, DRR Official Visit, Membership Growth &
Retention, Rotary International, Public Image, District Dues, MDIOs
Presence). `point_rules` (flat/per_unit/tiered/penalty rule types, sourced
from either a report field or a `club_facts` value) auto-compute the moment
a report is submitted or a fact is updated — no manual step for anything the
official document covers. `club_facts` is a typed-columns table (not jsonb)
for the ~10-15 known district-tracked facts (dues-paid date, RI Citation,
Paul Harris Fellow count, etc.). Subjective points stay DSC/admin-assigned
by judgment for things the document doesn't formulaically cover. **A club
sees only its own point trend, never other clubs'** — deliberate, avoids
inter-club award disputes.

### E. Site-wide settings

Single `settings` key-value table: DRR calendar availability rules, which
project subdomains are active + current lead club, announcement
audience-targeting options.

### F. Effort tracker — internal only

`effort_log` for DRR-initiated ad-hoc contribution tracking (informal help
outside formal projects). Admin-only screen, **not public**. Points are
entirely discretionary (DRR's judgment, same mechanism as subjective project
scoring). Highlighting a specific entry publicly happens manually via a CMS
content-block, not a standing public list.

### G. RIDE subdomain

`ride.rotaract3011.org` — Support Club registration is district-wide, not
per-delegation; host clubs get assigned per incoming delegation from that
pool. Points auto-compute via `point_rules`/`club_facts` (hosting 40/day,
visiting 30/day, sending member 30/member, +50 for both — per the points
document). **Sister Club form is explicitly separate**, lives at
`/resources/sister-club` on the main site, not on this subdomain.

### H. Member accounts — portal opened to all members

Both self-registration (pending officer approval) and bulk import by
officers are supported, club's choice. Profile includes photo, bio,
**skills/interests** (directly a scored category: 50%+ adoption = 60 pts) and
membership anniversary. Digital QR member ID for event check-in.

### I. Personal member dashboard

Own contribution log (member-submitted, officer-approved), auto-generated
certificates for milestones, read-only view of own club, personalized
announcements. **Showcase submission is open to any member** (not just
officers) — club avenue Directors should self-report the projects they
actually ran, rather than routing through President/Secretary as a
bottleneck. Publishing still requires officer/DSC approval — this changes
who can *submit*, not who can *publish*.

### J. District member directory

Searchable across all 75 clubs by skill/interest/club/zone. Members see only
public profile fields of others (name, club, skills, photo) — never contact
info beyond what's opted in, never scoring data.

### K. Individual gamification

Personal badges/milestones (attendance streaks, service years, first
project) — visible only to the member and their own club's officers,
deliberately **not** a cross-club leaderboard, for the same reason club-level
points aren't shown across clubs. Built entirely from data already collected
elsewhere (attendance, contributions, membership anniversary) — no new
tracking infrastructure.

## 7. Design direction

Full brief in `docs/claude-design-prompt.md`. Summary: this is a refinement
pass across the entire sitemap, not a redesign — same visual identity
throughout (~30 pages/flows including the 5 subdomains). The core problem is
that the site *feels* sluggish (scroll-jacked hero carousel, heavy
JS-animated interactions), not that it looks wrong. Every dashboard
(Mission 3011's progress vessel, Drishti's pipeline, RCL's standings) should
feel alive without being heavy — CSS-driven, not chart-library-driven unless
the data genuinely needs it.

## 8. Build order

1. RBAC (§6.A) — foundational
2. CMS (§6.B) + Settings (§6.E) — parallel, once RBAC exists
3. Report schema (§6.C) — before point rules
4. Point rules (§6.D) — depends on C; `club_facts` half independent
5. Effort tracker (§6.F) + RIDE (§6.G) — independent of each other
6. Member accounts (§6.H) — depends on RBAC's multi-role model; build early,
   since I/J/K all depend on it
7. Personal dashboard (§6.I) — depends on H
8. Directory (§6.J) — depends on H
9. Gamification (§6.K) — depends on H, I; most deferrable if timeline pressure hits
10. The 5 project-subdomain operational tools (Mission 3011, Drishti, RCL,
    Career Bridge, RIDE) — schemas can be designed now, populated once CLS
    bidding assigns lead clubs

## 9. Explicit non-goals

- Visual/drag-drop page building (content_blocks only)
- Cross-club or cross-member public leaderboards (club-level and
  individual-level both rejected, same reasoning)
- Automated/algorithmic *subjective* scoring — quality judgments stay manual
- Raw LLM chatbot for the "AI/innovation" SERIC requirement — ruled out as
  unreliable/costly for a free-tier build; concept still undecided
- A full org-tree RBAC with ZRR-level scoping — vision item, not in this
  build (the multi-role/scoped model in §6.A can accommodate it later
  without a rearchitecture, but it isn't being built now)

## 10. Source documents

- `features.md` — original feature extraction from the planning call
- `docs/data-requirements.md` — data gap analysis, team asks
- `docs/claude-design-prompt.md` — full design-refinement brief
- `docs/superpowers/specs/2026-09-04-admin-portal-cms-rbac-design.md` —
  detailed RBAC/CMS/point-system spec (sections A-K), authoritative for
  schema-level detail
- District bidding document (Mission 3011, Project Drishti, RCL, Career
  Bridge) — PDF, shared 2026-09-03
- RID 3011 Points System RY 2026-27 — PDF, shared 2026-09-04
