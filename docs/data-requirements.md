# Data Requirements — by sitemap section

Refreshed 2026-09-04 against the full master spec (23 sections, A-W). Legend:
✅ have it (existing table) · 🟡 have some, need more fields · 🔴 need from team,
nothing exists yet.

**Asset format, decided 2026-09-04:** we do not host uploaded files — every
photo/document ask below wants a **shareable link** (Google Drive/Photos,
or wherever it already lives), not a raw file upload. Say this explicitly
when asking, it changes what people send back.

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
🟡 **Have the table, need the content — and it needs to change shape.**
`project_submissions` is empty (0 rows). **Ask Sarthak for:** the
July–August project submissions dump (photo *links*, one-line summaries per
project). **Revised 2026-09-04:** each project now needs its **collaborating
clubs listed** (not just one owning club — §6.T's `project_clubs` join
table needs this to compute the collaboration-count point category), so ask
for "which clubs worked on this together," not just "which club submitted
this."

## `/heritage`
🔴 **Nothing exists.** Need per past-DRR: name, tenure (start/end year,
district number at the time — 3011/3010/301/earlier), photo link, short
bio. **Ask:** who compiles this — Sarthak referenced a "district directory"
as the source; Instagram highlight screenshots are the fallback per the
call. Flag the two-term-DRR edge case (resignation/replacement) needs a
`term_number` or explicit start/end dates, not just "current DRR" boolean.

## `/leadership`
🟡 **Partially covered.** `clubs.president`/`secretary` gives club-level
contact already. **Missing:** DSC roster (not in any table), full club BOD
beyond President/Secretary (Director of Community Service, Club Service,
etc. — Sarthak said this exists as "raw data dump," needs reformatting),
and photo links for everyone (currently only name/email/phone, no photo
field anywhere). **Ask Sarthak for:** DSC member list (name, role, photo
link, contact) and the club BOD raw dump — accept it in whatever format he
has, we'll normalize it. **Also needed now:** for each DSC member/officer,
which RBAC role they should hold (§6.A) — this is a one-time seeding
exercise, not ongoing data, but someone needs to map "this person = ZRR for
Zone 2" etc. before the RBAC rollout.

## `/initiatives`
No new content data — this page reads aggregated totals from the 4 bid-out
project subdomains. Nothing to ask for directly.

## `/resources`
🟡 **Partially resolved.** ✅ Point-system methodology doc — **now in hand**
(the RID 3011 Points System RY 2026-27 PDF). 🔴 **Still need:** ISD
guidelines, sister-club agreement template (for `/resources/sister-club`,
§6.G), logo files (as links), Google Photos album links (event-wise), and
confirmation of which standing Google Forms should be linked from
`/resources/forms`. **Ask Sarthak/Shefali.**

