# Phase 02: Public Site Implementation Plan

> **Status (2026-09-04): superseded where it differs.** `docs/superpowers/specs/2026-09-04-implementation-spec.md` is the authoritative document for schema, routes, RBAC, storage and email. This file remains useful as extra task-level detail for its build step; when the two disagree, the spec wins.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship every public screen of rotaract3011.org (25 mockup screens, 3 breakpoints each) on real data: a `public` API module with cache-headered read endpoints plus enquiry/visit writes, and the matching React routes, header, footer and shared public components.

**Architecture:** In `rac3011-api`, one `PublicModule` (controllers → `PublicService` facade → per-domain services → repositories → Prisma) exposes unauthenticated `GET /public/*` reads with `Cache-Control: public, s-maxage=N` and three `POST /public/*` writes (visits, enquiries). Domain tables (`past_drrs`, `district_team`, `achievements`, `partners`, `publications`, `resources`, `sister_club_requests`, `events`, `enquiries`, `page_views`, `content_blocks`, `initiative_snapshots`, showcase columns) are added by expand-only migrations and seeded from `src/data/districtData.js` of the reference repo. In `rac3011-web`, `src/features/<domain>/{api.ts,hooks.ts,components/,pages/}` folders consume the endpoints via `apiFetch` + zod, rendered inside `PublicLayout` (`PublicHeader` + `PublicFooter`), with every layout written mobile-first and matching the `.dc.html` mockups at 390 / 768 / 1440.

**Tech Stack:** NestJS 11 · Prisma 6 · Postgres 18 · Zod 4 (`nestjs-zod`) · `@nestjs/throttler` · Vitest + supertest + testcontainers · Vite 5 · React 18 · react-router 7 · TanStack Query 5 · Tailwind v4 · lucide-react · Leaflet 1.9 · Playwright + `@axe-core/playwright`.

**Spec:**
- `docs/superpowers/plans/2026-09-04-master-build-plan.md` (row 02, §1 layouts, §2 data model, §3 interfaces)
- `docs/superpowers/specs/2026-09-04-website-master-spec.md` §4 sitemap, §6.L, §6.R, §6.V
- `docs/superpowers/specs/2026-09-04-admin-portal-cms-rbac-design.md` §B, §E, §L, §R, §V
- Mockups (authoritative per screen): `design-export/v2/Public Pages Part 1.dc.html` (Home, Map, Showcase, Showcase detail, Heritage, DRR profile, Leadership, Club leadership), `Public Pages Part 2.dc.html` (Initiatives, Resources, Resource category, Publications, New club, Sponsor, Achievements, Partners, Contact, Calendar), `Public Pages Part 3.dc.html` (DRR calendar, DRR booking, DRR calendar admin, Club showcase page, Initiatives unassigned, Privacy policy, Terms of service), `Design System.dc.html`.
- Seed source: `src/data/districtData.js` (`INITIAL_CLUBS`, `PAST_DRRS`, `DISTRICT_ZONES`, `ROTARY_FOCUS_AREAS`, `IMPACT_METRICS`) and `src/components/Pages/PublicHome.jsx` (`FLAGSHIP_SLICES`) in the reference repo `/Volumes/Code/rac-org-3011-website`.

## Global Constraints

Inherited verbatim from the master plan; every task below implicitly includes them.

