# Admin Portal: RBAC + CMS + Dynamic Forms + Point System — Design

Status: approved by Rahul, 2026-09-04. Ready for implementation planning.

## Context

The reporting portal (`/portal/*`) needs to become a full management surface,
not just report submission — the district team wants to edit page content, manage
roles/permissions, evolve the monthly report form, and configure the point
system without code deploys. Everything is role-based: frontend smartly
shows/hides based on the current user's permissions, but the **backend is the
only real enforcement boundary** — every mutation is guarded server-side
regardless of what the frontend renders.

This spec covers five subsystems, each approved individually during
brainstorming. Build order matters: A (RBAC) underlies everything; C (report
schema) must exist before D (point rules) can reference report fields.

**Datastore decision (confirmed 2026-09-04):** the NestJS API this spec
implies targets the new self-managed Postgres 18 instance on Oracle
(`rac3011-postgres`, already provisioned and already holds the migrated
Supabase data — see `~/.claude/secrets.md`), not Supabase. This follows the
planning call's explicit direction to move off Supabase (cost at scale,
schema-normalization concerns). Supabase is retired once this API ships —
until then, the live `staging`/`testing` frontends keep calling Supabase
directly as a bridge, so nothing breaks mid-build.

---

## A. RBAC model

Replace the current `user_profiles.role` fixed check-constraint (4 hardcoded
values: officer/president/secretary/dac_member) with a real role/permission
system:

- `roles` — `id`, `name`, `description`, `is_system` (system roles can't be
  deleted, e.g. Super Admin)
- `permissions` — `id`, `resource`, `action` (e.g. `reports:approve`,
  `showcase:publish`, `content:edit`, `announcements:send`,
  `users:manage`, `roles:manage`)
- `role_permissions` — join table
- **`user_roles`** — `user_id`, `role_id`, `scope_type`
  (`null | club | zone | project`), `scope_id` (nullable — a `club_id`,
  `zone` value, or a project subdomain key). **Revised 2026-09-04: a user
  can hold multiple roles simultaneously** (e.g. Member of their own club +
  President of that same club + DSC/Admin), so this replaces the
  originally-planned single `user_profiles.role_id` column entirely. A
  user's effective permission set is the **union** across every role they
  hold. Scoped roles (President scoped to one club, ZRR scoped to one zone,
  a project subdomain's Admin scoped to that project) only grant their
  permissions within that scope — global roles (Super Admin, Member) have
  `scope_type: null`. Project-subdomain admin (Section G and the other four
  subdomains) is just another scoped role under this same model, not a
  separate auth system.

**Org-tree hierarchy (included 2026-09-04 — previously listed as a
non-goal, now in scope):** the full hierarchy discussed on the planning
call — Super Admin (DRR) → Deputy DRR / DSC roles → ZRR (zone-scoped) →
President/Secretary (club-scoped) — is built on the same `scope_type`/
`scope_id` mechanism, not a separate system:
- `zone` becomes a real `scope_type` value, matching `clubs.zone` (already
  exists — 75 clubs are already tagged with a zone from the Supabase
  migration)
- A ZRR role holder (`scope_type: zone`, `scope_id: <zone>`) sees/manages
  only clubs within their assigned zone — reports, showcase submissions,
  point data scoped to that zone
- DSC/Deputy DRR roles are unscoped (`scope_type: null`) — full
  district-wide visibility, same as Super Admin but without role/permission
  management rights unless explicitly granted
- **Visibility still nests the same way permissions do**: a club-scoped
  President sees only their club; a zone-scoped ZRR sees every club in
  their zone; an unscoped DSC/Super Admin sees everything. This is a
  natural extension of the existing scope model, not new infrastructure —
  what changes is that `zone` joins `club`/`project` as a valid
  `scope_type`, and zone-level roles get seeded.

Seed system roles: Member, President, Secretary, ZRR, DSC/Admin, Super
Admin — but Super Admin can create new roles and edit permission grants
through the UI. This is what makes it configurable rather than another
hardcoded set.

**Enforcement:**
- Every API mutation endpoint has a guard/decorator checking the caller's
  role has the required permission **and** that the target resource falls
  within the caller's scope (club/zone/project match, or the caller holds
  an unscoped role). Non-negotiable — this is the actual security boundary.
