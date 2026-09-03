# Prompt for Claude Design — RAC District 3011 Website (full-site refinement)

Paste everything below into a Claude design session.

---

I'm refining an existing website for **Rotaract District 3011** (a youth
community-service organization, part of Rotary International). This is a
**refinement pass across the entire sitemap, not a redesign** — every page
listed below needs a design pass, but the visual identity (colors, typography,
component style) must stay recognizably the same site throughout. Consistency
across ~25 pages/flows matters more than any single page looking clever.

Stack: Vite + React SPA, styled with Tailwind. Four of the sections below will
ship as separate deployments on subdomains but must look like the same site as
the main domain — same header/footer chrome, same tokens, same component
library.

## The core problem: the site feels sluggish, not visually wrong

This is the #1 thing to fix, and it should shape every design decision below,
not just the homepage:

- The current homepage hero uses scroll-jacking/scroll-snap on a photo
  carousel, and it visibly lags on normal laptops. Replace with a lightweight,
  native-feeling carousel — CSS scroll-snap without JS hijacking the scroll
  wheel, or a simple autoplay fade/slide — that never blocks or slows normal
  page scrolling.
- Every interactive element (map pins, filters, showcase grid, dashboards,
  calendar booking, job listings) needs to feel instant. Favor CSS transitions
  over JS animation libraries. Lazy-load below-the-fold images and map tiles.
  Avoid layout shift (reserve space for images/async content before they load).
- Nothing should fight the user's scroll or click — no forced scroll
  positions, no janky re-renders on filter/tab changes, no full-page spinners
  where a skeleton or optimistic UI would do.
- Every dashboard/counter (blood units, surgeries, tournament standings, job
  postings) should feel alive without being heavy — prefer CSS-driven
  progress/counter animations over JS canvas/chart libraries unless the data
  genuinely needs a real chart.

## Design system constraints

- Reuse existing color tokens, spacing scale, font families, and
  button/card/form component patterns already defined in the Tailwind config
  and component library in this repo. Inspect them before proposing anything
  new.
- Any new UI (project subdomain dashboards, calendar booking flow, job
  listings, admin views) must visually match the existing site — same
  components, same tone — not introduce a new style per section.
- Recurring tagline to weave in naturally where it fits (footer, hero, section
  dividers, empty states): **"It all starts with Rotaract and everything good
  happens."**
- Primary brand color is a deep maroon/burgundy (`#D81B60`-family, seen in
  email templates and the district bidding document), paired with a cream/off-
  white background — confirm the exact tokens against the repo's Tailwind
  config rather than assuming these hex values are current.

## Full sitemap — design every page below

### Main site — `rotaract3011.org`

**`/` — Home**
Hero (tagline + the fixed photo carousel described above), a teaser strip
pulling 3-4 cards from Rotaract Showcase, and CTA cards linking to Map,
Showcase, Career Bridge, and Get Involved. Should read as a landing page for
someone who has never heard of Rotaract, not an internal dashboard.

**`/map` — Interactive district map**
Club pins geocoded across the district, click-to-reveal club overview with
WhatsApp/email deep-links, a zone filter. Design the pin/popup treatment,
zone-filter UI, and a graceful loading/error state for the map tile layer
(this is the heaviest page on the site — treat perceived performance as a
first-class design requirement here, e.g. skeleton map bounds while tiles load).

**`/showcase` — Rotaract Showcase**
Grid/masonry of club projects (photo, club name, date, 2-4 line summary),
filterable by club/zone/category. Design the card, the filter bar, and the
empty/loading states for when a club has no projects yet.
- **`/showcase/[project-id]`** — single project detail: larger photo(s), full
  write-up, club attribution, related projects.

**`/heritage` — Past DRRs**
Grid of past District Rotaract Representatives across the district's
numbering history (3011 / 3010 / 301 / earlier), with a search/filter.
- **`/heritage/[drr-slug]`** — single DRR profile: photos, tenure, bio/journey.

**`/leadership` — District Leadership**
Core team (DG, DRR, DRC) as a featured trio, then the full DSC roster, then a
directory entry point per club (President/Secretary/BOD).
- **`/leadership/clubs/[club-slug]`** — one club's leadership team.

**`/initiatives` — District initiatives hub**
This page aggregates live numbers from the four project subdomains (see
below) — design it as a dashboard of dashboards: one card per project (Mission
3011, Project Drishti, RCL, Career Bridge) with a headline stat and progress
indicator, linking out to each subdomain. This is the page where the "feels
alive, not heavy" principle matters most.

**`/resources` — Resource Hub**
A document/asset library. Design a clear, scannable index (not a flat file
list) across:
- `/resources/documents` — point-system methodology, ISD guidelines,
  sister-club agreement templates