1. Two repos: `/Volumes/Code/rac3011-api` and `/Volumes/Code/rac3011-web`. The reference repo is read-only input for seed data and Leaflet learnings.
2. Layered API: `controllers` (HTTP only) → `services` → `repositories` (only place Prisma is called); `transformers` map Prisma ⇄ DTO with no I/O; `dto/` Zod schemas are the single source for runtime and static types. No Prisma import outside `*.repository.ts`. Cross-module access only via exported services.
3. Every club reference is `clubId` FK → `clubs.id`. Never free-text club names in new columns (the one exception is `past_drrs.homeClubName` for pre-3011 clubs that no longer exist, and it is nullable and used only when `homeClubId` is null).
4. No server-owned object storage. Every asset field is an external URL. Never base64 in Postgres.
5. Notifications go through one dispatch service. This phase defines and uses a `NotificationPort` interface with a console stub; Phase 09 supplies the real implementation.
6. Design fidelity: implement the `.dc.html` mockups faithfully, including drawn states (loading / empty / error / unreachable). Tokens live in `src/styles/tokens.css` (`@theme`). Light and dark both required. Montserrat. 44px minimum interactive height everywhere. No scroll-jacking, no `scroll-snap-stop: always`, no `height:100vh; overflow:hidden` on the root.
7. No UI component library. Hand-built primitives from Phase 00 in `src/components/ui/`.
8. Accessibility / SEO / mobile-first: semantic HTML, keyboard reachable, alt text, contrast; per-route `<title>`/OG meta via `useDocumentMeta`; `sitemap.xml` and `robots.txt` generated at build from the public route table; layouts mobile-first.
9. Testing: TDD per task. API: Vitest unit (repositories mocked) + e2e via supertest against the shared Postgres testcontainer (`fileParallelism:false`, `resetTestDatabase()`). Web: Vitest + Testing Library; Playwright smoke at 390/768/1440 with the API in `E2E_SEED=1` mode; axe check per screen.
10. Migrations: `prisma migrate diff` into monotonic-timestamp folders; must replay from scratch in CI. Expand/contract only.
11. Code style: no comments unless a non-obvious constraint; 2-space; named exports for components; files ≤ ~300 lines, split by responsibility.
12. Commits: small, conventional (`feat(scope): …`), no Co-Authored-By lines. Push to `main` only via PRs after CI passes; check `gh run list` after each merge.
13. Secrets only in env / Keychain. Emails in dev/test never reach real members (`MAIL_DRIVER=console`).
14. Copy: never use em dashes in UI strings or code; use commas, colons, or middle dots (`·`) as the mockups do for metadata separators.

## Assumed Phase 00 / 01 exports (names this plan depends on)

These come from the master plan §1 and §3. If a name differs in the actual Phase 00/01 code, adapt the import, not the design.