## `/publications`
🔴 **Nothing exists.** District directory PDF is "coming soon" per the call
— no immediate ask. Monthly newsletters: ask who owns producing these going
forward (editing team, per Rajveer's suggestion).

## `/get-involved`, `/achievements`, `/partners`, `/contact`
🔴 Mostly form-driven (no data ask) except:
- `/achievements` needs the list of newly chartered clubs this year +
  charter certificate links — **ask Sarthak/Shefali.**
- `/partners` needs confirmed logos + usage permission — **Archit is
  chasing CanSupport/Sambhav Seva Foundation directly**, not blocked on
  the team.

## `/calendar`
🔴 **Nothing exists — and the shape got more demanding.** Need the district
year calendar as structured data (dates, event names, locations), not a
static image/PDF. **Revised 2026-09-04:** with Event RSVP + attendance
tracking now in scope (§6.S), each event also needs a description and an
explicit **`is_district_event` flag** — since attendance at *district*
events specifically is a scored point category, we need to know which
calendar entries count toward that vs. which are informational-only.
**Ask Shefali/Sarthak** — likely already exists as a planning doc, needs
converting to structured data plus that one flag decided per event.

## `/drr-calendar`
No content ask — this is live Google Calendar data (needs OAuth setup with
Archit's calendar, not a data request to the team).

## `/privacy-policy`, `/terms-of-service`
🔴 **New, 2026-09-04.** Need to know: does the district/Rotary International
already have standard privacy/terms language we should adapt, or does this
get drafted fresh for the site? **Ask Archit** — this blocks the member
directory (§6.J) going live, so it's not low-priority even though it's a
small ask.

## `/portal/*`
✅ **Have it** — `user_profiles` (145 accounts already seeded),
`monthly_reports` schema ready (0 submissions yet, expected — reporting
hasn't opened). No blocking data ask; point-scoring is manual per-report by
DSC/admin once reports start flowing.

## Point system — `club_facts` seed data (new ask, 2026-09-04)
🔴 **Nothing exists, and this is the single biggest new ask.** §6.D's
objective point rules need a `club_facts` table seeded per club: dues-paid
date, RI Citation completion, Paul Harris Fellow count, dual-membership
count, MDIO committee membership, sister-club-agreement signing date (~10-15
fields per the points document). **Ask: who currently tracks this at the
district level** — likely Sarthak/the Secretariat, possibly spread across
different people per fact (e.g. dues tracked by Treasurer, RI Citation by a
different role). This needs an initial seed spreadsheet, one row per club,
before the point system can show anything real.

## RIDE — `ride.rotaract3011.org/gallery`
🔴 **New ask from Archit (WhatsApp, 2026-09-03):** snippets from the past 2
RIDEs — 7-8 photo links + 1-2 video links. **Ask Archit** — he's the one who
requested this section, likely has or knows who has the media.

---

## Project subdomains — all 🔴 nothing exists yet

These need new tables regardless of team-provided data, since they're
operational logs the *lead club* will fill in going forward, not historical
content to collect now:

- **Mission 3011** — camps table (club, date, venue, units collected), no
  historical backfill needed, starts fresh once the lead club is assigned.
- **Project Drishti** — beneficiaries + surgery-pipeline tables, same —
  starts fresh with the lead club.
- **RCL** — teams, fixtures, standings — starts fresh once format is decided
  (per bidding doc, the lead club proposes format).
- **Career Bridge** — job postings table — starts fresh, no backfill.
- **RIDE** — support-club registrations + incoming delegations — starts
  fresh (gallery media above is the one historical exception).

**No ask needed here beyond the RIDE gallery above** — these are populated
by whichever club wins each project bid, after CLS bidding concludes.

---

## Consolidated ask to send the team now

So they have lead time while design/build proceeds in parallel. **Say
explicitly: photos/documents as shareable links, not file uploads** — we
don't host raw files.

**To Sarthak:**
1. July–August `project_submissions` dump (photo links + summaries, **with
   all collaborating clubs listed per project**, not just one owner) — Showcase
2. Past-DRR list (name, tenure, district number, photo link, bio) — Heritage
3. DSC roster + full club BOD raw dump, **plus which RBAC role each person
   should hold** (President/Secretary/ZRR/DSC/Admin) — Leadership + RBAC seeding
4. Newly chartered clubs list + charter certificate links — Achievements
5. **`club_facts` seed data** — dues-paid dates, RI Citation status, Paul
   Harris Fellow counts, dual-membership counts, MDIO committee membership,
   sister-club-agreement dates, one row per club — Point system (biggest new ask)

**To Shefali:**
1. ISD guidelines, sister-club agreement template — Resources
2. District year calendar as structured data, **with an is_district_event
   flag per entry** — Calendar + attendance tracking

**To Archit:**
1. Partner logos/permissions (already chasing directly)
2. Privacy Policy / Terms of Service — existing district/RI language to
   adapt, or draft fresh?
3. RIDE gallery — 7-8 photos + 1-2 videos from the past 2 RIDEs

**Not blocked on the team (infra-owned):**
- DRR Google Calendar OAuth setup
- Project subdomain schemas (can be designed now with placeholder/no data)
- Point-system methodology doc — **now in hand**, no longer an ask