- `/resources/logos` — brand asset downloads
- `/resources/photos` — links out to Google Photos albums, event-wise
- `/resources/guest-kit` — a downloadable bio+photo bundle for guest
  introductions (pulls from `/leadership` data, not a separate copy)
- `/resources/forms` — links to standing Google Forms (data intake)

**`/publications`**
District directory (PDF) and monthly newsletters — design as a simple,
dated list/archive with a clear "coming soon" state for the directory.

**`/get-involved`**
- `/get-involved/new-club` — application form for opening a new Rotaract club
  (university or community-based)
- `/get-involved/sponsor` — sponsorship/partnership interest form, ideally
  with the interactive "see the impact of $X" widget mentioned in planning
  (keep the concept, make it lightweight — no heavy animation)

**`/achievements`**
Newly chartered clubs this year, with charter certificates — a simple
timeline or grid.

**`/partners`**
Partner/sponsor organization logos, grouped by tier if relevant.

**`/contact`**
Standard contact form.

**`/calendar` — District Calendar**
Public, read-only list/grid of district events (installations, camps,
tournaments, CLS, SERIC, etc.), plus a "download full year calendar" action.
Design month/list view toggle if there's enough event density to warrant it.

**`/drr-calendar` — DRR's Calendar (booking)**
A booking flow: available slots pulled live from the DRR's real Google
Calendar (so design an honest "checking availability..." loading state, not a
static grid), a booking form, and a confirmation state.
- `/drr-calendar/book/[slot-id]` — booking form for a specific slot
- `/drr-calendar/admin` — DRR-facing: manage availability rules, view/cancel
  bookings (internal tool, can be plainer than public-facing pages but still
  on-brand)

**`/portal/*` — Reporting portal (authenticated)**
This is an internal tool for club Presidents/Secretaries and DSC/admin —
design it plainer and denser than the public site (data-table-heavy), but
still using the same component library:
- `/portal/login`
- `/portal/dashboard` — role-scoped landing
- `/portal/reports/new` — monthly report submission form (this must be
  extremely low-friction — design it as a short, guided form, not a wall of
  fields)
- `/portal/reports/history` — a club's own past reports + a point-trend graph
  (a club sees only its own points, never other clubs')
- `/portal/announcements` — district-to-club broadcasts
- `/portal/admin/clubs` — DSC/admin: review reports, assign points
- `/portal/admin/showcase` — DSC/admin: approve/publish club-submitted
  showcase projects
- `/portal/admin/users` — manage President/Secretary accounts

### Project subdomains
*(each is a lead-club management portal for one of the district's bid-out
flagship projects; must feel like the same site as the main domain)*

**`mission3011.rotaract3011.org` — Mission 3011** (blood donation, target
3,011 units across the district)
- `/camps` — log a camp (date, venue, club, units collected) — a short form
- `/dashboard` — district-wide running total against the 3,011 target
  (design this as the flagship "feels alive" progress visual — a filling
  vessel, thermometer, or radial gauge, lightweight/CSS-driven), per-club
  leaderboard
- `/admin` — lead club: review/approve camp submissions from other clubs

**`drishti.rotaract3011.org` — Project Drishti** (target: 100 cataract
surgeries facilitated)
- `/beneficiaries` — log identified patients / screening camps
- `/surgeries` — track the surgery pipeline (patient → hospital tie-up →
  surgery → follow-up) — design this as a simple pipeline/stage view
- `/dashboard` — progress toward 100, same visual language as Mission 3011's
  dashboard but distinct enough not to be confused with it

**`rcl.rotaract3011.org` — Rotaract Cricket League**
- `/register` — club team registration form
- `/fixtures` — match schedule
- `/standings` — points table / results, designed like a real sports league
  table
- `/admin` — lead club: manage fixtures, officials, volunteers

**`careerbridge.rotaract3011.org` — Career Bridge** (jobs, internships,
mentorship, volunteering — Rotarians post, Rotaractors browse)
- `/post` — a Rotarian posts an opportunity (short form: company, role,
  stipend/salary, job vs. internship, HR contact)
- `/opportunities` — browse/filter listings
- `/[listing-id]` — listing detail, contact-to-apply (no in-platform
  application system)
- `/admin` — lead club: verify postings, manage applications, mark filled

## What "done" looks like

For each page/flow above, I want:
1. A quick read of what currently exists there (if anything) and what's
   specifically making it feel slow or inconsistent.
2. A concrete before/after — not a new visual direction, a tightened one.
3. Explicit notes on any place a heavier pattern (map, live calendar
   availability, dashboards) needs a real loading/error/empty state design,
   not just a happy-path mockup.

Please start by reviewing the current homepage, map, and showcase pages (the
three Archit specifically flagged as feeling slow in the last planning call),
identify the concrete causes, and propose fixes — then move through the rest
of the sitemap in the same before/after format.