- API: `PrismaService` at `src/prisma/prisma.service.ts`; `ZodValidationPipe` global; `test/setup/app.ts` exporting `createTestApp(): Promise<INestApplication>` and `resetTestDatabase(): Promise<void>` plus `prisma: PrismaClient`; `ClubsService` (exported from `ClubsModule`) with `findAllPublic()`; `SettingsService` (exported from `SettingsModule`) with `get<T>(key: string): Promise<T | null>`; Prisma models `Club { id String, name, slug, zoneId, zone Zone, charterDate DateTime?, isActive Boolean, meetingInfo String?, socialLinks Json?, lat Float?, lng Float? }`, `Zone { id, name }`, `ClubBoardMember { id, clubId, memberId?, name, position, bloodGroup?, phone?, email?, ryYear, photoUrl? }`, `MemberProfile { clubId, status }`, `ProjectSubmission` (legacy columns), `Setting { key, value Json }`.
- Web: `src/lib/api-client.ts` exporting `apiFetch<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T>` (adds `API_ORIGIN`, `credentials:'include'`, parses JSON with the schema) and `ApiError`; `src/lib/meta.ts` exporting `useDocumentMeta({ title, description, image? })`; `src/components/ui/` exporting `Button`, `Chip`, `Card`, `Skeleton`, `EmptyState`, `ErrorState`, `Avatar`, `ImageSlot`, `RadialGauge`, `ProgressBar`, `Breadcrumbs`, `Input`, `Textarea`, `Select`, `Drawer`, `Divider`; `src/app/host.ts` `resolveSurface()`; `src/test/render.tsx` exporting `renderWithProviders(ui, { route? })` (QueryClient + MemoryRouter + ThemeProvider).
- Token utility classes available from `tokens.css` (`@theme` names): colours `rotaract-pink` (#D81B60), `rotaract-deep` (#880E4F), `rotaract-tint` (#FDF0F5), `rotaract-track` (#FBE4EC), `rotaract-page` (#FDF8FA), `rotaract-line` (#F3E5EB), `ink` (#1E1E24), `body` (#4A4A5A), `muted` (#71717A), `bar` (#18181B), `pink-lift` (#F0407F); zone colours `zone-prithvi` (#10b981), `zone-agni` (#D81B60), `zone-vayu` (#0284c7), `zone-akash` (#123499); radii `rounded-chip` (5px), `rounded-control` (8px), `rounded-row` (12px), `rounded-card` (16px), `rounded-panel` (32px); shadows `shadow-raised`, `shadow-overlay`. Dark mode is `[data-theme=dark]` and the tokens swap automatically, so components use token classes and never hard-code hex.

---

## File structure

### `rac3011-api` (created or modified in this phase)

```
prisma/schema.prisma                                  + models below (Task 1)
prisma/migrations/<ts>_phase02_public_content/        expand-only migration
prisma/seed/public-content.ts                         seed past_drrs, district_team, resources, partners, publications, achievements, content_blocks, flagship, settings; idempotent upserts
prisma/seed/data/past-drrs.json                       45 rows transcribed from districtData.js PAST_DRRS
prisma/seed/data/district-team.json                   core + DSC from DISTRICT_ZONES adrr/zrr/zrs
prisma/seed/data/flagship.json                        5 FLAGSHIP_SLICES rows
prisma/seed/data/legal/privacy-policy.json            content_blocks value for /privacy-policy
prisma/seed/data/legal/terms-of-service.json
prisma/seed/e2e/public-e2e.ts                         E2E_SEED=1 extras: 6 published projects, 5 events, 2 achievements w/ certificates
src/common/cache/cache-control.decorator.ts           @CacheSeconds(n)
src/common/cache/cache-control.interceptor.ts         sets Cache-Control from metadata
src/common/ports/notification.port.ts                 NotificationPort interface + token + ConsoleNotificationPort
src/public/public.module.ts
src/public/controllers/public-home.controller.ts      GET /public/home, POST /public/visits
src/public/controllers/public-clubs.controller.ts     GET /public/clubs, /public/clubs/:slug
src/public/controllers/public-showcase.controller.ts  GET /public/showcase, /public/showcase/:slug, /public/showcase/clubs/:slug
src/public/controllers/public-heritage.controller.ts  GET /public/heritage, /public/heritage/:slug
src/public/controllers/public-leadership.controller.ts GET /public/leadership
src/public/controllers/public-initiatives.controller.ts GET /public/initiatives
src/public/controllers/public-resources.controller.ts GET /public/resources, /public/resources/:category
src/public/controllers/public-publications.controller.ts GET /public/publications
src/public/controllers/public-achievements.controller.ts GET /public/achievements
src/public/controllers/public-partners.controller.ts  GET /public/partners
src/public/controllers/public-calendar.controller.ts  GET /public/calendar, /public/calendar/:slug
src/public/controllers/public-content.controller.ts   GET /public/content/:pageKey
src/public/controllers/public-enquiries.controller.ts POST /public/new-club, /public/sponsor, /public/contact
src/public/services/*.service.ts                      one per controller above (+ visits.service.ts, showcase-teaser)
src/public/repositories/*.repository.ts               one per table group
src/public/transformers/*.transformer.ts              Prisma → DTO, pure
src/public/dto/*.dto.ts                               Zod schemas + inferred types (shared with OpenAPI)
src/public/ports/subdomain-aggregate.port.ts          SubdomainAggregatePort + NullSubdomainAggregate (Phases 12/13 implement)
test/public/*.e2e.spec.ts                             supertest per controller
```

### `rac3011-web` (created or modified in this phase)

```
src/app/routes/main.routes.tsx                        + all public routes (Task 27)
src/app/routes/public-route-table.ts                  static route table (path, title, changefreq) consumed by router + sitemap script
src/components/layout/PublicLayout.tsx                header + <Outlet/> + footer + skip link
src/components/layout/PublicHeader.tsx                desktop / tablet / mobile nav, Club Portal CTA
src/components/layout/PublicNavDrawer.tsx             mobile hamburger drawer (uses ui/Drawer)
src/components/layout/PublicFooter.tsx                four columns, visitor counter line
src/components/public/SectionLabel.tsx                eyebrow + fading hairline (the "labelled rule")
src/components/public/PageIntro.tsx                   h1 + lede pattern shared by list pages
src/components/public/ProjectCard.tsx                 uniform-height showcase card (used on Home, Showcase, Club pages)
src/components/public/DateChip.tsx                    fixed-width day/month chip for calendar rows
src/components/public/ContactRow.tsx                  WhatsApp / email deep-link buttons
src/components/public/EnquiryRoutingCard.tsx          "THIS GOES TO" card with avatar
src/features/home/{api,hooks}.ts, components/{HeroStrip,VisitorCounter,FactBand,FlagshipCarousel,ShowcaseTeaser,CtaGrid}.tsx, pages/HomePage.tsx
src/features/clubs/{api,hooks}.ts, components/{ZoneFilter,ClubMap,ClubDirectory,ClubCard,MapStateFrame}.tsx, lib/{whatsapp.ts,zones.ts}, pages/{MapPage,ClubLeadershipPage,ClubShowcasePage}.tsx
src/features/showcase/{api,hooks}.ts, components/{ShowcaseFilters,ShowcaseGrid,ShowcaseEmpty,RunByCard,RelatedList}.tsx, pages/{ShowcasePage,ShowcaseDetailPage}.tsx
src/features/heritage/{api,hooks}.ts, components/{DrrCard,DistrictBand,HeritageSearch}.tsx, pages/{HeritagePage,DrrProfilePage}.tsx
src/features/leadership/{api,hooks}.ts, components/{CoreTrio,DscRoster,ClubDirectoryList}.tsx, pages/LeadershipPage.tsx
src/features/initiatives/{api,hooks}.ts, components/{InitiativeCard,InitiativeUnassignedCard,InitiativeUnreachableCard}.tsx, pages/InitiativesPage.tsx
src/features/resources/{api,hooks}.ts, components/{ResourceCategoryCard,ResourceTable,LockedBadge}.tsx, pages/{ResourcesPage,ResourceCategoryPage}.tsx
src/features/publications/{api,hooks}.ts, components/{DirectoryCard,NewsletterGrid}.tsx, pages/PublicationsPage.tsx
src/features/get-involved/{api,hooks}.ts, components/{NewClubForm,SponsorWidget,SponsorForm,NextSteps}.tsx, pages/{NewClubPage,SponsorPage}.tsx
src/features/achievements/{api,hooks}.ts, components/CharterCard.tsx, pages/AchievementsPage.tsx
src/features/partners/{api,hooks}.ts, components/{PartnerTierGrid,PartnerCta}.tsx, pages/PartnersPage.tsx
src/features/contact/{api,hooks}.ts, components/{ContactRouting,ContactForm}.tsx, pages/ContactPage.tsx
src/features/calendar/{api,hooks}.ts, components/{MonthBand,EventRow,ViewToggle}.tsx, pages/{CalendarPage,EventDetailPage}.tsx
src/features/drr-calendar/pages/{DrrCalendarPage,DrrBookingPage,DrrCalendarAdminPage}.tsx, components/MonthGridShell.tsx   (read-only shells; Phase 11 fills them)
src/features/legal/{api,hooks}.ts, components/LegalBody.tsx, pages/{PrivacyPolicyPage,TermsOfServicePage}.tsx
src/lib/format.ts                                     formatDate, formatCount, formatInr
scripts/generate-sitemap.ts                           reads public-route-table → public/sitemap.xml + public/robots.txt
e2e/public/*.spec.ts                                  Playwright per screen at 3 widths + axe
```

Every page file composes components; no page exceeds ~150 lines.

---
