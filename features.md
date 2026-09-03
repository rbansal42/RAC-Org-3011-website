# Rotaract District 3011 Website — Feature List

Extracted from the 2026-09-03 planning call (Archit, Rajveer, Rahul, Sarthak, Shefali).
Priority reflects the call's own framing: **P0** = must exist for the 6th (CLS demo /
SERIC presentation showcase), **P1** = by the 10th (portal access rollout), **P2** =
longer-term vision, explicitly deferred.

---

## 1. Home Page
- **P0** Hero with tagline "It all starts with Rotaract and everything good happens"
  (grammar: "fellowship", not "fellowships"), reused in footer/other sections
- **P0** Photo carousel of district events (installation, DOLLS, CLS) — remove
  scroll-jacking/scroll-snap, it's causing performance complaints
- **P0** Replace subjective/debatable stats (e.g. "70+ Clubs") with non-debatable
  framing — some clubs may be terminating
- **P0** Fix "Organisation" spelling
- **P1** Sponsorship/impact interactive widget (shows impact of a given sponsorship
  amount) — keep the concept, fix performance
- Live visitor counter (site-wide traffic, e.g. footer or header)

## 2. Interactive District Map
*(Already built — refine/extend)*
- Club pins geocoded from each club's Rotary-portal address (Leaflet base +
  Mapbox GL for satellite view)
- Click pin → club overview + WhatsApp deep-link (`wa.me/...`) to President/Secretary,
  click-to-email
- Zone filter (filters pins, shows zone name)
- Club KPIs surfaced on the map (planned addition)
- Remove/hide raw API attribution text shown on some tabs

## 3. Rotaract Showcase (club project gallery)
- **P0** Grid/masonry of club projects: photo, club name, project date, 2-4 line
  summary
- **P0** Filters: club, zone, project category/avenue (International Service,
  Rotaract-Interact, etc.)
- **P0** Seeded from existing MDIO-pitch project submission form data
  (July-August), sourced from Sarthak/Shefali
- **P1** Self-serve club upload flow (form → admin approval queue → publish) —
  flagged as risky since club-submitted forms are error-prone; needs a review step
- **P2** AI-generated one-line summaries from raw submission text

## 4. Heritage / Past Leadership
- **P0** Grid of past DRRs (district 3011, 3010, 301, and earlier numbering) with
  photo + tenure
- **P0** Handle edge cases: DRRs who served two non-contiguous terms
  (resignation/replacement mid-term)
- **P0** Source photos from Instagram highlight reels per DRR (screenshot fallback)
  where no HD photo exists yet
- **P1** Detail view per DRR: photos, Rotaract journey/bio
- Filter/search across DRRs (pattern already built, reuse everywhere)
- **P2** Request HD photos directly from DRRs, backfill pre-301-era leaders via
  LinkedIn/network references

## 5. District Leadership
- **P0** Core leadership tab: District Governor, DRR, DRC (3 people) — photo +
  brief profile, reusable for club installations/intros
- **P1** Full DSC (District Service Council) roster
- **P1** President/Secretary directory per club: photo, blood group, club, contact
- **P2** Club-level BOD directory (Director of Community Service, Club Service,
  etc.) — full district-directory-style drilldown, needs raw data from Sarthak
  reformatted

## 6. Reporting Portal (club monthly reporting)
- **P0** Auth: Presidents + Secretaries (submit + view announcements only) and
  Admin/DSC roles (5-7 people: Archit, Shefali, Sarthak, Himanshu, DRS, etc. —
  full visibility)
- **P0** Simple, low-friction monthly report submission flow (priority:
  reliability over features)
- Two-factor auth via authenticator app (debated — keep for security per Sarthak,
  flagged as friction before a demo)
- 5-hour session persistence per device/browser after login
- **P1** Point-scoring system per project (collaborations count, external orgs
  involved, DSC attendance, etc.) — manually assigned by DSC/admin roles, not
  automated (too subjective); cumulative monthly point trend shown as a graph to
  the club
- **Decision made:** a club sees **only its own** cumulative points, not other
  clubs' — avoids inter-club conflict/award disputes. Optional: aggregate/
  anonymized "top 3" leaderboard without exposing exact competitor numbers
- **P2** Editorial/CMS layer for district-produced content (newsletters,
  multimedia) manageable inside the portal by the editing team
