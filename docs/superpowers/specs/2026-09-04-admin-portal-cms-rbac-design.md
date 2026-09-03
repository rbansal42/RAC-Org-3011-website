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
- `user_profiles.role_id` replaces `user_profiles.role`

Seed system roles: President, Secretary, DSC/Admin, Super Admin — but Super
Admin can create new roles and edit permission grants through the UI. This is
what makes it configurable rather than another hardcoded set.

**Enforcement:**
- Every API mutation endpoint has a guard/decorator checking the caller's
  role has the required permission. Non-negotiable — this is the actual
  security boundary.
- Frontend fetches the current user's resolved permission set once at login,
  uses it to conditionally render nav items, buttons, form fields. Pure UX,
  never trusted as a boundary.

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
- Image uploads go through object storage (R2/S3-style, matching the pattern
  used elsewhere in other projects), never base64-in-Postgres.

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

## Dependencies / build order

1. **A (RBAC)** — foundational, needed before any admin screen can be gated
2. **B (CMS)** and **E (settings)** — independent of A/C/D, can build in
   parallel once A exists
3. **C (report schema)** — must exist before D can reference report fields
4. **D (point rules)** — depends on C; `club_facts` half is independent of C

## Out of scope for this spec

- Visual/drag-drop page building (deliberately rejected in favor of
  content_blocks — see section B)
- The 4 project subdomains' own admin tools (Mission 3011 camps, Drishti
  surgeries, RCL fixtures, Career Bridge postings) — separate spec, tracked
  in `docs/data-requirements.md`
- Whether report form changes need a scheduled cutover (open question in C)
