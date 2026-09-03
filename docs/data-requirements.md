# Data Requirements — by sitemap section

Legend: ✅ have it (existing table) · 🟡 have some, need more fields · 🔴 need from
team, nothing exists yet

## Existing tables (from Supabase migration, verified row counts)

| Table | Rows | Purpose |
|---|---|---|
| `clubs` | 75 | id, name, short_name, zone, lat/lng, president+secretary (name/email/phone), rotary_id, `initiatives` (jsonb) |
| `user_profiles` | 145 | Portal login accounts — role (officer/president/secretary/dac_member), club_name, TOTP |
| `monthly_reports` | 0 | Reporting portal submissions, `sections_json` blob per month |
| `project_submissions` | 0 | Showcase source — already has title, category, description, budget, beneficiaries, proof_url, status |
| `announcements` | 0 | District broadcasts |

---

## `/map`
✅ **Have it.** `clubs.lat`/`lng`, president/secretary contact — already sufficient.

## `/showcase`
🟡 **Have the table, need the content.** `project_submissions` is empty (0 rows) —
this is the MDIO-pitch project data Sarthak mentioned. **Ask Sarthak for:** the
July–August project submissions dump (photos + one-line summaries per project),
mapped to club_id. Needs photo URLs — decide now whether photos go to R2/S3 or
stay as Google Drive links (Drive links are fragile for a public gallery).

## `/heritage`
🔴 **Nothing exists.** Need per past-DRR: name, tenure (start/end year, district
number at the time — 3011/3010/301/earlier), photo, short bio.
**Ask:** who compiles this — Sarthak referenced a "district directory" as the
source; Instagram highlight screenshots are the fallback per the call. Flag the
two-term-DRR edge case (resignation/replacement) needs a `term_number` or
explicit start/end dates, not just "current DRR" boolean.

## `/leadership`
🟡 **Partially covered.** `clubs.president`/`secretary` gives club-level contact
already. **Missing:** DSC roster (not in any table), full club BOD beyond
President/Secretary (Director of Community Service, Club Service, etc. —
Sarthak said this exists as "raw data dump," needs reformatting), and photos for
everyone (currently only name/email/phone, no photo column anywhere).
**Ask Sarthak for:** DSC member list (name, role, photo, contact) and the club
BOD raw dump — accept it in whatever format he has, we'll normalize it.

## `/initiatives`
No new data — this page reads aggregated totals from the 4 project subdomains
below. Nothing to ask for directly.

## `/resources`
🔴 **Nothing exists** — these are static documents/links, not DB rows.
**Ask Sarthak/Shefali for:** point-system methodology doc, ISD guidelines,
sister-club agreement template, logo files, Google Photos album links
(event-wise), and confirm which standing Google Forms should be linked from
`/resources/forms`.

## `/publications`
🔴 **Nothing exists.** District directory PDF is "coming soon" per the call —
no immediate ask. Monthly newsletters: ask who owns producing these going
forward (editing team, per Rajveer's suggestion).

## `/get-involved`, `/achievements`, `/partners`, `/contact`
🔴 Mostly form-driven (no data ask) except:
- `/achievements` needs the list of newly chartered clubs this year + charter
  certificate scans — **ask Sarthak/Shefali.**
- `/partners` needs confirmed logos + usage permission — **Archit is chasing
  CanSupport/Sambhav Seva Foundation directly**, not blocked on the team.

## `/calendar`
🔴 **Nothing exists.** Need the district year calendar (dates, event names,
locations) as a structured list, not a static image/PDF. **Ask Shefali/Sarthak**
— likely already exists as a planning doc, needs converting to structured data.

## `/drr-calendar`
No content ask — this is live Google Calendar data (needs OAuth setup with
Archit's calendar, not a data request to the team).

## `/portal/*`
✅ **Have it** — `user_profiles` (145 accounts already seeded), `monthly_reports`
schema ready (0 submissions yet, expected — reporting hasn't opened). No blocking
data ask; point-scoring is manual per-report by DSC/admin once reports start
flowing, no separate table needed yet beyond what's already there.

---

## Project subdomains — all 🔴 nothing exists yet

These need new tables regardless of team-provided data, since they're
operational logs the *lead club* will fill in going forward, not historical
content to collect now:

- **Mission 3011** — camps table (club, date, venue, units collected), no
  historical backfill needed, starts fresh once the lead club is assigned.
- **Project Drishti** — beneficiaries + surgery-pipeline tables, same — starts
  fresh with the lead club.
- **RCL** — teams, fixtures, standings — starts fresh once format is decided
  (per bidding doc, the lead club proposes format).
- **Career Bridge** — job postings table — starts fresh, no backfill.

**No ask needed here** — these are populated by whichever club wins each
project bid, after CLS. Worth noting to Archit: schema for these 4 should be
designed now so the lead clubs have a ready tool the moment ownership is
assigned, even though there's no data yet.

---

## Consolidated ask to send the team now

So they have lead time while design/build proceeds in parallel:

**To Sarthak:**
1. July–August `project_submissions` dump (photos + summaries, per club) — for Showcase
2. Past-DRR list (name, tenure, district number, photo/bio) — for Heritage
3. DSC roster + full club BOD raw dump — for Leadership
4. Newly chartered clubs list + charter certificates — for Achievements

**To Shefali:**
1. Point-system methodology doc, ISD guidelines, sister-club agreement
   template — for Resources
2. District year calendar as structured data (not a PDF/image) — for Calendar

**Not blocked on the team (Archit-owned or infra-owned):**
- Partner logos/permissions (Archit chasing directly)
- DRR Google Calendar OAuth setup (infra)
- Project subdomain schemas (can be designed now with placeholder/no data)