- **P2 (explicitly deferred)** Full org-tree RBAC: Super Admin (DRR) → Deputy DRR
  / DSC roles → ZRRs (see only their zone's clubs) → Presidents (see only their
  club) — vision item for when the org scales, not needed for the 6th

## 7. District Initiatives / Mission Dashboards
- **P0/P1** Live progress dashboards for district-wide bidding projects (e.g.
  "Mission 3011" blood/units collection, cataract surgery target of 100) —
  circular/radial progress indicator toward numeric targets, aggregated from
  club-level camp submissions

## 8. Job Portal
- **P0** No login required. Two flows:
  - **Post an opening** — Rotarian/company submits: company name, role,
    stipend/salary, job vs internship (dropdown), HR contact — routes to a
    submissions queue (email or admin view)
  - **View openings** — Rotaractors browse postings, contact the listed HR
    directly to apply (no in-platform application system)
- **P1** Mark postings as filled/closed
- **P1** Dashboard: openings posted vs. positions filled, success rate

## 9. Resource Hub
- **P0** Point-system methodology document, ISD guidelines, sister-club agreement
  templates, DSC database, President database — all admin/reference documents in
  one place
- **P0** Logo files, district year calendar, links to Google Photos albums
  (event-wise)
- **P0** Standing Google Forms (President/Secretary database intake, etc.)
- **P1** Guest speaker profile kit — bio + photos for DG/DRR/DRC/core team, ready
  to hand to any club hosting an event

## 10. Publications Hub
- **P1** District directory (PDF, "coming soon" placeholder acceptable for launch)
- **P1** Monthly newsletters (district-produced)
- **P2** Club-submitted newsletters, self-upload

## 11. Membership / New Club Formation
- **P0** "Open a new Rotaract club" application form (university or
  community-based), routes to district membership team contact (phone/email
  fields configurable per team member)
- Contact-us style forms reused for various intake needs (sponsorship interest,
  partnership, etc.)

## 12. DRR Calendar / Booking
- **P1** Public-facing calendar of DRR's next ~9 months — bookable/available
  dates for installations or club event invitations
- Booking submission → notification to DRR's inbox (Google Calendar integration
  suggested as the mechanism)

## 13. Achievements
- **P1** Newly chartered clubs this year, with charter certificates

## 14. Partners
- **P1** Year partner / community partner logos (e.g. prospective: Sambhav Seva
  Foundation, CanSupport — pending their approval)

## 15. AI / Innovation (SERIC presentation requirement)
- **P2** Some AI-forward feature is needed to satisfy the presentation's "tech
  integration" theme — explicitly *not yet designed*. A raw LLM chatbot is ruled
  out as too costly/unreliable for a free-tier build; needs a cheaper/more
  controlled approach (e.g. structured Q&A over district data rather than
  open-ended chat)

---

## Cross-cutting / infrastructure decisions
*(binding constraints from the call, not features)*

- **Move off Supabase.** Cost concern at scale (~$25/mo) vs. a self-managed
  Postgres on an $8/mo OVHcloud VPS (8GB RAM / 120GB / 4-core, already hosting 8
  other client DBs). **This conflicts with the Supabase-based deploy already
  shipped to Dokploy staging/testing — needs reconciling before further backend
  work.**
- **Proper normalized schema required before any agent-driven scaffolding** —
  LLM-generated schemas tend toward denormalized/JSON-blob columns with
  duplicated data (e.g. a President's name stored redundantly instead of via a
  foreign key). Schema design needs to be deliberate, not auto-generated.
- **DNS → Cloudflare** for performance (done).
- **Infra target: Oracle Cloud free tier** (24GB RAM / 200GB storage instance) as
  the long-term sustainable host. Requires a district-owned Oracle account
  (Sarthak to create, one-time credit card verification, then free forever).
- **Single super-admin Google account** for all district tech tooling (Vercel,
  Supabase, etc.) — decided in principle, exact ownership (Archit personally vs.
  a dedicated district tech email) still open.
- **Hostinger access** to be shared with Rahul (collaborator invite from
  Sarthak).
- A CMS is needed — flagged as necessary, not resolved in the call.

## Explicit non-goals / deferred
*(said out loud, don't build yet)*

- Full RBAC org-tree (ZRR-level scoped views, mobile app) — vision only, not for
  the 6th
- Automated/algorithmic point-scoring — stays manual/human-judged
- Club-vs-club visible leaderboard — explicitly rejected
- Self-serve club project uploads without an approval gate — flagged as risky
  (data quality), fine to defer past 6th