- Frontend fetches the current user's resolved permission set (including
  scope) once at login, uses it to conditionally render nav items, buttons,
  form fields, and to pre-filter list views (e.g. a ZRR's dashboard only
  requests their zone's data). Pure UX, never trusted as a boundary.

---

## B. CMS content model

Structured content blocks, **not** a drag-drop page builder — no layout
flexibility, only "edit existing content without a deploy."

- `content_blocks` — `page_key`, `section_key`, `type`
  (text/richtext/image/link/list), `value` (jsonb), `updated_by`, `updated_at`.
  Used for free-form page copy: hero text, section intros, footer text.
- List-like entities that are genuinely data get their own proper tables with
  dedicated admin CRUD screens, **not** `content_blocks` rows: Achievements,
  Partners, Calendar events, Resource documents, Heritage/DRR profiles (per
  the sitemap and `docs/data-requirements.md`).
- **Asset storage decision (revised 2026-09-04): no server-owned object
  storage.** Public assets (member photos, showcase images, RIDE gallery,
  guest-kit bios, charter certificates) are **not uploaded to a bucket we
  manage** — every asset field stores an external URL (Google Drive/Photos
  link, or wherever the source already lives) and our infrastructure only
  **caches** it (CDN/edge cache in front of the external URL, e.g. via
  Cloudflare), never owns the persistent copy. This removes the need for
  bucket provisioning, access-key management, and storage-cost planning
  entirely — but means upload UX is "paste a link," not a file picker, and
  the site's uptime for images depends on the external host staying up.
  Never base64-in-Postgres regardless.

---

## C. Dynamic reporting form

The monthly report form's structure lives in a `report_form_schema` table —
versioned, ordered, editable without a deploy:

- `report_form_schema` — `id`, `schema_version`, `section`, `field_key`,
  `label`, `type` (text/number/select/multiselect/file), `options` (jsonb),
  `required`, `order`, `is_active`
- `monthly_reports.sections_json` (already exists from the Supabase
  migration) stays the submission storage, but each row also records
  `schema_version` — so a form change mid-year never reshapes or invalidates
  past submissions.
- Admin gets a form-builder screen: add/remove/reorder fields.

**Open question, not yet resolved:** whether field changes apply immediately
or need a scheduled "publish" cutover. Defer until closer to build time.

---

## D. Point-system configuration

Two-part system, matching the actual RID 3011 Points System RY 2026-27
document (13 categories: Community Services, Vocational Services/Professional
Development, International Services, Club Services, Flagship Projects, Club &
District, Reporting to District, DRR Official Visit, Membership Growth &
Retention, Rotary International, Public Image, District Dues, MDIOs Presence).

### Objective (auto-computed)

`point_rules` — one row per scoring rule from the official document:
- `id`, `category` (one of the 13 above), `label`, `rule_type`
  (`flat | per_unit | tiered | penalty`)
- **`period`** (added 2026-09-04 — was a missing dimension): `monthly |
  yearly | once`. This is required, not optional — the official document
  mixes all three without saying so explicitly:
  - `monthly` — resets each reporting month (e.g. "at most/more than 4
    workshops in a month," attendance % brackets computed per month)
  - `yearly` — cumulative across the Rotary Year, never resets mid-year
    (e.g. membership retention %, net membership growth)
  - `once` — fires at most once per club for the whole year, idempotent
    (e.g. "establishment of a vocational centre" = 100 pts, one-time flags)
  - Computation must respect this: a `monthly` rule sums per report period
    and a club's total is the sum across all months; a `once` rule checks
    "has this already been awarded to this club this year" before applying
    again, regardless of how many times the triggering fact/field is
    updated.
- `source` — either `report_field:<key>` (references section C's schema) or
  `club_fact:<key>` (a district/club-level fact tracked outside the monthly
  report — see below)
- `points` — for `flat`/`per_unit` rules
- For `tiered` rules, a child table `point_rule_tiers` (`rule_id`, `min`,
  `max`, `points`) — covers attendance % brackets (10/20/30/50 at
  25/50/75/100%), membership retention % brackets, sponsorship amount
  ranges, dues-payment-timing brackets (50/30/−500)
- Tiered rules based on a **ratio** (e.g. attendance % = attendees ÷ total
  club members) reference a numerator/denominator field pair, not a single
  raw field

**`club_facts`** covers district-tracked facts that aren't part of a club's
self-reported monthly data: dues-paid date, RI Citation completion, Paul
Harris Fellow count, dual-membership count, MDIO committee membership,
sister-club-agreement signing date. **Decision: these are real typed columns
on a `club_facts`-style table** (fixed, slow-changing list — ~10-15 known
facts per the points document), not a generic jsonb key-value store, since
the list is known and won't grow often.

Rules compute automatically the moment a report is submitted or a
`club_facts` value is updated by an admin. No manual step for anything
covered by the official points document.

### Subjective (manual)

Unchanged from earlier planning-call scope: DSC/admin manually assigns points
per project/report for things that aren't derivable from a field (quality of
collaboration, judgment calls). A report's/project's total score is
`sum(objective) + sum(subjective)`.

**Visibility, confirmed earlier in planning:** a club sees only its own
cumulative point trend, never other clubs' — avoids inter-club dispute over
awards.

### Audits (added 2026-09-04)

Points decide district awards, so every change that affects a score must be
attributable. A general-purpose `audit_log` (`actor_id`, `action`,
`resource_type`, `resource_id`, `before`, `after` (jsonb diffs), `at`) is
required from day one, not added later. Minimum coverage:
- Any `point_rules` / `point_rule_tiers` change (who changed a rule's
  points/tiers, when)
- Any `club_facts` edit (dues-paid date, RI Citation, etc. — these directly
  drive auto-computed points)
- Any subjective points assignment/change (project, report, effort-log)
- Any role/permission change (Section A)

This is an audit trail, not yet a full appeal/dispute workflow UI — a club
disputing their score can be resolved by an admin reading the log manually
for now. A structured appeal flow (club raises a dispute, admin responds
in-system) is a reasonable future addition but not required for this build.

---

## E. Site-wide settings

`settings` — single key-value table (jsonb values), admin-editable, for
global toggles that are neither content nor permissions:
- DRR calendar availability rules (working days/hours, buffer time)
- Which project subdomains (Mission 3011, Drishti, RCL, Career Bridge) are
  currently active + current lead club, so `/initiatives` can render
  "unassigned" correctly before/after CLS bidding
- Announcement audience-targeting options (currently free-text on
  `announcements.target_audience` — becomes a configurable list)

---

## F. Effort tracker (internal, not public)

DRR informally pulls in Presidents/Secretaries/club members for ad-hoc help
outside formal projects (e.g. a club member editing a release video, another
doing data sorting) — currently tracked in a personal spreadsheet. Needs a
lightweight internal log, not a public page:

- `effort_log` — `id`, `person_name`, `club_id`, `task_description`, `hours`,
  `date`, `logged_by` (admin user), `points_awarded` (nullable)
- Admin screen at `/portal/admin/effort-log` — DSC/Admin/DRR only, not public.
  Uses the same RBAC (Section A) gating as every other admin screen.
- **Points are entirely discretionary** — the DRR assigns `points_awarded`
  per entry at their own judgment. This is the **subjective** scoring path
  (same mechanism as manual project/report points in Section D), not a new
  auto-computed rule — the official points document has no category for this.
- **No standing public list.** When Archit wants to spotlight a specific
  entry, it's surfaced manually as a `content_blocks` highlight (Section B) —
  e.g. pulled into `/leadership` or `/achievements` — not a permanent public
  route.

---

## G. RIDE subdomain

`ride.rotaract3011.org` — follows the same subdomain pattern as the four
bid-out flagship projects (Mission 3011, Drishti, RCL, Career Bridge), though
RIDE itself isn't one of the four bid-out projects — it's a recurring
district program.

- `/support-club` — clubs register once as a district-wide "Support Club"
  for RIDE (not tied to a specific delegation). **Revised 2026-09-04:
  registration captures real capacity upfront**, not just an opt-in flag —
  number of delegates they can host, homestay availability, preferred
  months. `ride_support_clubs` (`club_id`, `capacity_delegates`,
  `homestay_available`, `preferred_months`, `registered_at`).
- `/incoming` — incoming RIDE delegations (visiting district, dates,
  contact). `ride_delegations` (`id`, `visiting_district`, `start_date`,
  `end_date`, `contact`, `status`).
- **Host assignment: district admin assigns manually** from the pool of
  registered Support Clubs — not self-service, not automatic matching.
  **Multiple host clubs can split a single delegation** (matches the points
  document's per-day/per-member granularity — different clubs can host
  different days or different delegates of the same visiting team).
  `ride_delegation_hosts` (`delegation_id`, `club_id`, `assigned_by`,
  `days_hosted`, `members_sent`) — join table, one row per
  delegation×host-club pairing, not a single FK on `ride_delegations`.
- `/gallery` — media from the past 2 RIDEs (7-8 photos, 1-2 videos)
- `/admin` — manage incoming delegations, review support-club sign-ups,
  assign host clubs per delegation (supports assigning multiple clubs to one
  delegation)

**Points integration:** support-club participation and delegation
hosting/visiting feed the existing RIDE point rules from the official points
document (International Services category: hosting 40/day, visiting 30/day,
sending member 30/member, +50 for both) — these are `point_rules` entries
sourced from `ride_delegation_hosts` (`days_hosted`, `members_sent`),
auto-computed per host-club row, not manual.

**Sister Club form is explicitly separate from RIDE** (easy to conflate,
both fall under International Services) — it lives on the main site at
`/resources/sister-club`, not on the RIDE subdomain.

---

## H. Member accounts (portal opened to all club members, not just officers)

Extends the portal beyond Presidents/Secretaries/DSC to every member across
all 75 clubs. This is what makes `user_roles` multi-role (Section A) actually
necessary — a member is `role: Member, scope: their club` and may separately
hold `President, scope: same club` etc.

- **Onboarding — both paths supported, club's choice:**
  - Self-registration: member signs up with email + selects their club, lands
    in a pending queue; that club's President/Secretary approves
    (`users:approve` permission, club-scoped)
  - Bulk import: officers upload a roster (CSV or a form), accounts/invites
    created in bulk
  - **Duplicate handling (added 2026-09-04 — both paths target the same 75
    clubs, collision is inevitable):** email is the hard dedup key —
    `user_profiles.email` gets a real unique constraint (case-insensitive;
    an index on `lower(email)` already exists from the Supabase migration,
    this upgrades it to enforced-unique). Bulk import checks each roster row
    against existing accounts by email before creating a new one — a match
    updates/links the existing account (and its roles) rather than creating
    a duplicate; only genuinely new emails create new pending accounts.
- **Role transitions are a known gap, deferred.** When a President changes
  mid-tenure (this happened this year per the planning call), scoped role
  assignments need an effective-date so historical reports/points stay
  attributed to whoever actually held the role at the time. Not solved in
  this spec — tracked as follow-up work, not blocking the initial build.
- `members` extends `user_profiles` — adds `photo_url`, `bio`, `skills`
  (array/jsonb), `interests` (array/jsonb), `membership_anniversary`. The
  skills/interests fields exist specifically because they're a scored
  category in the points document ("50%+ of members added skills &
  interest" = 60 pts) — populating this table is itself measurable, not just
  a nice-to-have profile field.
- **Digital member ID (QR)** — generated per member, used for event check-in
  (feeds Section I's attendance tracking).

## I. Personal member dashboard

- **My contribution log** — member-initiated version of Section F's effort
  tracker: a member submits their own hours/task, an officer (President/
  Secretary/DSC, club-scoped `effort:approve` permission) approves before it
  counts. Approved entries still route through the same discretionary-points
  mechanism as Section F.
- **My certificates** — auto-generated PDF/badge for milestones: membership
  anniversary, hours thresholds, Paul Harris Fellow status (already a scored
  `club_fact` in Section D — 250 pts/member — so the certificate trigger and
  the point rule share the same underlying fact).
- **My club** — read-only view of own club's roster, projects, reports,
  announcements (member-level `scope: own club` permissions — no edit
  rights, that stays with President/Secretary/DSC roles) — **except Showcase
  submission (see below), which is deliberately opened to members.**
- **Submit Showcase entries** — **revised 2026-09-04:** any member (not just
  President/Secretary) can submit a project to `/showcase`, club-scoped
  `showcase:submit` permission granted to the base Member role. Deliberate:
  the club's avenue Directors (Community Service, Club Service, etc. — see
  `docs/data-requirements.md`) did the actual project work and should be the
  ones reporting it, not routed through the President/Secretary as a
  bottleneck. Publishing still requires officer/DSC approval
  (`showcase:publish` stays a higher-privilege permission, unchanged from
  Section B/D's existing approval-queue design) — this only changes who can
  *submit*, not who can *publish*.
- **Personalized announcement feed** — extends the existing
  `announcements.target_audience` targeting down to individual members, not
  just officer-level roles.

## J. District member directory

Searchable across all 75 clubs by skill, interest, club, or zone. Doubles as
a real utility (finding a specific skill set district-wide) and as the
natural front-end consumer of the skills/interests data from Section H.
Visibility: members see other members' public profile fields only (name,
club, skills/interests, photo) — never contact info beyond what a member
opts to share, and never point/scoring data (that stays club-internal per
the existing visibility rule in Section D).

## K. Individual gamification

Deliberately **not** a cross-club leaderboard — that was already rejected for
club-level points (Section D) for the same reason it'd be worse at individual
scale (thousands of members compared publicly). Instead:
- **Personal badges/milestones** — e.g. "10 events attended," "3 years of
  service," "first project submitted" — visible only to the member
  themselves and their own club's officers, not district-wide.
- Sourced from data already being collected elsewhere in this spec:
  attendance check-ins (Section I), contribution log entries (Section I),
  membership anniversary (Section H) — no new data collection needed, this
  is a presentation layer over existing facts.
- `badges` (definition: key, label, icon, trigger rule) and
  `member_badges` (member_id, badge_id, earned_at) — trigger rules are
  simple threshold checks against existing tables, evaluated on write (e.g.
  after an attendance check-in or contribution approval), not a scheduled job.

## L. Site analytics / live visitor counter

Explicit in the original planning call and `features.md`, dropped during
compilation, restored 2026-09-04. Kept deliberately simple — no third-party
analytics mandate: a `page_views` (or similar) counter incremented
server-side on page load, surfaced as a live-updating number on the home
page. If real analytics (traffic sources, funnels) become useful later,
that's a separate, later decision — this is just the visible counter that
was asked for.

## M. Email delivery — multi-provider, free-tier pooling

Confirmed 2026-09-04: email goes through a provider-agnostic sending layer
that rotates across three free-tier providers to stay entirely free while
pooling their combined daily caps:

| Provider | Free daily cap |
|---|---|
| Resend | 100/day |
| Mailgun | 100/day |
| Gmail SMTP | 500/day |

~700 emails/day combined. The sending layer tries providers in order (or
round-robins) and fails over to the next when one is exhausted or errors —
this needs to be an actual abstraction (a `sendEmail()` service in the
`services` layer, not calls to a specific provider's SDK scattered through
the codebase), since which provider handles a given email shouldn't matter
to any caller. Triggers that need this: report-flagged notifications, DRR
booking confirmations, approval/rejection notices, password reset — all
previously implied by earlier planning but never given an actual delivery
mechanism until now.

## N. Push notifications — web/mobile browser

New requirement, confirmed 2026-09-04: browser-based push (Web Push API +
service worker + VAPID keys), working on both desktop and mobile browsers.
This is **not** native app push (no FCM/APNs) — that's out of scope until an
actual native mobile app exists, which is still a future item per §3's
two-repo architecture reasoning. Natural trigger points reuse the same
events as Section M's email triggers (announcements, booking confirmations,
approval notices) — the two channels should share one notification-dispatch
service internally rather than being built as separate systems that happen
to fire on the same events.

## O. Deployment topology — one codebase, one deployment

Confirmed 2026-09-04: the frontend is **one codebase, one deployment** —
not five separate apps for the five project subdomains. A single deployed
instance serves `rotaract3011.org` and all five subdomains
(`mission3011.*`, `drishti.*`, `rcl.*`, `careerbridge.*`, `ride.*`),
detecting which experience to render from the request hostname. This
matches the nginx/Traefik pattern already in use for other multi-domain
apps in this workspace (one app, multiple domains routed to the same
origin) — it means one Dokploy app + one build pipeline, with 5 additional
domains/DNS records/certs pointed at it, not 5 additional apps to
build/deploy/monitor separately.

This also resolves the cross-subdomain auth question in Section P below —
since it's genuinely one running application, session handling is simpler
than if these were independently deployed apps, though cookies still need
explicit `Domain=.rotaract3011.org` scoping since each subdomain remains a
distinct browser origin regardless of shared backend deployment.

## P. Cross-subdomain authentication

Confirmed approach, 2026-09-04: session cookie scoped to
`Domain=.rotaract3011.org` (not per-subdomain), issued by the API on login,
readable by the single frontend deployment (Section O) regardless of which
subdomain the request came in on. The API itself lives at its own host
(e.g. `api.rotaract3011.org`) and is the only thing that sets/validates the
cookie — every subdomain's frontend calls the same API origin. This needs
`SameSite=Lax` (not `Strict`, since navigation across subdomains should
carry the session) and HTTPS-only (`Secure`) given it's a real session
credential, not a preference cookie.

## Q. Backup for the new Postgres — acknowledged, deferred

`rac3011-postgres` (Oracle) currently has no backup — flagged as a real gap,
but confirmed 2026-09-04 as **fine to defer**, not blocking. Every other
Postgres instance in this workspace has a real backup story (VPS shared
postgres → OneDrive every 15 min); this one should eventually match that
pattern, but it's not required before starting the API/schema build.

## R. Non-functional requirements — accessibility, SEO, mobile-first

Confirmed 2026-09-04 as explicit requirements, not implied nice-to-haves:
- **Accessibility** — baseline WCAG practices (semantic HTML, keyboard
  navigation, alt text, sufficient contrast) across all public pages, not
  just the portal
- **SEO** — proper metadata/OG tags on public pages (Showcase, Achievements,
  Leadership, Heritage especially — these are the shareable/discoverable
  content), a generated sitemap.xml
- **Mobile-first** — given the realistic usage pattern (club members on
  phones, not desktops), layouts should be designed mobile-first and
  verified on mobile viewports, not just responsive-as-an-afterthought

These fold into the design-refinement work already scoped in
`docs/claude-design-prompt.md` rather than requiring a separate build phase.

## S. Event RSVP + attendance tracking

Added 2026-09-04 — closes a real gap: "attendance at district events" is
one of the most heavily weighted categories in the points document (10/20/
30/50 pts at 25/50/75/100% attendance brackets, plus per-leader and
per-member bonuses), but `/calendar` was read-only with no way to actually
capture who attended.

- `events` — extends the district calendar entries (§ sitemap `/calendar`)
  with `id`, `title`, `date`, `location`, `is_district_event` (bool — only
  district-level events count toward the attendance point category, not
  every club's own internal meeting)
- `event_rsvps` — `event_id`, `member_id`, `club_id`, `status`
  (`going | maybe | not_going`)
- `event_checkins` — `event_id`, `member_id`, `checked_in_at`, `checked_in_by`
  — the actual attendance record, distinct from RSVP intent. Uses the
  digital QR member ID from Section H for check-in at the event.
- **Feeds §D directly:** a club's attendance % for a given event/month =
  count of `event_checkins` for that club's members ÷ total club membership
  — this is exactly the ratio-based tiered `point_rule` pattern already
  designed in Section D, just with a real data source now instead of an
  unspecified one.

## T. Multi-club collaborative projects

Added 2026-09-04 — closes a real gap: the points document scores
"initiating a project with up to 5/10/more than 10 clubs," but
`project_submissions` only had a single `club_id`, so collaboration
couldn't be counted from the data itself.

- **`project_clubs`** — join table (`project_id`, `club_id`, `role`:
  `lead | collaborator`) replaces the single `club_id` FK on
  `project_submissions` with a proper many-to-many.
- **Club references are always a real foreign key to `clubs.id`, never a
  free-text club name field** — this applies retroactively to every place a
  club is referenced across this spec (RIDE support/host clubs, effort log,
  event RSVPs, showcase submissions) and is worth stating explicitly given
  the planning call's own concern about agent-generated schemas defaulting
  to duplicated name strings instead of proper relations. Any existing
  free-text club name field encountered during implementation should be
  migrated to a `club_id` FK, not left as-is.
- **Feeds §D directly:** collaboration-count point tiers (up to 5 / up to 10
  / more than 10 clubs) become a simple `count(project_clubs) group by
  project_id` query instead of a manual `club_fact` entry.

## U. Member feedback / grievance channel

Added 2026-09-04. A simple channel for members to raise something to
DSC/admin — not a full ticketing system.

- `feedback` — `id`, `submitted_by` (member_id, nullable if anonymous
  allowed — decide at build time), `category`, `message`, `event_id`
  (nullable — see below), `status` (`open | reviewed | closed`),
  `reviewed_by`, `reviewed_at`
- **District events can specifically collect feedback**: when `event_id` is
  set, this doubles as post-event feedback (tied to a specific `events` row
  from Section S) rather than only general/unscoped feedback — one
  mechanism serves both "feedback about the district in general" and
  "feedback about this specific event."
- Visibility: submitter sees their own submissions and any response; DSC/
  Admin role sees all (`feedback:review` permission, unscoped).

## V. Privacy Policy / Terms of Service pages

Added 2026-09-04. Static pages, not a subsystem — `/privacy-policy` and
`/terms-of-service` on the main site sitemap, content managed through the
existing `content_blocks` CMS (Section B), same as any other free-form page
copy. Real legal necessity given the member directory (Section J) holds PII
(photos, skills/interests, club affiliation) across all 75 clubs — this
should exist before the directory goes live, not after.

## W. Segmented officer communication

Added 2026-09-04 — extends `announcements` beyond its current broad
`target_audience` free-text field. Officers need to reach specific slices,
not just "all" or one audience tag:
- Extend targeting to accept a real query, not a single tag: by role (e.g.
  all Secretaries), by zone, by specific club(s), or a combination —
  reusing the same `scope_type`/`scope_id` vocabulary already established
  in Section A's RBAC model rather than inventing a separate targeting
  syntax.
- Delivery still goes through the shared notification-dispatch service from
  Sections M/N (email + push) — segmentation only changes *who* the
  announcement resolves to, not how it's delivered.

---

## Dependencies / build order

1. **A (RBAC)** — foundational, needed before any admin screen can be gated
2. **B (CMS)** and **E (settings)** — independent of A/C/D, can build in
   parallel once A exists
3. **C (report schema)** — must exist before D can reference report fields
4. **D (point rules)** — depends on C; `club_facts` half is independent of C
5. **F (effort tracker)** and **G (RIDE)** — independent of each other; F
   depends only on A (RBAC) and reuses D's subjective-scoring mechanism; G's
   points integration depends on D existing
6. **H (member accounts)** — depends on A's multi-role `user_roles` model;
   should build early since I, J, K all depend on it
7. **I (personal dashboard)** — depends on H, and reuses F's approval
   mechanism and D's `club_facts` (Paul Harris Fellow, etc.)
8. **J (directory)** — depends only on H (skills/interests data existing)
9. **K (gamification)** — depends on H, I (attendance/contribution data must
   exist before badges can trigger); build last, it's the most deferrable
   piece if timeline pressure hits
10. **O (deployment topology) and P (auth)** — must be decided before *any*
    subdomain work starts (F, G, and the four bid-out project subdomains),
    since they determine how login and routing work across all of them
11. **M (email) and N (push)** — should share one notification-dispatch
    service; build together, needed wherever Sections C/F/G/H trigger a
    notification
12. **L (visitor counter)** and **Q (backup)** — no dependencies, can slot in
    whenever; Q is explicitly non-blocking
13. **R (accessibility/SEO/mobile-first)** — not a phase, a standard applied
    throughout every other phase's frontend work
14. **S (event RSVP/attendance)** — depends on H (member accounts, QR ID)
    and feeds D's attendance point tiers; build alongside or right after H
15. **T (multi-club projects)** — depends on the `clubs` table (already
    exists) and feeds D's collaboration-count point tiers; independent of
    everything except D
16. **U (feedback/grievance)** — depends on H (member accounts) and
    optionally S (event-scoped feedback); low priority, no other subsystem
    depends on it
17. **V (privacy/terms pages)** — depends only on B (CMS); should ship
    **before** J (member directory) goes live, not after, given it's the
    legal basis for holding member PII
18. **W (segmented communication)** — depends on A (reuses scope vocabulary)
    and M/N (delivery); extends the existing `announcements` feature rather
    than being a new one

## Out of scope for this spec

- Visual/drag-drop page building (deliberately rejected in favor of
  content_blocks — see section B)
- The 4 project subdomains' own admin tools (Mission 3011 camps, Drishti
  surgeries, RCL fixtures, Career Bridge postings) — separate spec, tracked
  in `docs/data-requirements.md`
- Whether report form changes need a scheduled cutover (open question in C)
- Native mobile app push (FCM/APNs) — browser push only for now (Section N)
- A structured appeal/dispute UI for point scores — audit log only for now
  (Section D's Audits subsection)
- Effective-dated role transitions — acknowledged gap, deferred (Section H)
