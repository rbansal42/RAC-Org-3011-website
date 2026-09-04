# RAC District 3011 Platform: Implementation Spec (hand-off edition)

This document is written to be executed by an implementer with no prior context and a low reasoning budget. Follow it literally. Where it says "exactly", do not improvise. Where a decision is not covered here, choose the simplest option that keeps every test in §12 passing, and write the decision down in `docs/decisions.md` of the repo you are in.

Companion documents (read only when this spec points you to them):
- Design mockups, authoritative for every screen: `design-export/v2/*.dc.html` in this repo. Each file is one HTML page. Each screen is inside a `<div data-screen-label="...">` and is drawn three times: 1440px, 768px, 390px. Grey caption paragraphs under each screen describe behaviour; treat them as requirements.
- `docs/superpowers/plans/2026-09-04-master-build-plan.md` (phase table; same content as §13 here).

---

## 0. Ground rules (apply to every file you write)

1. Language: TypeScript 5.x, `strict: true`, no `any`, no `@ts-ignore`.
2. Two repositories: `rac3011-api` (backend) and `rac3011-web` (frontend). Never put backend code in the web repo or vice versa.
3. Backend layering (enforced by ESLint `no-restricted-imports`): `*.controller.ts` may import only its module's `*.service.ts` and `dto/`; `*.service.ts` may import its own `*.repository.ts`, other modules' `*.service.ts`, and `common/`; `*.repository.ts` is the only file allowed to import `@prisma/client` or `PrismaService`. `*.transformer.ts` are pure functions (no imports from services/repositories).
4. Every club reference is a foreign key column `clubId` → `clubs.id`. Never store a club name in any other table.
5. Files are uploaded through the `StoragePort` module only (§3A): UploadThing for public assets, Cloudflare R2 for private ones. Never write files to the container filesystem, never base64 into Postgres, and never call a storage SDK outside `src/storage/`. External links (Drive/Photos/YouTube) remain a supported alternative input for every asset field.
6. Every mutating endpoint has `@RequirePermission('<key>')` and a scope check (§4.4). Every list/read endpoint filters by the caller's scope inside the repository query.
7. Every notification goes through `NotificationPort.notify()` (§7). No module imports an email or push SDK directly.
8. Audit log rows (§4.6) are written for every action listed in §4.6.
9. No code comments unless they explain a constraint that is not visible in the code. No commented-out code.
10. Tests: each task below is done when its listed tests pass. Do not mark a task done without running the test command and reading the output. **CI does not run tests** (removed 2026-09-04 for deploy speed - "Remove testing from CI. I want deploys to be faster. Test locally before pushing."): CI is build-image-and-deploy only. Every task, every agent, runs the full local suite by hand before every push - `npm run lint && npx prisma validate && npm run test && npm run test:e2e` (api), `npx tsc -b && npm test && npm run build && npx playwright test` (web) - and only pushes once it's green. A broken build is now only caught by the Docker image failing to compile, not by CI, so this is not optional.
11. Commits: one per task, message `feat(<module>): <what>` / `test(...)` / `chore(...)`. No trailer lines.
12. Files under 300 lines. Split by responsibility.
13. Frontend: no UI library (no HeroUI, shadcn, MUI, Radix, Headless UI). Build the primitives in §9.3. Tailwind v4 utility classes only; no inline `style=` except for dynamic values (e.g. `--accent`).
14. Frontend visual rules: font Montserrat; minimum height 44px for every button/input/link-in-nav; light and dark theme via `[data-theme="dark"]` on `<html>`; no `scroll-snap-stop: always`; never set `height:100vh; overflow:hidden` on a page root.
15. Secrets never enter the repo. Env var names are fixed in §11.2.

---

## 1. Repositories, tooling, commands

### 1.1 `rac3011-api`

Create at `/Volumes/Code/rac3011-api`, GitHub `rbansal42/rac3011-api` (private).

```bash
npx @nestjs/cli@11 new rac3011-api --package-manager npm --skip-git --strict
cd rac3011-api && git init && git add -A && git commit -m "chore: nest scaffold"
npm i @nestjs/config @nestjs/swagger @nestjs/throttler @nestjs/event-emitter @nestjs/bullmq bullmq ioredis \
  @prisma/client@6 better-auth@1 @thallesp/nestjs-better-auth zod@4 nestjs-zod helmet pino nestjs-pino pino-http \
  @sentry/node googleapis web-push nodemailer resend pdfkit qrcode @anthropic-ai/sdk ics date-fns bcryptjs
npm i -D prisma@6 vitest @vitest/coverage-v8 unplugin-swc @swc/core supertest @types/supertest @testcontainers/postgresql \
  @types/bcryptjs @types/nodemailer @types/pdfkit @types/qrcode @types/web-push eslint typescript-eslint tsx openapi-typescript
```

`package.json` scripts (exact):
```json
{
  "build": "nest build",
  "start:dev": "nest start --watch",
  "start:prod": "node dist/main",
  "start:worker": "WORKER=1 node dist/main",
  "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
  "test": "vitest run --project unit",
  "test:e2e": "vitest run --project e2e",
  "test:all": "vitest run",
  "prisma:migrate": "prisma migrate deploy",
  "prisma:new": "tsx scripts/new-migration.ts",
  "seed": "tsx prisma/seed.ts",
  "openapi": "tsx scripts/export-openapi.ts"
}
```

`vitest.config.ts`: two projects. `unit` = `src/**/*.spec.ts`, `e2e` = `test/**/*.e2e.ts` with `globalSetup: ['test/global-setup.ts']`, `fileParallelism: false`, `testTimeout: 30000`. `test/global-setup.ts` starts one `PostgreSqlContainer('postgres:18')`, runs `prisma migrate deploy` against it, exports `DATABASE_URL` via `process.env`, and tears down after all files. `test/db.ts` exports `resetTestDatabase()` = `TRUNCATE` of every table except `_prisma_migrations`, then re-run `seedSystemData()` from `prisma/seed-system.ts` (roles, permissions, point categories/rules, settings defaults).

`scripts/new-migration.ts <name>`: runs `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url $SHADOW_DATABASE_URL --script` into `prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql`. Never run `prisma migrate dev`.

Local infra `docker-compose.yml`: `postgres:18` (port 5434, db `rac3011`, user `rac3011`, password `rac3011`), `redis:7` (6379). `.env.example` lists every var in §11.2.

`src/main.ts`:
```ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { ZodValidationPipe } from 'nestjs-zod';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({ origin: env.WEB_ORIGINS, credentials: true });
  app.useGlobalPipes(new ZodValidationPipe());
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('rac3011').setVersion('1').build());
  SwaggerModule.setup('docs', app, doc);
  await app.listen(env.PORT);
}
bootstrap();
```
`src/config/env.ts` parses `process.env` with a Zod schema (§11.2) and exits on failure. When `WORKER=1`, `AppModule` imports only `PrismaModule`, `NotificationsModule` (worker side), `LinkHealthModule`, `PointsModule` (recompute worker) and `DrrCalendarModule` (reminders): controllers are not mounted.

### 1.2 `rac3011-web`

Create at `/Volumes/Code/rac3011-web`, GitHub `rbansal42/rac3011-web` (private).

```bash
npm create vite@5 rac3011-web -- --template react-ts && cd rac3011-web
npm i react-router@7 @tanstack/react-query@5 zod@4 leaflet react-leaflet lucide-react date-fns qrcode.react @zxing/browser
npm i -D tailwindcss@4 @tailwindcss/vite vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @playwright/test @axe-core/playwright openapi-typescript @types/leaflet
```
Scripts: `dev`, `build` (= `tsc -b && vite build && tsx scripts/generate-sitemap.ts`), `test` (vitest), `e2e` (playwright test), `typegen` (`openapi-typescript http://localhost:3000/docs-json -o src/lib/openapi.d.ts`).

`vite.config.ts`: plugins `react()`, `tailwindcss()`; `server.host = true`; `server.allowedHosts = ['.localhost']`.

`Dockerfile` (web): multi-stage; final `nginx:alpine` with `nginx.conf` doing SPA fallback (`try_files $uri /index.html`), `Cache-Control: public,max-age=31536000,immutable` for `/assets/*`, `no-cache` for `index.html`, and the CSP header from §11.4.

---

## 2. Domain vocabulary

- **Rotary Year (RY)**: 1 July → 30 June. `ryYear` is the integer of the July year (RY 2026-27 → `2026`). Helper `ryYearOf(date)` = `date.month >= 7 ? date.year : date.year - 1`. `currentRyYear()` uses Asia/Kolkata.
- **Month key**: `Date` at first day of month, UTC midnight. String form `YYYY-MM`.
- **Surfaces** (frontend): `main`, `mission3011`, `drishti`, `rcl`, `careerbridge`, `ride`. Project keys are the same five strings.
- **Zones**: `Prithvi`, `Agni`, `Vayu`, `Akash` (seed from distinct existing `clubs.zone`; if a club has a zone string not in this list, keep it as an extra zone row and log it).
- **Roles** (system): `member`, `president`, `secretary`, `zrr`, `dsc`, `editing_team`, `super_admin`, plus one `project_admin` role instance per project (`scopeType: project`).

---

## 3. Database architecture (locked)

### 3.0 Binding decisions

| # | Decision | Rule |
|---|----------|------|
| D1 | Clean schema, legacy isolated | At baseline, rename `user_profiles → legacy_user_profiles`, `monthly_reports → legacy_monthly_reports`, `project_submissions → legacy_project_submissions`, `announcements → legacy_announcements`. Only `clubs` is kept and extended. New tables are designed clean (no `status2`/`title2` shims). `scripts/migrate-legacy.ts` copies legacy rows into the new tables once (idempotent via `legacy_id` columns). Legacy tables are dropped in build step 14. |
| D2 | Identifiers | `id String @id @default(cuid())` on every table except `clubs.id` (legacy text id, kept) and Better Auth tables (their own ids). External references in URLs use `id`; public pages additionally use `slug` where defined. |
| D3 | Naming | Tables: plural snake_case (`@@map`). Columns: snake_case (`@map`). Enums: Postgres enums, singular snake_case values. Booleans `is_*`/`has_*` or plain adjective; timestamps `*_at`; dates `*_on`. |
| D4 | Timestamps | `created_at`, `updated_at` on every table (join tables included). No soft deletes: deletions are real and the prior state is captured in `audit_log.before`. |
| D5 | Club references | Always `club_id` FK → `clubs.id` with `ON DELETE RESTRICT`. Zone is never stored on a child row; derive through `clubs.zone_id`. |
| D6 | Rotary-year partitioning | Tables whose meaning resets each year carry `ry_year Int` and a unique key including it: `club_facts`, `point_rules`, `club_point_entries`, `club_board_members`, `ride_support_clubs`, `district_team`. Sports use `season Int` (same integer). |
| D7 | JSON usage | `Json` columns are allowed only for: `settings.value`, `content_blocks.draft_value/published_value`, `reports.values`, `report_requests.questions`, `report_request_responses.answers`, `announcements.audience`, `club_point_entries.trace`, `certificates.data`, `enquiries.payload`, `clubs.social_links`. Anything that is a list of entities (clubs, members, photos) is a table or a `String[]` of URLs, never JSON objects. |
| D8 | Money and points | `Decimal @db.Decimal(10,2)`. Hours `Decimal(6,2)`. Overs `Decimal(4,1)`. |
| D9 | Scope columns | Every row that is subject to RBAC scoping has exactly one of: `club_id` (club scope), `project_key ProjectKey` (project scope), or none (district-wide). Zone scope is resolved through `clubs.zone_id` at query time. |
| D10 | Sensitive data | Only `drishti_beneficiaries.phone_encrypted` is encrypted (AES-256-GCM, key `DRISHTI_PII_KEY`, iv‖tag‖ciphertext base64). Passwords/OTP secrets live only in Better Auth tables. No PII in `audit_log.before/after` beyond ids and the changed fields. |
| D11 | Indexes | Every FK gets an index. Every `(club_id, ry_year)` pair, every `status` column that is filtered in a list endpoint, and every `starts_at`/`date` used for range queries gets an index. Unique constraints as listed per table. |
| D12 | Migrations | Prisma migration files generated with `prisma migrate diff`, hand-edited only to add partial indexes and data backfills. Expand/contract for renames (add → backfill → switch code → drop in a later migration). CI replays all migrations from an empty database. |
| D13 | Access path | Prisma is only ever called from `*.repository.ts`. Repositories receive a `ScopeFilter` (`{ all: true } | { clubIds: string[] } | { projectKeys: ProjectKey[] }`) and apply it in the `where` clause. |
| D14 | Denormalisation | Not allowed except: `clubs.member_count` (maintained by trigger-free service update on approve/suspend) and `page_views.count`. Everything else is computed at read time or cached in `settings` under `summary_cache:*`. |

### 3.1 Entity map

```
zones 1─* clubs 1─* member_profiles 1─1 user (better-auth) 1─* user_roles *─1 roles *─* permissions
clubs 1─* club_board_members | club_facts(ry) | reports 1─* report_queries | club_point_entries *─1 point_rules *─1 point_categories | effort_log | events(club events) | ride_support_clubs | rcl_teams | m3011_camps(lead) | project_clubs *─1 projects
member_profiles 1─* event_rsvps | event_checkins | member_badges | certificates | feedback | announcement_reads | push_subscriptions | member_privacy_acceptances
report_form_schemas 1─* report_form_fields ; reports.schema_version → report_form_schemas.version
events 1─* event_rsvps | event_checkins | feedback(event-scoped)
announcements 1─* announcement_reads ; notification_outbox (independent) ; email_provider_usage
content_blocks ; settings ; asset_links(polymorphic by resource_type/resource_id) ; audit_log(polymorphic)
past_drrs ; district_team ; achievements ; partners ; publications ; resources ; sister_club_requests ; enquiries ; page_views
drr_bookings ; drr_blocks
m3011_camps 1─* m3011_camp_clubs ; drishti_beneficiaries 1─* drishti_surgeries ; rcl_teams 1─* rcl_players ; rcl_fixtures 1─1 rcl_results ; cb_listings ; ride_delegations 1─* ride_delegation_hosts ; ride_gallery_items
```

### 3.2 Baseline migration

```bash
prisma db pull                       # introspect the 5 legacy tables
# edit schema.prisma: rename models to Legacy*, @@map to legacy_* ; keep Club as Club
prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260905000000_baseline/migration.sql
# prepend to that file:
#   ALTER TABLE user_profiles RENAME TO legacy_user_profiles; (and the other three)
prisma migrate resolve --applied 20260905000000_baseline
```
Then add all new models below and generate `20260905000100_core` with `prisma migrate diff`.

### 3.3 Schema

Shared fragments: every model has
```prisma
createdAt DateTime @default(now()) @map("created_at")
updatedAt DateTime @updatedAt @map("updated_at")
```
(omitted below for brevity; include them). `enum ProjectKey { mission3011 drishti rcl careerbridge ride }`.

**Identity and RBAC**: `User`, `Session`, `Account`, `Verification`, `TwoFactor` exactly as generated by `npx @better-auth/cli generate` with `@@map` to `user`, `session`, `account`, `verification`, `two_factor`. Then:
```prisma
enum MemberStatus { pending approved suspended }
model MemberProfile {
  id String @id @default(cuid())
  userId String @unique @map("user_id"); user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  fullName String @map("full_name"); email String @unique; phone String?; rotaryId String? @map("rotary_id")
  clubId String @map("club_id"); club Club @relation(fields: [clubId], references: [id])
  photoUrl String? @map("photo_url"); bio String?; skills String[] @default([]); interests String[] @default([])
  membershipAnniversary DateTime? @map("membership_anniversary") @db.Date
  status MemberStatus @default(pending); approvedById String? @map("approved_by_id"); approvedAt DateTime? @map("approved_at"); rejectionReason String? @map("rejection_reason")
  qrToken String @unique @default(cuid()) @map("qr_token"); directoryOptIn Boolean @default(false) @map("directory_opt_in"); isDacMember Boolean @default(false) @map("is_dac_member")
  themePreference String @default("system") @map("theme_preference"); legacyId String? @unique @map("legacy_id")
  @@index([clubId]) @@index([status]) @@map("member_profiles")
}
enum ScopeType { none club zone project }
model Role { id String @id @default(cuid()); key String @unique; name String; description String?; isSystem Boolean @default(false) @map("is_system"); scopeType ScopeType @default(none) @map("scope_type"); permissions RolePermission[]; userRoles UserRole[]; @@map("roles") }
model Permission { id String @id @default(cuid()); key String @unique; description String; roles RolePermission[]; @@map("permissions") }
model RolePermission { roleId String @map("role_id"); permissionId String @map("permission_id"); role Role @relation(fields: [roleId], references: [id], onDelete: Cascade); permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade); @@id([roleId, permissionId]) @@map("role_permissions") }
model UserRole { id String @id @default(cuid()); userId String @map("user_id"); roleId String @map("role_id"); scopeType ScopeType @map("scope_type"); scopeId String? @map("scope_id"); grantedById String? @map("granted_by_id"); user User @relation(fields: [userId], references: [id], onDelete: Cascade); role Role @relation(fields: [roleId], references: [id], onDelete: Cascade); @@unique([userId, roleId, scopeType, scopeId]) @@index([userId]) @@index([scopeType, scopeId]) @@map("user_roles") }
model TrustedDevice { id String @id @default(cuid()); userId String @map("user_id"); tokenHash String @unique @map("token_hash"); userAgent String? @map("user_agent"); expiresAt DateTime @map("expires_at"); @@index([userId]) @@map("trusted_devices") }
model AuditLog { id String @id @default(cuid()); actorId String? @map("actor_id"); action String; resourceType String @map("resource_type"); resourceId String? @map("resource_id"); before Json?; after Json?; at DateTime @default(now()); @@index([resourceType, resourceId]) @@index([actorId]) @@index([at]) @@map("audit_log") }
```

**Clubs**
```prisma
model Zone { id String @id @default(cuid()); name String @unique; order Int @default(0); clubs Club[]; @@map("zones") }
model Club {
  id String @id
  name String; shortName String? @map("short_name"); slug String? @unique
  zone String?  /* legacy string; dropped in step 14 */; zoneId String? @map("zone_id"); zoneRef Zone? @relation(fields: [zoneId], references: [id])
  lat Float?; lng Float?; president String?; isDirector String? @default("") @map("is_director"); phone String?; email String?; rotaryId String? @map("rotary_id"); secretary String?; secretaryEmail String? @map("secretary_email"); secretaryPhone String? @map("secretary_phone"); initiatives Json @default("[]")
  charterDate DateTime? @map("charter_date") @db.Date; isActive Boolean @default(true) @map("is_active"); meetingInfo String? @map("meeting_info"); socialLinks Json? @map("social_links"); logoUrl String? @map("logo_url"); memberCount Int @default(0) @map("member_count")
  createdAt DateTime? @default(now()) @map("created_at"); updatedAt DateTime? @default(now()) @updatedAt @map("updated_at")
  members MemberProfile[]; board ClubBoardMember[]; facts ClubFacts[]; reports Report[]; projectClubs ProjectClub[]
  @@index([zoneId]) @@map("clubs")
}
model ClubBoardMember { id String @id @default(cuid()); clubId String @map("club_id"); club Club @relation(fields: [clubId], references: [id]); memberId String? @map("member_id"); name String; position String; bloodGroup String? @map("blood_group"); phone String?; email String?; ryYear Int @map("ry_year"); order Int @default(0); @@index([clubId, ryYear]) @@map("club_board_members") }
model ClubFacts {
  id String @id @default(cuid()); clubId String @map("club_id"); club Club @relation(fields: [clubId], references: [id]); ryYear Int @map("ry_year")
  duesPaidOn DateTime? @map("dues_paid_on") @db.Date; riCitationCompleted Boolean @default(false) @map("ri_citation_completed"); paulHarrisFellows Int @default(0) @map("paul_harris_fellows"); dualMembers Int @default(0) @map("dual_members"); mdioCommitteeMembers Int @default(0) @map("mdio_committee_members"); mdioEventsAttended Int @default(0) @map("mdio_events_attended"); sisterClubSignedOn DateTime? @map("sister_club_signed_on") @db.Date; drrVisitOn DateTime? @map("drr_visit_on") @db.Date; vocationalCentreOn DateTime? @map("vocational_centre_on") @db.Date; activeSocialHandles Int @default(0) @map("active_social_handles"); clubMerchandise Boolean @default(false) @map("club_merchandise"); clubWebsiteUrl String? @map("club_website_url"); priorYearMemberCount Int? @map("prior_year_member_count"); updatedById String? @map("updated_by_id")
  @@unique([clubId, ryYear]) @@map("club_facts")
}
```

**Content, settings, assets, public content**: `ContentBlock`, `Setting`, `AssetLink`, `PastDrr`, `DistrictTeamMember`, `Achievement`, `Partner`, `Publication`, `Resource`, `SisterClubRequest`, `Enquiry`, `PageView` exactly as in Appendix A (unchanged from the previous revision), with `Enquiry` gaining `assignedToId String? @map("assigned_to_id")` and `status String @default("new")` values `new|in_progress|closed`.

**Reporting (clean)**
```prisma
enum SchemaStatus { draft active retired }
model ReportFormSchema { id String @id @default(cuid()); version Int @unique; status SchemaStatus @default(draft); publishedAt DateTime? @map("published_at"); createdById String? @map("created_by_id"); fields ReportFormField[]; reports Report[]; @@map("report_form_schemas") }
enum FieldType { text textarea number select multiselect link date boolean clubs }
model ReportFormField { id String @id @default(cuid()); schemaId String @map("schema_id"); schema ReportFormSchema @relation(fields: [schemaId], references: [id], onDelete: Cascade); section String; fieldKey String @map("field_key"); label String; type FieldType; options Json?; required Boolean @default(false); order Int; helpText String? @map("help_text"); perActivity Boolean @default(false) @map("per_activity"); pointSourceKey String? @map("point_source_key"); @@unique([schemaId, fieldKey]) @@map("report_form_fields") }
enum ReportStatus { draft submitted queried scored }
model Report {
  id String @id @default(cuid()); clubId String @map("club_id"); club Club @relation(fields: [clubId], references: [id]); ryYear Int @map("ry_year"); month DateTime @db.Date
  schemaVersion Int @map("schema_version"); schema ReportFormSchema @relation(fields: [schemaVersion], references: [version])
  status ReportStatus @default(draft); values Json /* { activities: Activity[], ...fieldKey: value } */; notes String?
  submittedById String? @map("submitted_by_id"); submittedAt DateTime? @map("submitted_at"); filedOnTime Boolean? @map("filed_on_time"); scoredAt DateTime? @map("scored_at"); legacyId String? @unique @map("legacy_id")
  queries ReportQuery[]
  @@unique([clubId, month]) @@index([status]) @@index([ryYear, month]) @@map("reports")
}
model ReportQuery { id String @id @default(cuid()); reportId String @map("report_id"); report Report @relation(fields: [reportId], references: [id], onDelete: Cascade); askedById String @map("asked_by_id"); question String; reply String?; repliedById String? @map("replied_by_id"); repliedAt DateTime? @map("replied_at"); @@index([reportId]) @@map("report_queries") }
model ReportRequest { id String @id @default(cuid()); title String; description String?; questions Json; audience Json; dueAt DateTime @map("due_at"); createdById String @map("created_by_id"); responses ReportRequestResponse[]; @@map("report_requests") }
model ReportRequestResponse { id String @id @default(cuid()); requestId String @map("request_id"); request ReportRequest @relation(fields: [requestId], references: [id], onDelete: Cascade); clubId String @map("club_id"); answers Json; submittedById String @map("submitted_by_id"); @@unique([requestId, clubId]) @@map("report_request_responses") }
```

**Points**: `PointCategory`, `PointRule`, `PointRuleTier`, `ClubPointEntry` as in Appendix A, with these locked details: `ClubPointEntry.trace Json? @map("trace")` (renamed from trace_json), partial unique index added by hand in the migration:
```sql
DROP INDEX IF EXISTS "club_point_entries_club_id_rule_id_period_key_key";
CREATE UNIQUE INDEX club_point_entries_computed_idempotent ON club_point_entries (club_id, rule_id, period_key) WHERE kind = 'computed';
CREATE UNIQUE INDEX club_point_entries_judged_one_per_month ON club_point_entries (club_id, period_key) WHERE kind = 'judged' AND source_type IS NULL;
```

**Showcase (clean)**
```prisma
enum ProjectStatus { draft submitted published rejected }
model Project {
  id String @id @default(cuid()); slug String? @unique; title String; category String; date DateTime @db.Date; summary String; body String?; beneficiaries Int?; photos String[] @default([])
  submittedById String? @map("submitted_by_id"); status ProjectStatus @default(draft); consentConfirmed Boolean @default(false) @map("consent_confirmed"); submittedAt DateTime? @map("submitted_at")
  publishedTitle String? @map("published_title"); publishedSummary String? @map("published_summary"); publishedBody String? @map("published_body"); editorNotes String? @map("editor_notes"); rejectionReason String? @map("rejection_reason"); publishedAt DateTime? @map("published_at"); publishedById String? @map("published_by_id"); legacyId String? @unique @map("legacy_id")
  clubs ProjectClub[]
  @@index([status]) @@index([publishedAt]) @@map("projects")
}
enum ProjectClubRole { lead collaborator }
model ProjectClub { projectId String @map("project_id"); project Project @relation(fields: [projectId], references: [id], onDelete: Cascade); clubId String @map("club_id"); club Club @relation(fields: [clubId], references: [id]); role ProjectClubRole; @@id([projectId, clubId]) @@index([clubId]) @@map("project_clubs") }
```
Exactly one `lead` row per project (enforced in the service and by partial unique index `ON project_clubs (project_id) WHERE role = 'lead'`).

**Effort, badges, certificates, privacy, tags**: `EffortLog`, `Badge`, `MemberBadge`, `Certificate`, `MemberPrivacyAcceptance`, `SkillTag` as in Appendix A.

**Events, calendar, feedback**: `Event`, `EventRsvp`, `EventCheckin`, `DrrBooking`, `DrrBlock`, `Feedback` as in Appendix A. `Event.projectKey ProjectKey? @map("project_key")` added so subdomains can list their own events.

**Announcements (clean)**
```prisma
model Announcement { id String @id @default(cuid()); title String; body String; audience Json; channels String[] @default(["portal"]); sendAt DateTime? @map("send_at"); sentAt DateTime? @map("sent_at"); recipientCount Int? @map("recipient_count"); createdById String @map("created_by_id"); legacyId String? @unique @map("legacy_id"); reads AnnouncementRead[]; @@index([sentAt]) @@map("announcements") }
model AnnouncementRead { announcementId String @map("announcement_id"); announcement Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade); userId String @map("user_id"); readAt DateTime @default(now()) @map("read_at"); @@id([announcementId, userId]) @@map("announcement_reads") }
```
`NotificationOutbox`, `EmailProviderUsage`, `PushSubscription` as in Appendix A.

**Subdomains**: as in Appendix A, with `M3011Camp`, `DrishtiBeneficiary`, `RclTeam`, `CbListing`, `RideSupportClub`, `RideDelegation` each additionally indexed on their `status`/`stage` column; `RideDelegationHost` also `@@index([clubId])`.

### 3.4 Legacy data migration (`scripts/migrate-legacy.ts`)
- `legacy_user_profiles` → `user` + `account` + `member_profiles` + `user_roles` (mapping in §4.2), `legacy_id` set.
- `legacy_monthly_reports` → `reports`: `club_id` resolved by `club_email` → `clubs.email` then `club_name` → `clubs.name`/`short_name`; `month` parsed from text like "August 2026" to `2026-08-01`; `schema_version = 1`; `values = { legacySections: sections_json }`; `status = submitted` (or `queried` when `flag_reason` present, with a `report_queries` row from `flag_reason`/`flag_comment`); `submitted_at` kept.
- `legacy_project_submissions` → `projects` + one `project_clubs` lead row; `legacy_announcements` → `announcements` with `audience = {roleKeys:['member']}`.
- Unresolved club matches are written to `scripts/out/unmatched-*.csv` and the run exits non-zero until resolved by an explicit mapping file `scripts/club-aliases.json`.

---

## 3A. Media and file storage (locked 2026-09-04)

This supersedes the earlier "no server-owned object storage / paste a link only" decision. Three tiers, chosen per asset by what it is, never by who uploads it.

| Tier | Store | What goes here | Access |
|---|---|---|---|
| **T1 Permanent public** | UploadThing app `hzcev3x726` (`UPLOADTHING_TOKEN_PERMANENT`) | District/club logos, letterheads, past-DRR portraits, district-team portraits, partner logos, charter certificates, publication covers, static page imagery | Public CDN URL, cached forever, filename-versioned |
| **T2 Dynamic public** | UploadThing app `mjk92b8biq` (`UPLOADTHING_TOKEN_DYNAMIC`) | Event photos, showcase project photos, member profile photos, RIDE gallery images, Mission 3011 camp photos, club event photos | Public CDN URL; deletable when the owning row is deleted |
| **T3 Private** | Cloudflare R2 bucket `rac3011-private` | Generated certificates and directory PDFs, point-system and governance documents flagged private, anything behind a `resources.is_locked` row, report attachments | Never public: served only through `GET /files/:id` which checks RBAC then streams (or 302s to a 5-minute presigned URL) |
| Backups | R2 bucket `rac3011-backups` | `pg_dump` archives | Ops only, no app access |

**Rules**
1. **One module owns all of it**: `src/storage/`. `StoragePort` is the only interface the rest of the API sees:
```ts
export type StorageTier = 'permanent' | 'dynamic' | 'private';
export interface StoredFile { id: string; tier: StorageTier; key: string; url: string | null; name: string; mimeType: string; size: number; }
export abstract class StoragePort {
  abstract createUploadGrant(input: { tier: StorageTier; mimeType: string; size: number; resourceType: string; resourceId?: string; userId: string }): Promise<{ grantId: string; uploadUrl: string; fields?: Record<string,string> }>;
  abstract finalise(grantId: string, providerKey: string): Promise<StoredFile>;
  abstract getPrivateStream(fileId: string): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; name: string }>;
  abstract delete(fileId: string): Promise<void>;
}
```
Implementations: `UploadThingAdapter` (T1/T2, using the UploadThing server SDK `UTApi` with the token for that tier) and `R2Adapter` (T3, `@aws-sdk/client-s3` + `s3-request-presigner` against the R2 S3 endpoint). `StubStorageAdapter` is used in tests and whenever `STORAGE_DRIVER=stub` (this dev network blocks TLS to `*.r2.cloudflarestorage.com`, so local work uses the stub and R2 paths are verified on the VPS).
2. **Uploads are grant-based, never unauthenticated.** `POST /files/grants` `{ tier, mimeType, size, resourceType, resourceId? }` requires a session **and** the permission that owns the target resource (table below); the server validates MIME against an allow-list (`image/jpeg|png|webp|avif`, `application/pdf`, and for T3 also `application/vnd.openxmlformats-*`) and size caps (T1 5 MB, T2 10 MB, T3 25 MB), then returns a short-lived grant. The client uploads directly to the provider and calls `PATCH /files/grants/:grantId { providerKey }` to finalise, which creates the `files` row. Unfinalised grants expire after 15 minutes and are swept nightly.
3. **`files` table** (new, replaces the ad-hoc `String[]` URL columns for anything we host):
```prisma
enum StorageTier { permanent dynamic private }
model StoredFileRow {
  id String @id @default(cuid())
  tier StorageTier
  provider String            // uploadthing | r2
  providerKey String @map("provider_key")
  url String?                // null for private tier
  name String; mimeType String @map("mime_type"); size Int
  resourceType String @map("resource_type"); resourceId String? @map("resource_id")
  uploadedById String @map("uploaded_by_id")
  clubId String? @map("club_id")     // set when the asset belongs to a club, for RBAC on private reads
  @@index([resourceType, resourceId]) @@index([tier]) @@map("files")
}
```
Rows that reference images keep a `String[]` of **file ids** (not URLs) where the spec previously said URLs: `projects.photos`, `events.photos`, `m3011_camps.photos`. Single-image fields (`member_profiles.photo_url`, `partners.logo_url`, `past_drrs.photo_url`, `publications.cover_url`, `clubs.logo_url`, `events.cover_url`, `achievements.certificate_url`) become `*_file_id String?` FKs, with the old `*_url` column kept for one release for externally-hosted values and dropped in build step 14.
4. **External links stay supported, they are just no longer the only option.** `asset_links` (§3.4) continues to exist for Google Drive/Photos albums and YouTube videos, which we deliberately do not re-host: RIDE gallery videos, Google Photos album links on `/resources/photos`, and any document a club would rather keep in its own Drive. The link-health service (§6.4) applies to those; uploaded files never need checking. Every asset field in the UI therefore offers **both**: "Upload" (default) and "Paste a link".
5. **Deletion**: deleting a row deletes its files through `StoragePort.delete` in the same service call; a nightly job removes `files` rows whose `resourceId` no longer resolves (orphan sweep), logging counts.
6. **Private reads**: `GET /files/:id`: if `tier != private`, 301 to the CDN URL; otherwise resolve the owning resource, run the same permission + scope check as reading that resource, then stream. No presigned URL is ever handed to a client that could not read the resource, and presigns expire in 5 minutes.

**Permission per upload target** (`resourceType` → permission, scope): `member_photo` → `profile:edit` (own row only) · `club_logo` → `clubs:edit` (own club) · `project_photo` → `showcase:submit` (own club) · `event_photo` → `events:manage` or `club_events:log` (own club) · `camp_photo` → own club president/secretary · `ride_gallery` → `subdomain:ride:manage` · `partner_logo`, `past_drr_photo`, `district_team_photo`, `publication_cover`, `achievement_certificate`, `content_block` → `public_content:manage` or `content:edit` · `resource_document` → `resources:manage` · `certificate` → generated server-side only, no grant route.

---

## 4. Authentication and RBAC

### 4.1 Better Auth configuration (`src/auth/auth.config.ts`)

- Adapter: Prisma (`prismaAdapter(prisma, { provider: 'postgresql' })`), model names as in §3.2.
- `emailAndPassword: { enabled: true, password: { hash: bcryptHash, verify: bcryptVerify } }` using `bcryptjs` (cost 12). Legacy `user_profiles.password` values are bcrypt hashes produced by the old app; verify with the same function. If a legacy hash does not start with `$2`, treat as unknown and force a reset email on first login attempt.
- Plugins: `emailOTP({ otpLength: 6, expiresIn: 600, sendVerificationOTP: ({email, otp, type}) => notificationPort.notify({template:'otp', to:{email}, data:{otp,type}}) })`, `twoFactor({ issuer: 'Rotaract District 3011' })`.
- Second factor policy (custom, in `src/auth/second-factor.service.ts`): after password success, if the request carries a valid `trusted_device` cookie (random 32-byte token, sha256 stored in `trusted_devices`, expiry 5 hours) skip 2FA; otherwise require either TOTP (if `user.twoFactorEnabled`) or an email OTP. On success, when `rememberDevice=true`, issue a new trusted-device cookie. Resend OTP limited to 3 per 10 minutes per email (throttler keyed on email).
- Session cookie: name `rac3011.session`, `httpOnly`, `secure` (except when `NODE_ENV=development`), `sameSite: 'lax'`, `domain: env.COOKIE_DOMAIN` (`.rotaract3011.org` in prod, `localhost` in dev), 30-day expiry with sliding refresh (`updateAge: 1 day`).
- `trustedOrigins`: `env.WEB_ORIGINS`.
- Routes are mounted at `/auth/*` by `@thallesp/nestjs-better-auth`. Additional custom routes: `POST /auth/second-factor/verify` `{ method:'totp'|'email', code, rememberDevice }`, `POST /auth/second-factor/resend`, `GET /auth/trusted-devices`, `DELETE /auth/trusted-devices/:id`.

### 4.2 Legacy user migration (`prisma/migrations/<ts>_legacy_users/` + `scripts/migrate-legacy-users.ts`)

For each `user_profiles` row: create `user` (id = new cuid, name = full_name, email = lower(email), emailVerified = true), `account` (providerId `credential`, password = legacy hash), `member_profiles` (status approved, `legacyProfileId` = legacy id, `clubId` resolved by: exact `clubs.email = lower(profile.email)` → else `clubs.name = club_name` → else `clubs.short_name = club_name` → else the district placeholder club row `DISTRICT` which you create with name "District 3011 (Officers)"; write unresolved matches to `scripts/out/unmatched-users.csv`), `two_factor` row when `totp_secret` present and set `twoFactorEnabled=true`. Roles by legacy `role`: `president` → `president` scoped club; `secretary` → `secretary` scoped club; `officer` → `dsc` unscoped; `dac_member` → `member` scoped club + `isDacMember=true`. Everyone also gets `member` scoped to their club. The script is idempotent (skips rows whose `legacyProfileId` exists).

### 4.3 Permission keys (exact, seeded)

```
profile:edit  directory:view  showcase:submit  showcase:publish  reports:submit  reports:review  reports:score
requests:manage  members:approve  members:import  members:view  roles:manage  content:edit  content:publish
point_rules:manage  club_facts:edit  effort:log  effort:approve  events:manage  events:checkin  club_events:log
feedback:submit  feedback:review  announcements:send  announcements:send_all  settings:manage  drr_calendar:manage
audit:view  clubs:view  clubs:edit  resources:manage  public_content:manage
subdomain:mission3011:manage  subdomain:drishti:manage  subdomain:rcl:manage  subdomain:careerbridge:manage  subdomain:ride:manage
```

### 4.4 Seed roles → permissions (exact)

| role key | scopeType | permissions |
|---|---|---|
| member | club | profile:edit, directory:view, showcase:submit, feedback:submit, clubs:view |
| president | club | member's + reports:submit, members:approve, members:import, members:view, effort:approve, club_events:log, announcements:send, clubs:edit, subdomain (none) |
| secretary | club | same as president |
| zrr | zone | member's + reports:review, members:view, clubs:view, showcase:publish, announcements:send |
| dsc | none | zrr's + reports:score, requests:manage, members:approve, members:import, club_facts:edit, effort:log, effort:approve, events:manage, events:checkin, feedback:review, announcements:send_all, resources:manage, public_content:manage, audit:view |
| editing_team | none | content:edit, content:publish, public_content:manage |
| super_admin | none | every permission (resolver short-circuits on this role) |
| project_admin | project | subdomain:<scopeId>:manage, events:checkin |

### 4.5 Resolver and guards (`src/rbac/`)

`RbacResolverService.resolve(userId): Promise<ResolvedAccess>` where
```ts
type Scope = { type: 'none'|'club'|'zone'|'project'; id?: string };
type ResolvedAccess = { userId: string; isSuperAdmin: boolean; roles: {roleKey: string; scope: Scope}[]; grants: Record<PermissionKey, Scope[]> };
```
Cache per request (attach to `req.access`). `@RequirePermission(key)` + `PermissionGuard`: 403 unless `isSuperAdmin` or `grants[key]` non-empty. Scope check is done by services calling `ScopeService.assertCanAccessClub(access, permission, clubId)` which passes when any grant scope is `none`, or `club` with same id, or `zone` whose zone contains the club (lookup `clubs.zoneId`). `assertCanAccessProject(access, permission, projectKey)`. List queries call `ScopeService.clubFilter(access, permission): { all: true } | { clubIds: string[] }` and pass it to repositories.

### 4.6 Audit (`src/audit/audit.service.ts`)

`record({ actorId, action, resourceType, resourceId, before, after })`. Mandatory calls: role/permission/user_role changes; point rule + tier changes; club facts updates; judged point create/update/delete; effort points award; settings writes; content publish; showcase publish/reject; member approve/reject/suspend; report query/score; booking confirm/decline; camp approve/reject; listing verify/reject/fill; RIDE host assignment changes.

### 4.7 `GET /me`

Returns `{ user: {id, name, email, twoFactorEnabled}, profile: MemberProfileDto | null, roles, grants, clubs: {id, name, shortName, zoneId}[] /* clubs in scope for the header switcher */, theme }`. 401 when no session. Frontend calls it once on load and after login.

### 4.8 RBAC is the primary deliverable (read before every task)

RBAC is not a cross-cutting nicety here; it is the product's security boundary and the thing the district owner cares about most. Rules, all mandatory:

1. **Definition of done for any route**: (a) `@RequirePermission` present, (b) scope asserted or `ScopeFilter` applied in the repository, (c) an e2e test that an in-scope caller succeeds AND an out-of-scope caller gets 404 (reads) or 403 (permission missing). A route without all three is not mergeable.
2. **Deny by default**: `PermissionGuard` is registered globally (`APP_GUARD`). Routes without `@RequirePermission` are rejected at boot by a startup check (`RbacRouteAudit`) unless decorated `@Public()`; the check lists offending routes and exits non-zero.
3. **No scope leakage through includes or filters**: `include=` and `filter[clubId]` are applied inside the same `ScopeFilter`-constrained query; a client can narrow, never widen.
4. **404 not 403 for out-of-scope existing rows** so a President cannot enumerate other clubs' report ids.
5. **Super Admin is a role, not a code path**: only `RbacResolverService` knows about `super_admin`; services never check role keys, only permission keys plus scope.
6. **Frontend never enforces**: `can()` hides controls; every hidden control's request would still be refused by the API. Playwright tests assert both (control hidden AND API 403/404 when called directly).
7. **Every grant/revoke is audited** and visible at `/portal/admin/audit`.
8. **When in doubt, restrict.** If this spec, the mockups, or the code leave it ambiguous whether a role may read or do something, choose the narrower option: require a permission rather than allow anonymous access, scope to the caller's club rather than the district, return public fields rather than full rows, and hide the control. Record the choice in `docs/decisions.md`. Widening access is a product decision for the district owner, never an implementer default.

Denial matrix (each cell is an e2e test in `test/rbac/matrix.e2e.ts`, generated from this table):

| Action | member (club A) | president A | zrr (zone of A) | zrr (other zone) | dsc | project_admin (mission3011) | editing_team |
|---|---|---|---|---|---|---|---|
| GET /reports?filter[clubId]=A | 404/empty | 200 | 200 | empty | 200 | empty | 403 |
| PATCH /reports/:idA {status:submitted} | 403 | 200 | 403 | 403 | 403 | 403 | 403 |
| POST /reports/:idA/queries | 403 | 403 | 200 | 404 | 200 | 403 | 403 |
| PATCH /clubs/A/points?month= (judged) | 403 | 403 | 403 | 403 | 200 | 403 | 403 |
| GET /clubs/A/points | 200 | 200 | 200 | 404 | 200 | 404 | 403 |
| GET /clubs/B/points (as A-scoped) | 404 | 404 | 404 (B other zone) | n/a | 200 | n/a | 403 |
| PATCH /clubs/A/facts | 403 | 403 | 403 | 403 | 200 | 403 | 403 |
| PATCH /members/:idInA {status:approved} | 403 | 200 | 403 | 403 | 200 | 403 | 403 |
| PATCH /members/:idInB {status:approved} (as president A) | 403 | 404 | n/a | n/a | 200 | n/a | 403 |
| POST /projects (submit) | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| PATCH /projects/:idLeadA {status:published} | 403 | 403 | 200 | 404 | 200 | 403 | 403 |
| PATCH /content-blocks/... {publish} | 403 | 403 | 403 | 403 | 403 | 403 | 200 |
| PATCH /point-rules/:id | 403 | 403 | 403 | 403 | 403 | 403 | 403 (super_admin only via grant) |
| POST /roles, POST /user-roles | 403 | 403 | 403 | 403 | 403 | 403 | 403 (super_admin only) |
| POST /announcements audience={clubIds:[B]} (as president A) | 403 | 403 | 403 | 403 | 200 | 403 | 403 |
| PATCH /mission3011/camps/:id {status:approved} | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| PATCH /drishti/beneficiaries/:id (as mission3011 admin) | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| GET /directory (opted-in only) | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| GET /audit | 403 | 403 | 403 | 403 | 200 | 403 | 403 |

Super Admin passes every cell. Where the table says 404 for a list, the response is 200 with `items: []` (`empty`).

---

## 5. API design (locked)

### 5.1 Conventions

1. **Resources are nouns, plural, at most two levels deep** (`/clubs/:clubId/facts`). No verbs in paths. Actions are state changes expressed as `PATCH` on the resource with the fields that change; the service validates the transition. Example: submitting a report is `PATCH /reports/:id { status: 'submitted' }`, not `POST /reports/:id/submit`.
2. **One list route per resource** with filtering, sorting and paging via query params: `?filter[status]=submitted&filter[clubId]=…&sort=-submittedAt&page=1&pageSize=25&q=`. Response `{ items, total, page, pageSize }`. Scope filtering is applied automatically from the caller's grants; clients never pass scope for security, only for narrowing.
3. **Field selection via `include`**: `?include=clubs,queries` adds related sub-objects; default responses are shallow. This replaces most `/x/:id/subthing` GET routes.
4. **Public read = same resource, different prefix**: `/public/<resource>` routes are unauthenticated, return only published/approved rows and only public fields, and set `Cache-Control`. They share repositories with the authenticated routes; the public controller applies a `publicView` transformer.
5. **Bulk and estimate operations are `POST` on a collection-level sub-resource** that is not a stored entity: `POST /members/imports` (creates an import job resource), `POST /announcements/estimates`.
6. **Errors**: `400` validation `{ statusCode, error:'ValidationError', details:[{path, message}] }`, `401`, `403` (permission missing), `404` (missing or out of scope), `409` (state/uniqueness conflict, `code` field: `PRIVACY_NOT_ACCEPTED`, `ALREADY_EXISTS`, `INVALID_TRANSITION`, `CAPACITY_FULL`, `SLOT_TAKEN`), `429`.
7. **Versioning**: none in the path. Breaking changes are made by adding fields; removing a field requires a deprecation note in `docs/api-changes.md` and a two-release window.
8. **Idempotency**: `PUT` for full replacement of owned sub-collections (`PUT /clubs/:id/board`, `PUT /ride/delegations/:id/hosts`). `PATCH` is partial and idempotent for state fields.
9. **Route ownership**: exactly one controller per resource. When a feature needs a new capability on an existing resource, add a field or an `include` to the existing route; add a new route only for a new resource. Before adding any route, check the table below.

Standard verbs per resource: `GET /r`, `POST /r`, `GET /r/:id`, `PATCH /r/:id`, `DELETE /r/:id` (only where listed as allowed).

### 5.2 Route catalogue

Permissions in brackets; `own` = caller must be in scope of the row's `club_id`/`project_key`; `s` = scope filter applied to list.

| Resource | Routes | Notes |
|---|---|---|
| auth | `/auth/*` (Better Auth), `POST /auth/second-factor` `{method, code, rememberDevice}`, `POST /auth/second-factor/resend`, `GET/DELETE /auth/trusted-devices[/:id]` | |
| me | `GET /me`, `PATCH /me` `{profile fields, themePreference, directoryOptIn}`, `GET /me/qr.svg`, `GET /me/card`, `GET /me/club`, `GET /me/points`, `POST /me/privacy-acceptances` | `/me/*` are views of the caller's own member row; `/me/points` = `/clubs/:ownClubId/points` |
| members | `GET /members` [members:view, s] filters `status, clubId, q`; `POST /members` (no auth = self-registration; or [members:approve] to create approved directly); `GET/PATCH /members/:id` [members:approve, own] PATCH `{status:'approved'|'suspended'|'rejected', rejectionReason}`; `POST /members/:id/certificates` [members:approve, own]; `POST /members/:id/badges` [reports:score] `{badgeKey}` | approve/reject/suspend are one PATCH |
| member imports | `POST /members/imports` (multipart CSV) [members:import] → import resource `{id, rows[], status:'previewed'}`; `PATCH /members/imports/:id {status:'committed', rows?}` → result | preview and commit on one resource |
| directory | `GET /directory` [directory:view] filters `q, skill, interest, clubId, zoneId` | 409 PRIVACY_NOT_ACCEPTED |
| skill tags | `GET /skill-tags` | |
| roles | `GET/POST /roles`, `GET/PATCH/DELETE /roles/:id` [roles:manage]; `GET /permissions` | PATCH replaces `permissionKeys` |
| user roles | `GET /user-roles?filter[userId]=` , `POST /user-roles`, `DELETE /user-roles/:id` [roles:manage] | |
| audit | `GET /audit` [audit:view] filters `resourceType, resourceId, actorId, from, to` | |
| zones | `GET /zones` | |
| clubs | `GET /clubs` (auth) filters `zoneId, q`, `include=board,facts,summary`; `GET /clubs/:id` [clubs:view, own]; `PATCH /clubs/:id` [clubs:edit, own]; `PUT /clubs/:id/board` [clubs:edit, own]; `GET/PATCH /clubs/:id/facts?ryYear=` [read: own club or reports:review; PATCH: club_facts:edit]; `GET /clubs/:id/points?ryYear=&month=` [own club member, or reports:review] → totals, per-month, per-category, and for a given `month` the full computed trace + judged entry; `PATCH /clubs/:id/points?month=` [reports:score] `{judgedPoints, reason}` or `{judgedPoints:null}` to remove | points live under club, no separate `/points/clubs` |
| content blocks | `GET /content-blocks?filter[pageKey]=` [content:edit]; `PATCH /content-blocks/:pageKey/:sectionKey` [content:edit] `{type?, draftValue?, publish?:true}` (publish requires content:publish) | one route for edit and publish |
| settings | `GET /settings` [settings:manage]; `PATCH /settings` [settings:manage] `{ [key]: value }` | bulk patch |
| asset links | `GET /asset-links?filter[status]=` [content:edit]; `PATCH /asset-links/:id {recheck:true}` | |
| public content admin | `GET/POST /achievements`, `/partners`, `/publications`, `/resources`, `/past-drrs`, `/district-team`, `/enquiries`, `/sister-club-requests` and `GET/PATCH/DELETE …/:id` [public_content:manage; enquiries PATCH `{status, assignedToId}`; sister-club POST by any president/secretary]; `PATCH` accepts `order` for reordering | |
| report schemas | `GET /report-schemas` [reports:submit → active only; requests:manage → all]; `POST /report-schemas` [requests:manage] (clones active into a draft); `PATCH /report-schemas/:version` [requests:manage] `{fields?, status:'active'}` | publish = PATCH status |
| reports | `GET /reports` [reports:submit own / reports:review s] filters `clubId, ryYear, month, status`, `include=queries,club,points`; `POST /reports` `{clubId, month}` → draft (409 if exists); `GET /reports/:id`; `PATCH /reports/:id` [reports:submit, own] `{values?, notes?, status?:'submitted'}` ; `GET /reports/:id/assist` [reports:score] | overview screen = `GET /reports?month=&include=club,points` |
| report queries | `POST /reports/:id/queries` [reports:review, own] `{question}` → report status queried; `PATCH /reports/:id/queries/:queryId` [reports:submit, own] `{reply}` → report status submitted | |
| report requests | `GET/POST /report-requests` [requests:manage; GET also reports:submit for open ones]; `GET/PATCH/DELETE /report-requests/:id`; `PUT /report-requests/:id/responses/:clubId` [reports:submit, own] `{answers}` | |
| point categories | `GET /point-categories` | |
| point rules | `GET /point-rules?ryYear=`; `POST /point-rules`, `PATCH /point-rules/:id` `{…fields, tiers?, isActive?}` [point_rules:manage] | tiers replaced inline |
| projects (showcase) | `GET /projects` [showcase:submit → own submissions; showcase:publish → queue, s] filters `status, clubId, category`, `include=clubs`; `POST /projects` [showcase:submit]; `GET /projects/:id`; `PATCH /projects/:id` [owner: content fields + `status:'submitted'`; showcase:publish: `publishedTitle/Summary/Body, editorNotes, status:'published'|'rejected', rejectionReason`]; `DELETE /projects/:id` (owner, draft only) | |
| effort | `GET /effort-entries` [effort:log all / effort:approve s / own for kind self] filters `clubId, status, memberId, kind`; `POST /effort-entries` [effort:log → approved admin entry; any member → kind self pending]; `PATCH /effort-entries/:id` [effort:approve, own] `{status:'approved'|'rejected', rejectionReason}` or [reports:score] `{pointsAwarded, reason}` | contributions = same resource with `kind=self` |
| badges, certificates | `GET /badges`; `GET /me/badges`; `GET /me/certificates`; `GET /certificates/:id.pdf` (owner or own-club officer) | |
| events | `GET /events` filters `from, to, clubId, isDistrictEvent, projectKey`, `include=rsvp,attendance`; `POST /events` [events:manage, or club_events:log with own clubId and isDistrictEvent=false]; `GET/PATCH/DELETE /events/:id` [same]; `PUT /events/:id/rsvp` `{status}` (member); `GET /events/:id/checkins` [events:checkin]; `POST /events/:id/checkins` [events:checkin] `{qrToken|memberId|walkInName+clubId}` | attendance per club = `include=attendance` |
| feedback | `GET /feedback` [feedback:review all / own submissions] filters `status, eventId`; `POST /feedback` [feedback:submit]; `PATCH /feedback/:id` [feedback:review] `{status, reply}` | |
| announcements | `GET /announcements` (feed for caller; `filter[sent]=true` for senders' history) ; `POST /announcements` [announcements:send, audience within scope unless announcements:send_all]; `GET /announcements/:id`; `PATCH /announcements/:id` `{readAt:'now'}` (marks read for caller) or `{sendAt}` (reschedule before sent); `POST /announcements/estimates` `{audience}` → `{count, byChannel}` | read = PATCH |
| push | `GET /push/vapid-key`; `POST /push-subscriptions`; `DELETE /push-subscriptions/:endpoint` | |
| drr bookings | `GET /drr-bookings` [drr_calendar:manage] filters `status, from, to`; `PATCH /drr-bookings/:id` `{status:'confirmed'|'declined', decisionReason}`; `GET/POST/DELETE /drr-blocks[/:id]`; `GET /drr-calendar/status` | |
| mission3011 | `GET /mission3011/camps` [auth] filters `status, clubId`; `POST /mission3011/camps` (president/secretary); `GET/PATCH /mission3011/camps/:id` [owner edits while submitted; subdomain:mission3011:manage `{status:'approved'|'rejected', rejectionReason}`] | |
| drishti | `GET/POST /drishti/beneficiaries` [subdomain:drishti:manage, or president/secretary create for own club]; `GET/PATCH /drishti/beneficiaries/:id` `{stage, surgery?:{hospital, operatedOn, outcome}}` | |
| rcl | `GET/POST /rcl/teams`, `GET/PATCH /rcl/teams/:id` (roster inline `players[]`); `GET/POST /rcl/fixtures`, `PATCH /rcl/fixtures/:id` `{scheduledAt?, venue?, status?, result?}` [subdomain:rcl:manage] | result is a field of fixture |
| careerbridge | `GET /careerbridge/listings` [subdomain:careerbridge:manage] filters `status`; `PATCH /careerbridge/listings/:id` `{status:'verified'|'rejected'|'filled'|'expired', rejectionReason}` | posting is public (below) |
| ride | `GET/POST /ride/support-clubs`, `PATCH /ride/support-clubs/:id` (own club); `GET/POST /ride/delegations`, `GET/PATCH/DELETE /ride/delegations/:id` [subdomain:ride:manage]; `PUT /ride/delegations/:id/hosts` `{hosts[]}`; `GET/POST/DELETE /ride/gallery-items[/:id]` | |
| files | `POST /files/grants` (session + owning permission per §3A table), `PATCH /files/grants/:grantId` `{providerKey}`, `GET /files/:id` (public tiers 301 to CDN; private tier RBAC-checked stream), `DELETE /files/:id` (owning permission) | §3A |
| health | `GET /health`, `GET /ready` | |

### 5.3 Public routes (no auth, cached 60s unless noted)

| Route | Returns |
|---|---|
| `GET /public/home` | hero blocks, stats, flagship cards, 4 latest published projects, visits |
| `POST /public/visits` | increments year counter (no cache, 1/min/IP) |
| `GET /public/clubs?zoneId=` , `GET /public/clubs/:slug?include=board,projects` | club cards / club page |
| `GET /public/projects?category=&clubSlug=&page=` , `GET /public/projects/:slug` | published projects only, published copy |
| `GET /public/past-drrs[/:slug]` , `GET /public/district-team` , `GET /public/achievements` , `GET /public/partners` , `GET /public/publications` , `GET /public/resources` | as named; locked resources without `url`; pending partners without `logoUrl` |
| `GET /public/content/:pageKey` | published blocks |
| `GET /public/initiatives` | five project cards with active/lead/summary/unreachable |
| `GET /public/events?from=&to=` , `GET /public/events/:slug` , `GET /public/events/:slug.ics` , `GET /public/calendar.ics` | district events |
| `GET /public/drr-availability?month=` , `POST /public/drr-bookings` (3/h/IP) , `GET /public/drr-bookings/:reference` | booking flow |
| `POST /public/enquiries` (5/h/IP, honeypot) | new club / sponsor / contact |
| `GET /public/projects-summary/:key` | one subdomain summary (also used by `/public/initiatives`) |
| `GET /public/mission3011/dashboard` , `GET /public/drishti/dashboard` , `GET /public/rcl/standings?season=` , `GET /public/rcl/fixtures?season=` , `GET /public/ride/delegations` , `GET /public/ride/gallery?year=` | subdomain public pages |
| `GET /public/careerbridge/listings?type=&mode=&q=` , `GET /public/careerbridge/listings/:id` , `POST /public/careerbridge/listings` , `PATCH /public/careerbridge/listings/:id` `{verifyToken}` | listing board; PATCH with token = email verification |

Total: 34 authenticated resources, 15 public groups. Any route not in these tables must be justified in `docs/api-changes.md` before it is added.

---

## 6. Algorithms (implement exactly)

### 6.1 Points engine (`src/points/engine/`)

Types:
```ts
type RuleInput = { value?: number; numerator?: number; denominator?: number; count?: number };
type Trace = { ruleId: string; ruleKey: string; label: string; categoryKey: string; inputs: RuleInput; tierMatched?: {min:number; max:number|null}; points: number };
```
`evaluateRule(rule, input, alreadyAwardedOnce: boolean): Trace | null` (pure):
- `flat`: points = `rule.points` if `input.value` is truthy (number > 0 or true), else null.
- `per_unit`: units = `input.count ?? input.value ?? 0`; if `perUnitCap` set, `units = min(units, cap)`; points = units × rule.points; null when units = 0.
- `tiered`: x = ratio rule? (`denominator > 0 ? numerator/denominator*100 : null`) : `input.value`; null when x is null; tier matched = first tier with `min <= x && (max == null || x < max)`; points = tier.points.
- `penalty`: same as flat but `rule.points` is negative in seed; applies when `input.value` truthy.
- `period === 'once' && alreadyAwardedOnce` → null.

`PointsEngine.recompute({ clubId, ryYear, month?, trigger })` inside one transaction:
1. Load active rules for `ryYear`.
2. For each rule, ask the adapter for `sourceType` to produce inputs: `adapter.inputs({ clubId, ryYear, month, rule })` returning `{ periodKey, input }[]` (monthly rules: one per month in scope: the given month, or all months July..current when `month` omitted; yearly: one with `periodKey = String(ryYear)`; once: one with `periodKey = 'once'`).
3. For each (rule, periodKey): evaluate; upsert `club_point_entries` computed row by `(clubId, ruleId, periodKey)` with points + trace; delete the row when evaluation is null.
4. Delete computed rows for this club/ryYear whose rule is inactive or deleted.
5. Emit `points.recomputed {clubId, ryYear}`.

Adapters (`PointSourceAdapter` interface, one class each, registered in a map by `sourceType`):
- `report_field`: reads submitted reports for the club/month(s); `input.value|count` = numeric coercion of `values[sourceKey]` (arrays → length; booleans → 1/0); for ratio rules reads `numeratorKey`/`denominatorKey`. Special key `filed_on_time` → `Report.filedOnTime`.
- `club_fact`: reads `club_facts` row; keys map to columns: `dues_paid_bracket` (tiered by months after 31 July: paid by 31 Aug → 0, by 30 Sep → 1, later/unpaid after 30 Sep → 2), `ri_citation_completed`, `paul_harris_fellows`, `dual_members`, `mdio_committee_members`, `mdio_events_attended`, `sister_club_signed`, `drr_visit_completed`, `active_social_handles`, `club_merchandise`, `retention_ratio` (numerator = approved member count now, denominator = `priorYearMemberCount`), `skills_adoption_ratio` (numerator = approved members with ≥1 skill, denominator = approved members).
- `event_attendance`: per district event in the month: numerator = checkins for club, denominator = approved members of club; a monthly rule receives the average ratio across the month's district events (null when none).
- `project_collaboration`: `count` = number of `project_clubs` for published projects where club is lead, per month of `publishedAt`; the tiered rule uses the max collaborator count among that month's projects.
- `ride_hosting`: from `ride_delegation_hosts` for the club in the RY: `days_hosted` sum, `members_sent` sum, `hosted_and_sent` = 1 when both > 0.
- `club_events`: count of `events` with `clubId` and `isDistrictEvent=false` in the month.

Triggers: `report.submitted` → recompute(club, month); `club_facts` update → recompute(club, whole RY); `showcase.published` → recompute(lead club, month); check-in debounced → recompute(club, month); RIDE host row change → recompute(club, RY); rule change → BullMQ `points.recompute-all` iterating all active clubs.

Judged points: one row per (club, month) with `kind=judged, ruleId=null, categoryId = 'judged'` pseudo-category (seed a category with key `judged`, name "Officer judgement", order 99). Effort points are judged rows too, with `sourceType='effort'`.

### 6.2 RCL standings (`src/subdomains/rcl/standings.ts`, pure)
Win = 2 points, tie/abandoned = 1 each, loss = 0. NRR = (runs scored / overs faced) − (runs conceded / overs bowled), overs as decimal overs converted to balls (`4.3` → 27 balls). Sort by points desc, then NRR desc, then wins desc, then name. Bonus/penalty via settings `rcl.pointsWin`, `rcl.pointsTie` override defaults.

### 6.3 DRR slot generation (`src/drr-calendar/slots.ts`, pure)
Inputs: settings `drr.workingDays` (0–6), `drr.dayStart` ("10:00"), `drr.dayEnd` ("19:00"), `drr.slotMinutes` (60), `drr.bufferMinutes` (30), `drr.monthsAhead` (9), `drr.blackoutDates` (YYYY-MM-DD[]), Google busy intervals, `drr_blocks`, bookings with status `held|confirmed|requested`. Output: slots in Asia/Kolkata, excluding any slot that overlaps a busy interval ± buffer. Past slots excluded. Google failure → `status:'unreachable'`, slots computed without busy data but the UI shows the unreachable banner and booking creates `requested` without a Google event.

### 6.4 Link health (`src/link-health/`)
`check(url)`: if host is `drive.google.com` or `docs.google.com` → extract file id (`/d/<id>` or `?id=`) → `drive.files.get({fileId, fields:'id,mimeType'})` with the service account → ok; 404 → broken; 403 → private. If host is `photos.app.goo.gl`/`photos.google.com` → HTTP GET follow redirects, 200 → ok. Otherwise HTTP HEAD (fallback GET on 405), 2xx → ok, 4xx/5xx/timeout(8s) → broken. Nightly repeatable job (`0 2 * * *` IST) rechecks every `asset_links` row; status transition ok→broken/private notifies `ownerUserId` (template `link-broken`) once per transition.

### 6.5 Email provider pool (`src/notifications/email/`)
Providers in order: **`oracle` (Oracle Cloud Email Delivery, primary, cap env `ORACLE_DAILY_CAP` default 100)**, then `resend` (`RESEND_DAILY_CAP` default 100), `mailgun` (100), `gmail` (500) - about 800/day pooled. Oracle is SMTP (nodemailer, `smtp.email.<region>.oci.oraclecloud.com:587`, STARTTLS, IAM SMTP credentials) and is tried first for every message. `pick(day)`: first provider whose `email_provider_usage.count < cap` and not marked failed in the last 10 minutes (in-memory). Increment count atomically (`INSERT ... ON CONFLICT DO UPDATE count = count + 1 RETURNING count`) before sending; on send error mark provider failed and try the next; if all fail, outbox row `failed` with error, BullMQ retries with backoff 1m, 10m, 1h (3 attempts). `MAIL_DRIVER=console` logs instead of sending. In non-production, recipients not in `MAIL_ALLOWLIST` are rewritten to the first allowlisted address with the original address prepended to the subject.

### 6.6 Announcement audience resolution
`resolve(audience) → userIds`: union of (users holding any `roleKeys` role) ∩ (if `zoneIds` or `clubIds` given: users whose profile club is in those zones/clubs, plus role holders scoped to those zones/clubs) ∪ explicit `memberIds`. Empty audience object = nobody (400).

### 6.7 Milestones and badges (`src/badges/evaluators.ts`)
Badges seeded: `first_project` (showcase published where submitter), `events_10`, `events_25` (checkins count), `hours_25`, `hours_100` (approved effort hours), `service_1y`, `service_3y` (membershipAnniversary), `phf` (club_facts increments cannot attribute; instead a manual `POST /members/:id/badges/phf` by dsc). Evaluate on events `showcase.published`, `checkin.created`, `effort.approved`, nightly `badges.anniversaries`. Certificates issued automatically for `service_1y/3y`, `hours_100`; PDF via pdfkit: A4 landscape, Montserrat (bundle TTF in `assets/fonts`), pink `#D81B60` rule line, district logo top-left (`assets/district-logo.jpg`), name 36pt, title 18pt, issued date, reference id, signature line "District Rotaract Representative".

### 6.8 Legacy report compatibility
`sections_json` from schema version 1 has keys `clubMeetings, clubServices, communityServices, internationalServices, vocationalServices, districtProjects`, each an array of activity objects (`eventName, date, venue, areaOfFocus, clubStrength, initiatedBy, ...`). Seed `report_form_schemas` version 1 as `retired` with one `textarea` field per legacy section (fieldKey = legacy key) so history renders. Version 2 (active) fields, in order, section "Monthly activity log": `activities` (type `list` of activity rows is NOT a field type: instead model the monthly report as repeated activity rows: fields below apply per activity, and `values.activities` is an array of objects validated against these fields):
`activity_title text required`, `activity_date date required`, `avenue select required [community, club, international, vocational, district, flagship]`, `area_of_focus select required [7 Rotary areas]`, `initiated_by select required [rotaract, rotary, other]`, `people_reached number`, `members_participated number required`, `collaborating_clubs clubs`, `is_physical boolean`, `photo_links link (multiple)`, `showcase_summary textarea`. Section "Club": `physical_meetings number required (pointSourceKey physical_meetings)`, `virtual_meetings number`, `new_members_inducted number (new_members)`, `members_left number`, `social_posts number (social_posts)`. Section "Notes": `notes textarea`. `report_field` adapter derives: `camps_organised` = activities with avenue community and title/area matching health/blood/polio, `projects_initiated` = activities with initiated_by rotaract, `vocational_workshops` = activities with avenue vocational, `flagship_continued` = any activity with avenue flagship, `international_activities` = avenue international, `max_collaborators` = max collaborating_clubs length. Implement these derivations in `src/points/adapters/report-field.derive.ts` with unit tests.

---

## 7. Notifications

`NotificationPort` (`src/notifications/notification.port.ts`):
```ts
export interface NotifyInput { template: TemplateKey; to: { userId?: string; email?: string }[]; data: Record<string, unknown>; channels?: ('email'|'push')[]; }
export abstract class NotificationPort { abstract notify(input: NotifyInput): Promise<void>; }
```
Implementation `NotificationDispatchService`: resolves users → emails and push subscriptions, renders template (`src/notifications/templates/<key>.ts` exporting `{ subject(data), html(data), text(data), push(data): {title, body, url} }`), inserts one outbox row per recipient per channel, enqueues `notifications.send {outboxId}`. Worker sends; push 410/404 deletes the subscription.

Template keys and triggers: `otp` (auth), `member-registered` (→ club president/secretary), `member-approved`, `member-rejected`, `report-queried`, `report-replied`, `report-scored`, `showcase-submitted` (→ president/secretary), `showcase-published`, `showcase-rejected`, `announcement`, `feedback-replied`, `booking-requested` (→ drr admins), `booking-confirmed`, `booking-declined`, `booking-reminder`, `link-broken`, `event-reminder` (24h before RSVP going), `enquiry-received` (→ routed person), `listing-verify` (Career Bridge poster), `listing-verified`, `camp-submitted`, `camp-approved`, `ride-host-assigned`, `contribution-approved`, `certificate-issued`.

---

## 8. Seed data (`prisma/seed-system.ts`: idempotent upserts)

8.1 Permissions (§4.3), roles (§4.4), zones (from distinct clubs.zone), `clubs.slug` = slugify(name), `clubs.zoneId`.
8.2 Point categories (order): community_services "Community Services", vocational_services "Vocational Services / Professional Development", international_services "International Services", club_services "Club Services", flagship "Flagship Projects", club_district "Club & District", reporting "Reporting to District", drr_visit "DRR Official Visit", membership "Membership Growth & Retention", rotary_international "Rotary International", public_image "Public Image", dues "District Dues", mdio "MDIOs Presence", judged "Officer judgement".
8.3 Point rules for ryYear 2026 (key · category · type · period · source · points/tiers):
- `cs_project_initiated` community flat monthly report_field:projects_initiated 20
- `cs_camp_organised` community per_unit monthly report_field:camps_organised 30
- `vs_workshops` vocational tiered monthly report_field:vocational_workshops tiers [0–4→10 per? no: use tiers min1 max5 →30, min5→60]
- `vs_vocational_centre` vocational flat once club_fact:vocational_centre 100
- `is_international_activity` international per_unit monthly report_field:international_activities 30
- `is_ride_hosting_days` international per_unit yearly ride_hosting:days_hosted 40
- `is_ride_visiting_days` international per_unit yearly ride_hosting:days_visited 30
- `is_ride_members_sent` international per_unit yearly ride_hosting:members_sent 30
- `is_ride_both` international flat yearly ride_hosting:hosted_and_sent 50
- `is_sister_club` international flat once club_fact:sister_club_signed 50
- `club_physical_meetings` club_services per_unit monthly report_field:physical_meetings 20 cap 4
- `club_virtual_meetings` club_services per_unit monthly report_field:virtual_meetings 10 cap 4
- `club_events_logged` club_services per_unit monthly club_events:count 10 cap 4
- `flagship_continued` flagship flat monthly report_field:flagship_continued 50
- `cd_attendance` club_district tiered monthly event_attendance:ratio tiers [25,50)→10 [50,75)→20 [75,100)→30 [100,∞)→50
- `cd_collaboration` club_district tiered monthly project_collaboration:max_collaborators tiers [2,6)→20 [6,11)→40 [11,∞)→60
- `rep_on_time` reporting flat monthly report_field:filed_on_time 20
- `drr_visit` drr_visit flat once club_fact:drr_visit_completed 40
- `mem_new_members` membership per_unit monthly report_field:new_members 10
- `mem_retention` membership tiered yearly club_fact:retention_ratio tiers [50,75)→20 [75,100)→30 [100,∞)→70
- `mem_skills_adoption` membership tiered yearly club_fact:skills_adoption_ratio tiers [50,∞)→60
- `ri_citation` rotary_international flat once club_fact:ri_citation_completed 100
- `ri_phf` rotary_international per_unit yearly club_fact:paul_harris_fellows 250
- `ri_dual_members` rotary_international per_unit yearly club_fact:dual_members 50
- `pi_social_handles` public_image per_unit monthly club_fact:active_social_handles 10 cap 5
- `pi_social_posts` public_image tiered monthly report_field:social_posts tiers [4,8)→10 [8,∞)→20
- `pi_merchandise` public_image flat once club_fact:club_merchandise 20
- `dues_timing` dues tiered yearly club_fact:dues_paid_bracket tiers [0,1)→50 [1,2)→30 [2,∞)→-500
- `mdio_committee` mdio per_unit yearly club_fact:mdio_committee_members 50
- `mdio_events` mdio per_unit yearly club_fact:mdio_events_attended 100
(The exact figures come from the official "Points System 2026-27" PDF held by Rahul; the `point_rules` admin screen lets the DRR correct any value after seeding. Where the PDF is available to the implementer, prefer its numbers and update this list.)
8.4 Settings defaults: `report.deadlineDay` 5; `compliance.thresholdMonths` 2; `feedback.allowAnonymous` false; `drr.*` per §6.3 (workingDays [1,2,3,4,5,6], dayStart "10:00", dayEnd "19:00", slotMinutes 60, bufferMinutes 30, monthsAhead 9, blackoutDates []); `subdomain.<key>.active` false and `.leadClubId` null for all five; `enquiry_routing` `{ new_club: {name:'', email:''}, sponsor: {...}, contact: {...} }`; `rcl.pointsWin` 2, `rcl.pointsTie` 1, `rcl.season` 2026; `careerbridge.expiryDays` 45; `home.stats` `{ zones: 4, focusAreas: 7, foundedYear: 1968, ageRange: '18–30' }`.
8.5 Content blocks (draft = published, so pages render): page `home` sections `hero_badge`, `hero_title`, `hero_subtitle`, `cta_primary`, `cta_secondary`, `footer_tagline`; `privacy-policy` `body` (richtext, placeholder legal text), `terms-of-service` `body`; `get-involved` `new_club_intro`, `sponsor_intro`; `contact` `intro`, `address`; `about` sections used by Heritage/Leadership intros.
8.6 Flagship cards (content block `home.flagship` list): Mahadan 9.0, Clean Yamuna & Green NCR, Digital Literacy Labs, Pediatric Health Screening, Youth Leadership Assembly: copy from mockup Home section.
8.7 `skill_tags`: skills [Photography, Video editing, Graphic design, Public speaking, Event management, Fundraising, Social media, Writing, Web development, First aid, Teaching, Music, Anchoring, Logistics], interests [Community Service, Club Service, International Service, Professional Development, Public Image, Environment, Health, Education].
8.8 Dev-only seed (`prisma/seed-dev.ts`, run when `SEED_DEV=1`): super admin `admin@rotaract3011.org` / `Admin@12345`, one president+secretary+3 members for the first 5 clubs, 3 submitted reports, 2 published projects, 2 district events with checkins, sample announcements: enough for every screen to show data.

---

## 9. Web application

### 9.1 Tokens (`src/styles/tokens.css`): exact
```css
@import "tailwindcss";
@theme {
  --font-sans: "Montserrat", ui-sans-serif, system-ui, sans-serif;
  --color-pink: #D81B60; --color-pink-hover: #C21350; --color-pink-light: #FDF0F5; --color-pink-subtle: #FBE4EC; --color-pink-bright: #F0407F; --color-pink-soft: #F7A8C4;
  --color-cranberry: #880E4F; --color-navy: #123499;
  --color-ink: #1E1E24; --color-ink-2: #4A4A5A; --color-ink-3: #71717A; --color-ink-4: #8E8A90;
  --color-cream: #FDF8FA; --color-cream-2: #F5F2F3; --color-canvas: #EFE9EC; --color-line: #F3E5EB; --color-line-2: #C9C4C7;
  --color-dark-0: #131316; --color-dark-1: #17171B; --color-dark-2: #18181B; --color-dark-3: #1B1B20; --color-dark-4: #2C2C33; --color-dark-plum: #1A0A12; --color-dark-plum-2: #2A1520; --color-dark-plum-3: #3A2029;
  --radius-card: 16px; --radius-control: 8px; --radius-pill: 999px;
  --shadow-card: 0 4px 15px rgba(216,27,96,0.04); --shadow-pop: 0 20px 50px rgba(216,27,96,0.14);
}
:root { --bg: var(--color-cream); --surface: #FFFFFF; --fg: var(--color-ink); --fg-2: var(--color-ink-2); --fg-3: var(--color-ink-3); --border: var(--color-line); --accent: var(--color-pink); --accent-hover: var(--color-pink-hover); --accent-fg: #FFFFFF; --accent-soft: var(--color-pink-light); }
[data-theme="dark"] { --bg: var(--color-dark-0); --surface: var(--color-dark-3); --fg: #F5F2F3; --fg-2: var(--color-line-2); --fg-3: var(--color-ink-4); --border: var(--color-dark-4); --accent: var(--color-pink-bright); --accent-hover: var(--color-pink-soft); --accent-fg: var(--color-dark-0); --accent-soft: var(--color-dark-plum-2); }
[data-surface="drishti"] { --accent: #1D4ED8; } [data-surface="rcl"] { --accent: #15803D; } [data-surface="careerbridge"] { --accent: #B45309; } [data-surface="ride"] { --accent: #0E7490; } /* mission3011 keeps pink */
```
Use semantic utilities: `bg-[var(--surface)] text-[var(--fg)] border-[var(--border)]` etc., or register them as `@utility` classes `bg-surface`, `text-fg`, `text-fg-2`, `text-fg-3`, `border-line`, `bg-accent`, `text-accent`, `bg-accent-soft`. Read the Subdomains Part 1 intro paragraph for each project's accent and replace the four hex values above with the ones it names.

### 9.2 App structure
- `src/main.tsx` → `resolveSurface(window.location.hostname)` (`mission3011.` prefix → `mission3011`, etc.; `localhost` uses `?surface=` query or `mission3011.localhost`) → picks router from `src/app/routes/<surface>.routes.tsx`.
- `src/app/providers.tsx`: QueryClientProvider (staleTime 30s), `AuthProvider` (fetches `/me`, exposes `me`, `can(key, scope?)`, `refresh()`), `ThemeProvider` (reads profile.themePreference → localStorage → system), `ToastProvider`.
- `src/lib/api.ts`: `apiFetch<T>(path, { method, body, schema })` with `credentials:'include'`, base `import.meta.env.VITE_API_ORIGIN`, throws `ApiError {status, message}`; 401 → `AuthProvider` clears `me`.
- `src/lib/permissions.ts`: `can(me, key, scope?)`.
- Route guards: `<RequireAuth/>` (redirect `/portal/login?next=`), `<RequirePermission key/>` (renders 403 page).
- `useDocumentMeta({ title, description, ogImage })` on every page.
- `scripts/generate-sitemap.ts` writes `public/sitemap.xml` from `src/app/routes/public-routes.ts` (static list) and `public/robots.txt`.

### 9.3 UI primitives (`src/components/ui/`, one file each, tests with Testing Library)
Foundations: `ThemeToggle`. Actions: `Button` (variants primary|secondary|ghost|danger|link; sizes md 44px, lg 52px; loading state), `IconButton`. Forms: `Input`, `Textarea`, `Select`, `Combobox` (searchable, keyboard), `MultiSelect` (chips), `TagInput`, `Checkbox`, `Radio`, `Switch`, `DateInput`, `RangeInput`, `Field` (label, hint, error, required mark), `Form` (react-hook-form-free: controlled state + Zod validation helper `useZodForm`). Data display: `Card`, `Badge` (tones neutral|pink|green|amber|red|blue), `Chip`, `Table` (responsive: collapses to stacked rows under 768), `KeyValue`, `Avatar` (photo or initials), `ImageSlot` (external URL; shows designed fallback on error: cream panel, small logo mark, caption "Photo unavailable"), `Stat`, `RadialGauge` (conic-gradient), `ProgressBar`, `Timeline`, `Skeleton`, `EmptyState`, `ErrorState`. Navigation: `Tabs`, `Breadcrumbs`, `Pagination`, `Stepper`, `SegmentedControl`, `SideNav`. Overlays: `Modal`, `Drawer`, `Popover`, `Tooltip`, `Menu`. Feedback: `Toast`, `Alert`, `InlineStatus` (checking|ok|broken|private for links). Layout & utility: `Container`, `Section`, `Divider`, `Kbd`, `VisuallyHidden`. Match the Design System file for each; `/__ui` route renders all in light and dark side by side.

### 9.4 Shells (`src/components/layout/`)
- `PublicHeader`: white bar 68px (60 tablet, 56 mobile), logo left, links Clubs & Map, Showcase, Initiatives, Heritage, Leadership, Resources; right: "Career Bridge" link + outlined "Club Portal" button; mobile: hamburger → Drawer.
- `PublicFooter`: dark `#18181B`, 4 columns (brand + The District / Get Involved / For Members), bottom row © and "N visits this year · counted server-side" from `/public/home.visits`.
- `PortalShell`: dark top bar (logo, club/scope switcher, user menu with theme toggle, logout), left sidebar groups: Overview (Dashboard, Announcements, Resources), Reporting (New report, History), Club (My club, Events, Showcase), Me (Profile, Contributions, Certificates, Settings), Admin (only items whose permission the user holds: Clubs, Score, Point rules, Report form, Requests, Showcase queue, Members, Directory, Effort log, Events, Feedback, Content, Roles, Settings, Audit). Mobile: collapsible drawer.
- `AdminShell` = PortalShell with admin group expanded by default.
- `SubdomainShell`: same header shape, project name + accent, links per §10, "Main site" link, session-aware.

### 9.5 Routes and screens

Each line: route → page component → data → mockup (file, screen). Implement every drawn state (loading skeleton, empty, error). All pages are mobile-first.

**Main surface, public**
- `/` HomePage → `/public/home` → Public Pages Part 1 §1. Hero snap strip (native `scroll-snap-type:x mandatory`, autoplay every 5s paused on hover/touch/reduced-motion), live counter card (increments `/public/visits` once per session), 4 stats, flagship expanding carousel (flex 6/1/1/1/1, hover/focus expands, 0.7s), showcase teaser grid 4→2→1, 4 CTA cards, footer.
- `/map` MapPage → `/public/clubs` → Part 1 §2. Leaflet + OSM tiles, zone filter chips, pin click → side panel (name, president + WhatsApp `https://wa.me/<digits>` + mailto, KPIs, "View full club profile" → `/leadership/clubs/:slug`), states: loading, tiles-failed banner, empty-zone.
- `/showcase` ShowcasePage → `/public/projects` → Part 1 §3; category filter chips, uniform-height grid, pagination. `/showcase/:slug` ShowcaseDetailPage → Part 1 §4 (photos gallery, lead + collaborating clubs, related). `/showcase/clubs/:clubSlug` ClubShowcasePage → Part 3 §22.
- `/heritage` HeritagePage → Part 1 §5 (grouped by term, non-contiguous terms shown as "2015-16 · 2018-19"); `/heritage/:slug` DrrProfilePage → Part 1 §6 (low-res portrait renders at fixed 160px with soft border, never upscaled beyond source).
- `/leadership` LeadershipPage → Part 1 §7 (core trio, DSC roster grid, club leadership list with search); `/leadership/clubs/:slug` ClubLeadershipPage → Part 1 §8 (board table with blood group, contacts, WhatsApp).
- `/initiatives` InitiativesPage → `/public/initiatives` → Part 2 §9 + Part 3 §23 (unassigned card state "Open for bidding"; unreachable → last figure + timestamp chip).
- `/resources` ResourcesPage → Part 2 §10 (6 category cards) ; `/resources/documents` (and `/resources/:category`) ResourceCategoryPage → Part 2 §11 (locked rows listed with lock badge and "Sign in" link; coming-soon rows name a month); `/resources/guest-kit` GuestKitPage (renders leadership bios/photos with copy buttons); `/resources/sister-club` SisterClubFormPage (auth required; posts to `POST /sister-club-requests`).
- `/publications` → Part 2 §12. `/get-involved/new-club` → Part 2 §13 (form → `/public/enquiries` kind new_club; success state names the routed person). `/get-involved/sponsor` → Part 2 §14 (range input 5k–5L with three computed numbers: meals/kits/units per settings `sponsor.ratios`; form kind sponsor). `/achievements` → Part 2 §15 (portrait certificates 3:4 at every width). `/partners` → Part 2 §16 (pending cells grey placeholder). `/contact` → Part 2 §17. `/calendar` CalendarPage → Part 2 §18 (month grid + list; RSVP button when logged in; "Download year calendar" → `/public/calendar.ics`); `/calendar/:slug` EventPage (RSVP, feedback link after event).
- `/drr-calendar` DrrCalendarPage → Part 3 §19 (states checking/unreachable); `/drr-calendar/book/:slot` BookingPage → Part 3 §20 (form + confirmation with reference); `/drr-calendar/admin` → Part 3 §21 (RequirePermission drr_calendar:manage).
- `/privacy-policy`, `/terms-of-service` → Part 3 §24, §25 (content block richtext).
- `/portal/login` LoginPage → Portal Part 1 §1 (email+password → second-factor step with TOTP/email toggle, resend with countdown, remember device checkbox).
- `/portal/register` RegisterPage, `/portal/pending` PendingPage (Portal Admin Part 2 §10 caption describes the pending state).

**Main surface, portal (RequireAuth, PortalShell)**
- `/portal/dashboard` → role-aware: officer (reports:review) → OfficerDashboard (Portal Part 1 §11); president/secretary → ClubDashboard (Portal Part 1 §2: report status, points trend + per-category split, announcements); member → MemberDashboard (Portal Part 2 §15); DAC member → Portal Part 2 §14 variant.
- `/portal/reports/new` NewReportPage (Portal Part 1 §3): schema-rendered, activity rows add/remove, autosave draft every 10s and on blur, "Notes for the district" textarea. `/portal/reports/:id/review` ReviewSubmitPage (§9). `/portal/reports/history` (§4). `/portal/reports/:id` ReportDetail incl. queried thread (§10).
- `/portal/announcements` (Portal Part 1 §5). `/portal/resources` (Portal Part 2 §13: unlocked rows for the caller).
- `/portal/my-club`, `/portal/events` ClubEventTracker (Portal Admin Part 1 §8), `/portal/showcase/submit` (Portal Admin Part 3 §17), `/portal/showcase/mine`.
- `/portal/me` MemberCard (Portal Admin Part 2 §16), `/portal/me/profile` (Part 3 §18), `/portal/me/settings` (Part 3 §19: theme, 2FA, trusted devices, push permission button), `/portal/me/contributions`, `/portal/me/certificates`.
- `/portal/directory` (Portal Admin Part 2 §11; privacy gate modal when not accepted). `/portal/feedback` (Part 2 §15 member side).

**Main surface, admin (RequirePermission per route)**
- `/portal/admin/clubs` AdminClubs (Portal Part 1 §6) → `/reports?include=club,points`.
- `/portal/admin/clubs/:clubId/:month` ScoreMonth (Portal Admin Part 1 §1): computed per category with expandable trace, one judged input + reason, save, query; "Assist" button (reports:score) shows suggestions panel from `/reports/:id/assist`.
- `/portal/admin/clubs/:clubId/facts` ClubFacts (Part 1 §3). `/portal/admin/point-rules` (Part 1 §2). `/portal/admin/report-form` FormBuilder (Part 1 §4: field list with drag handles or up/down buttons, add field drawer, preview, publish version). `/portal/admin/requests/new` + `/portal/admin/requests` (Part 1 §5). `/portal/content` ContentEditor (Part 1 §6). `/portal/admin/roles` (Part 1 §7). `/portal/admin/events/:slug` EventCheckIn (Part 2 §9: camera QR via `@zxing/browser`, manual search, walk-in, live per-club counts). `/portal/members` MembersApprovals (Part 2 §10) + import wizard (upload → preview table → commit → report). `/portal/admin/effort-log` (Part 2 §12). `/portal/admin/announcements` Compose (Portal Part 2 §12) with `/portal/admin/announcements/audience` AudienceBuilder (Portal Admin Part 2 §13, live estimate). `/portal/admin/settings` (Part 2 §14). `/portal/admin/feedback` (Part 2 §15). `/portal/admin/showcase` ShowcaseQueue (Portal Part 1 §7: submitted text verbatim left, editable published copy right). `/portal/admin/users` (Portal Part 1 §8: user roles management, grant/revoke scoped roles). `/portal/admin/events` EventsAdmin (CRUD). `/portal/admin/public-content/*` simple CRUD tables for achievements/partners/publications/resources/past-drrs/district-team. `/portal/admin/audit`.

**Subdomain surfaces**: see §10 for routes; shells use `SubdomainShell`.

### 9.6 Frontend behaviours that are easy to get wrong
- Never block the page with a full-screen loader; use skeletons in place.
- Forms: disable submit while pending, show field errors from Zod (client) and from API 400 `details[]` (server).
- Lists: URL-synced filters (`useSearchParams`).
- Images: always `ImageSlot`, never bare `<img>` for external URLs.
- Push permission: only requested from the Settings page button or after the first announcement is opened (`sessionStorage` flag), never on load.
- Dark mode: toggling sets `data-theme` on `<html>` and persists via `PATCH /me` when logged in.

---

## 10. Project subdomains

Each project module in the API lives in `src/subdomains/<key>/` and exports `summary(): Promise<ProjectSummary>` where `ProjectSummary = { headline: string; value: number; target?: number; unit: string; secondary: {label: string; value: number|string}[]; updatedAt: string }`. Each web surface has `src/app/routes/<key>.routes.tsx` + `src/features/<key>/`.

**mission3011** (Subdomains Part 1 §1–3). Routes: `/` and `/dashboard` (progress vessel: CSS-only filling container to `units/3011`, units by zone bars, latest approved camps, per-club table), `/camps` (list + "Log a camp" form: president/secretary of any club; fields date, venue, city, units, donors, partner blood bank, participating clubs multi-select, photo links), `/admin` (subdomain:mission3011:manage: approvals desk approve/reject with reason). API: `GET /mission3011/camps?status=`, `POST /mission3011/camps`, `POST /mission3011/camps/:id (PATCH status)`, `GET /public/mission3011/dashboard`. Approved camps only count. Summary value = Σ units approved, target 3011.

**drishti** (Part 1 §4–6). Routes: `/dashboard` (100-surgery target gauge, pipeline counts, hospitals, per-club), `/beneficiaries` (log a patient form; list with stage filter; phone shown masked `••••1234` unless project admin), `/surgeries` (pipeline board columns screened→scheduled→operated→followup→closed with "Move to" buttons; keyboard accessible; each move records a surgery row when entering operated). API: `GET/POST /drishti/beneficiaries`, `PATCH /drishti/beneficiaries/:id {stage, surgery?}`, `GET /public/drishti/dashboard`. Phone encrypted with AES-256-GCM (`DRISHTI_PII_KEY`), decrypted only for project admins. Summary value = operated count, target 100.

**rcl** (Part 1 §7–9). Routes: `/standings` (public), `/fixtures` (public; admin enters results inline), `/register` (president/secretary: one team per club per season, roster up to 15). API: `GET/POST /rcl/teams`, `PATCH /rcl/teams/:id`, `GET/POST /rcl/fixtures`, `PUT /rcl/fixtures/:id (PATCH result)`, `GET /public/rcl/standings`, `GET /public/rcl/fixtures`. Summary value = teams registered.

**careerbridge** (Part 2 §10–13). Routes: `/opportunities` (public browse with filters, verified+filled listings; filled shown with "Filled" badge), `/:id` (detail; apply URL / contact reveal button), `/post` (public form; honeypot; success "check your email"), `/admin` (verification desk: pending list, verify/reject/mark filled/expire; posted-vs-filled counters). Expiry job daily marks verified listings older than `careerbridge.expiryDays` as expired. Summary value = verified open listings, secondary filled count.

**ride** (Part 2 §14–17). Routes: `/incoming` (public list of delegations with dates, headcount, assigned host clubs), `/support-club` (president/secretary registration form: capacity, homestay, preferred months, contact; one per club per RY; editable), `/gallery` (public; year tabs; photos via ImageSlot, videos embedded for youtube.com/youtu.be/drive.google.com/file), `/admin` (subdomain:ride:manage: delegations CRUD; host assignment drawer listing registered support clubs with capacity and preferred-month match; add host row with days hosted and members sent; multiple hosts per delegation). API: `GET/POST /ride/support-clubs`, `GET/POST/PATCH /ride/delegations`, `PUT /ride/delegations/:id/hosts { hosts: {clubId, daysHosted, membersSent}[] }` (replaces set; audited; recompute for every affected club; notifies hosts), `GET/POST/DELETE /ride/gallery-items`. Summary value = delegations this RY, secondary host clubs count.

---

## 11. Deployment and configuration

### 11.1 Infrastructure (already exists)
- Postgres 18 container `rac3011-postgres` on the Oracle instance, reachable from the VPS as `10.44.44.2:5434`, db `rac3011`, user `rac3011`. Password in `~/.claude/secrets.md` under "RAC District 3011 Website: Postgres (Oracle)".
- VPS `15.235.211.41` runs Dokploy; Cloudflare proxies `rotaract3011.org`; origin cert `/etc/ssl/cloudflare/rotaract3011.pem` + `.key`.
- Redis: create Dokploy service `rac3011-redis` (redis:7, no public port).

### 11.2 Environment variables (exact names)
API: `NODE_ENV`, `PORT` (3000), `WORKER` (unset|1), `DATABASE_URL`, `SHADOW_DATABASE_URL` (CI only), `REDIS_URL`, `AUTH_SECRET` (32+ bytes), `AUTH_URL` (`https://api.rotaract3011.org`), `COOKIE_DOMAIN`, `WEB_ORIGINS` (comma list), `MAIL_DRIVER` (console|pool), `MAIL_FROM` (`Rotaract District 3011 <no-reply@rotaract3011.org>`), `MAIL_ALLOWLIST`, `ORACLE_SMTP_HOST`, `ORACLE_SMTP_PORT`, `ORACLE_SMTP_USER`, `ORACLE_SMTP_PASSWORD`, `ORACLE_DAILY_CAP`, `RESEND_API_KEY`, `RESEND_DAILY_CAP`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_DAILY_CAP`, `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD`, `GMAIL_DAILY_CAP`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:...`), `GOOGLE_SERVICE_ACCOUNT_JSON_B64`, `DRR_CALENDAR_ID`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `DRISHTI_PII_KEY` (32-byte hex), `STORAGE_DRIVER` (live|stub), `UPLOADTHING_TOKEN_PERMANENT`, `UPLOADTHING_TOKEN_DYNAMIC`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_PRIVATE`, `R2_BUCKET_BACKUPS`, `SENTRY_DSN`, `LOG_LEVEL`, `SEED_DEV`.
Web (build-time): `VITE_API_ORIGIN`, `VITE_SENTRY_DSN`, `VITE_VAPID_PUBLIC_KEY`.
Secrets and provisioned values live in `~/.claude/secrets.md` under "RAC District 3011 Platform" (UploadThing tokens, R2 keys, Oracle Email Delivery) - never in the repo.

### 11.3 Dokploy apps (project `rac3011`)
- `rac3011-api`: Docker image built by GitHub Actions to `ghcr.io/rbansal42/rac3011-api:main`; command default; domain `api.rotaract3011.org`; healthcheck `/health`. Run `prisma migrate deploy && npm run seed` as the container entrypoint pre-step (`docker-entrypoint.sh`).
- `rac3011-worker`: same image, env `WORKER=1`, no domain.
- `rac3011-web`: Dockerfile build from repo; domains `staging.rotaract3011.org` initially; at cutover add `rotaract3011.org`, `www.rotaract3011.org`, `mission3011.`, `drishti.`, `rcl.`, `careerbridge.`, `ride.rotaract3011.org`.
Cloudflare DNS: proxied `A` records for each hostname → `15.235.211.41`. Host nginx vhost per hostname proxying to Traefik `127.0.0.1:18080` with the origin cert (copy the existing `staging.rotaract3011.org` vhost).

### 11.4 Web CSP (nginx `add_header Content-Security-Policy`)
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.ufs.sh https://utfs.io https://*.tile.openstreetmap.org https://drive.google.com https://*.googleusercontent.com https://photos.google.com https://*.ggpht.com https://i.ytimg.com; media-src 'self' https://drive.google.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://drive.google.com; connect-src 'self' https://api.rotaract3011.org https://*.ingest.uploadthing.com https://*.ufs.sh https://*.sentry.io; worker-src 'self'; manifest-src 'self'`

### 11.5 CI (GitHub Actions, both repos)
API: `npm ci` → `npm run lint` → `npx prisma validate` → `npm run test` → `npm run test:e2e` (service container postgres:18 for shadow + testcontainers) → migration replay check (`prisma migrate deploy` on a fresh DB) → build image → push GHCR on `main` → call Dokploy redeploy API. Web: `npm ci` → `tsc -b` → `npm test` → `npm run build` → `npx playwright test` (against `vite preview` + API mock server in `e2e/mock-api.ts`) → Dokploy redeploy on `main`.

---

## 12. Acceptance tests (must exist and pass)

API e2e (supertest, real Postgres):
1. Login with legacy-migrated president → 2FA email OTP required → verify → `/me` shows `president` scoped to their club and `member` role.
2. President of club A `GET /reports/:idOfClubB` → 404. ZRR of Zone Prithvi lists `/reports?include=club,points` → only Prithvi clubs. DSC sees all.
3. Submit report with `physical_meetings=3`, two activities (one flagship, one community with 4 collaborating clubs) → `club_point_entries` has `club_physical_meetings=60`, `flagship_continued=50`, `cd_collaboration` tier [2,6)=20, `rep_on_time=20` when before deadline.
4. Update `club_facts.paulHarrisFellows=2` → `ri_phf` yearly entry 500; update again to 1 → 250 (idempotent replace). `drr_visit` once: set date twice → single entry 40.
5. Judged points without reason → 400; with reason → audit_log row with before/after.
6. Check-in 6 of 12 approved members of club X to a district event → `cd_attendance` = 20 for that month.
7. Member self-registers → president receives `member-registered` outbox row; approve → member sees `/me/club`; duplicate email register → 409.
8. CSV import with 3 rows: one existing (link), one new, one duplicated inside file (skip) → counts `{created:1, linked:1, skipped:1}`.
9. Directory: opt-in without privacy acceptance → 409; after acceptance → listed; non-opted members never appear.
10. Showcase: member submits with consent → president notified; DSC edits published copy and publishes → `/public/projects/:slug` returns published copy, not submitted text; collaborator clubs returned as objects with ids.
11. Announcement audience `{roleKeys:['secretary'], zoneIds:[Agni]}` estimate = number of secretaries of Agni clubs; sending creates one outbox row per recipient per channel; president targeting another club → 403.
12. Email pool: with usage oracle=100 and resend=100 for today → next send uses mailgun; when mailgun send throws → gmail used and outbox `provider='gmail'`.
13. DRR booking on a slot overlapping a Google busy interval → 409; valid → `requested` + `googleEventId` set (fake Google client); confirm → notification `booking-confirmed`.
14. RIDE: assign hosts `[A: 3 days, 2 members]` → A gets `is_ride_hosting_days=120`, `is_ride_members_sent=60`, `is_ride_both=50`; reassign to B → A's entries removed.
15. Career Bridge: post → `pending_email`; verify token → `pending`; verify by admin → visible in `/public/careerbridge/listings`; expiry job after N days → `expired` hidden.
16. RCL: two teams, one result 150/5 in 20 ov vs 120/8 in 20 ov → standings winner 2 pts, NRR +1.5/−1.5.
17. Link health: Drive id returning 404 from fake Drive client → status broken → owner gets `link-broken` once; rerun → no second notification.
18. Storage: `POST /files/grants` without a session → 401; with a member session for `resourceType=partner_logo` → 403; for `member_photo` on another member's row → 403; oversized/wrong MIME → 400; happy path grant → finalise → `files` row with tier `dynamic` and a CDN url. `GET /files/:id` for a private-tier file as a caller who cannot read the owning resource → 404; as an entitled caller → 200 stream. Deleting the owning row deletes the file through the port (stub adapter records the call).
19. Email pool: with Oracle usage at its cap for today → next send uses Resend; Oracle SMTP throwing → immediate failover to Resend with outbox `provider='resend'`.
20. `POST /public/visits` twice from same IP within a minute → second is 429; counter increments once.

Web (Vitest): every primitive renders in both themes; `resolveSurface` for all hostnames; `can()` matrix; NewReport autosave; ScoreMonth shows no input next to computed values; ImageSlot fallback on error. Playwright: each screen in §9.5 and §10 loads at 390/768/1440 with zero axe `serious`/`critical` violations, using `e2e/mock-api.ts` fixtures.

---

## 13. Build order

Do these in order; each step ends with green CI and a deploy to staging.
0. §1 scaffolds, §3 baseline + all models, §8 seeds, §9.1–9.3 tokens and primitives, `/__ui`.
1. §4 auth + RBAC + legacy user migration; login screen; shells; roles admin; `/me`.
2. §5.1 public API + all public pages (§9.5 public list) + visitor counter + sitemap.
3. Content/settings/link-health + admin public-content CRUD + content editor + district settings.
4. Reports (schema, builder, new report, review, history, queries, overview, requests, assist).
5. Points engine + rules/facts/scoring screens + dashboards.
6. Members (register, approve, import, profile, QR, directory, privacy gate, settings/2FA/trusted devices).
7. Showcase workflow + collaboration adapter.
8. Events, RSVP, check-in, club event tracker, attendance adapter, feedback.
9. Notifications (pool, push, outbox, worker), announcements + audience builder; wire every template trigger.
10. Effort log, contributions, badges, certificates.
11. DRR calendar (Google), booking, admin, reminders.
12. Mission 3011 + Drishti.
13. RCL + Career Bridge + RIDE (+ ride adapter).
14. Cutover: freeze legacy Supabase, reconcile rows changed since 2026-09-03, DNS for all hostnames, backups (`pg_dump` every 15 min → `onedrive:Backup/RAC3011-15min/`, daily 30d), rate limits, Sentry, full Playwright + axe + Lighthouse (≥90 mobile on Home/Map/Showcase), runbook `docs/runbook.md`, drop `user_profiles` and legacy text columns.

---

## 14. Caching and performance (locked 2026-09-05)

Rahul: "Website is slow to load. We need to use caching aggressively. Invalidation should happen whenever there is an update without fail. All public pages should be snappy and should not be waiting on database for information. Only some live data fields can have latency, but even for that we can prefetch data every 10 seconds."

Measured baseline (2026-09-05, from Delhi over Cloudflare): `/health` 0.5-3.1s, `/public/*` 0.31-0.67s, `cf-cache-status: DYNAMIC` on every API response (nothing edge-cached), SPA does HTML -> JS -> boot -> fetch as serial round trips. **The dominant cost is round-trip overhead to Oracle, not query time** - so the fix is to stop going to Oracle at all for public reads, and to stop going to Postgres when we do.

### 14.1 Three cache layers (all three are required)

| Layer | Where | Holds | TTL | Invalidated by |
|---|---|---|---|---|
| **L1 Edge** | Cloudflare cache rules on `api.rotaract3011.org/public/*` | Full JSON responses | `s-maxage` 600s, `stale-while-revalidate` 86400s | Explicit URL purge via CF API on every write (§14.4) |
| **L2 Origin** | Redis (`rac3011-redis`), `CacheService` | Serialized response DTOs | 3600s | Same write hook, by tag (§14.4) |
| **L3 Browser** | TanStack Query + `localStorage` persistence | Query results | `staleTime` 5 min, `gcTime` 24h | Version key + `stale-while-revalidate` refetch |

A public request that hits L1 never reaches Oracle. One that misses L1 but hits L2 never reaches Postgres. Only a cold miss touches the database.

### 14.2 Response headers (exact, per route class)

- **Public, cacheable** (`/public/*` except the two below): `Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400` + `Cache-Tag: <tags>` (comma-separated, §14.3) + `Vary: Accept-Encoding`.
- **Public, live** (`/public/home`'s visitor count, `/public/visits`): the *counter value is split out* of `/public/home` into `GET /public/live` (`Cache-Control: public, max-age=5, s-maxage=5`), so the rest of the home payload stays long-cached. `POST /public/visits` is `no-store`.
- **Authenticated** (everything else): `Cache-Control: private, no-store`. Never edge-cache anything behind auth - a scoped response leaking across users is the exact failure §4.8 exists to prevent. The Cloudflare cache rule matches only `/public/*` and must additionally bypass cache when a session cookie is present.

### 14.3 Cache tags (the invalidation vocabulary)

One tag per logical dataset, derived from the Prisma model(s) a response reads:
`clubs`, `zones`, `members`, `projects`, `events`, `heritage`, `district-team`, `achievements`, `partners`, `publications`, `resources`, `content`, `settings`, `initiatives`, `points`, `reports`.
Each cached endpoint declares its tags with a `@CacheTags(...)` decorator; the interceptor writes both the `Cache-Tag` header and the L2 Redis key's tag-set membership (`SADD tag:<tag> <key>`).

### 14.4 Invalidation - automatic, not remembered

**Requirement: "without fail."** Therefore invalidation is NOT the caller's responsibility. It is derived from writes:

1. A **Prisma client extension** (`src/prisma/cache-invalidation.extension.ts`) wraps every `create|createMany|update|updateMany|upsert|delete|deleteMany` on every model. After a successful write it resolves the model name to its tag(s) via a single `MODEL_TAG_MAP` and enqueues those tags for purge. No service can write to Postgres without this firing - that is the guarantee.
2. `CacheInvalidator.purge(tags)` then, in one operation: (a) `SMEMBERS tag:<tag>` -> `DEL` every L2 key -> `DEL tag:<tag>`; (b) resolves tags to the concrete public URL list via `TAG_URL_MAP` and calls Cloudflare's purge API. **Cloudflare purge-by-tag requires Enterprise; this account is not, so we purge by URL** (max 30 URLs per call, batch beyond that). `TAG_URL_MAP` must therefore be exhaustive - a route whose URL is missing from it will serve stale edge content, so §14.7's test enumerates every cached route and asserts it appears under at least one tag.
3. Purges are fire-and-forget through a BullMQ job (`cache.purge`) so a slow Cloudflare API call never blocks a mutation, with retry (3 attempts, exponential) and an error log if it ultimately fails. A failed edge purge is bounded by `s-maxage` (10 min worst case), never permanent.
4. Seed/migration runs set `CACHE_INVALIDATION=off` to avoid thousands of purges during a reseed, then purge everything once at the end (`purgeAll()` -> CF "purge by prefix" `api.rotaract3011.org/public/`).

### 14.5 Origin speed

- `CacheInterceptor` (L2) checks Redis before the controller body runs; a hit returns without touching services/repositories.
- Cold-miss cost is reduced by removing per-request `n+1`s in the public module: every `/public/*` repository method is a single query (or one query + one `count`), verified by asserting Prisma query counts in tests.
- `/public/home` is a single aggregate endpoint (already true) - the frontend must not fan out to five endpoints for the homepage.

### 14.6 Frontend

- `QueryClient` defaults: `staleTime: 5 * 60_000`, `gcTime: 24 * 60 * 60_000`, `refetchOnWindowFocus: false`, `retry: 1`.
- **Persisted cache**: `@tanstack/query-persist-client-core` + `localStorage`, `buster` = the build's git sha (injected as `VITE_BUILD_SHA`), so a new deploy invalidates client caches without stale-data risk. Repeat visits render instantly from localStorage, then revalidate in the background.
- **Live fields only**: the visitor counter (and anything else read from `/public/live`) uses `refetchInterval: 10_000` per Rahul's instruction. Nothing else polls.
- **Prefetch**: `queryClient.prefetchQuery` on nav-link `mouseenter`/`focus` for the target route's primary query, plus prefetch of `/public/clubs` and `/public/projects` after the home page is idle (`requestIdleCallback`).
- Route-level code splitting (`React.lazy`) for the portal/admin/subdomain trees so the public bundle carries only public pages. The current single eager bundle is ~480 kB; public-only should be well under half.
- `<link rel="preconnect">` to `api.rotaract3011.org` in `index.html` so the API's TLS handshake overlaps JS parse.

### 14.7 Verification (must exist)

1. Unit: `MODEL_TAG_MAP` covers every Prisma model that any `/public/*` response reads; `TAG_URL_MAP` covers every route registered with `@CacheTags`. Both are exhaustiveness tests that fail when a new model/route is added without a mapping.
2. e2e: `GET /public/clubs` twice -> second is served from L2 with zero Prisma queries (assert via a query-count spy); then `PATCH /clubs/:id` -> next `GET` reflects the change immediately (proves purge works end to end, with a fake Cloudflare client asserting the purge call carried the right URLs).
3. e2e: an authenticated route never returns a `Cache-Tag` header and always returns `private, no-store`.
4. Live check after deploy: `cf-cache-status` must be `HIT` on a second request to `/public/home`, and p50 for that endpoint from India must be under 100 ms (it is ~400 ms today).

### 14.7b Cloudflare Browser Cache TTL overrides the origin (found and fixed 2026-09-05)

Cloudflare's Free plan defaults **Browser Cache TTL to 4 hours** and *rewrites* the origin's `max-age` on the way out. Verified live: origin sent `public, max-age=60, s-maxage=600, stale-while-revalidate=86400`; the browser received `max-age=14400`.

This silently breaks the §14.4 invalidation guarantee - purging Cloudflare's edge cannot reach a browser cache, so a visitor who already loaded a page would serve stale content for up to 4 hours after an update.

Fix (applied, scoped): the cache rule now sets `browser_ttl.mode = "respect_origin"` alongside `edge_ttl.mode = "respect_origin"`. Verified after the change: browsers receive `max-age=60`, `/public/live` receives `max-age=5`, edge still `HIT`, and cookie-bearing requests still `DYNAMIC`. Worst-case post-purge browser staleness is now 60 s, not 4 h.

**Do not fix this with the zone-wide `browser_cache_ttl` setting** - that would change behaviour for every hostname in the zone, including the Vercel-hosted production apex. Keep it on the rule.

### 14.8 Origin path: Cloudflare Tunnel (decided 2026-09-05)

Diagnosis (measured from Delhi): Cloudflare serves this zone from **Singapore** (`cf-ray: …-SIN`; the free plan gets no India PoP), while the origin sits ~30 ms away in India. Requests therefore detour Delhi → Singapore → India → Singapore → Delhi. Cold request 520-580 ms, warm-connection request 141 ms, direct-to-origin 135 ms, origin app time ~30 ms. **~380 ms of the cold cost is TCP+TLS setup, not transfer.**

Rahul's decision: **Cloudflare Tunnel (free)**, not Argo (paid) and not un-proxying (which would forfeit WAF and edge cache).

- `cloudflared` runs on the Oracle box as a systemd service (ARM64 build), holding persistent, pre-warmed QUIC connections to Cloudflare's edge. This removes the per-request CF→origin TCP+TLS handshake, which is the dominant share of the cold-request cost.
- Create the tunnel through the **API**, not `cloudflared tunnel login` (that needs an interactive browser): `POST /accounts/{account_id}/cfd_tunnel` → run with `cloudflared tunnel run --token <token>`. Account `6df5d6f65155cc519f481070550102fc`.
- Ingress maps `api.rotaract3011.org` and `testing.rotaract3011.org` to the existing local Traefik entrypoint. DNS for those two hostnames changes from proxied `A → 92.4.95.94` to the tunnel `CNAME → <tunnel-id>.cfargotunnel.com` (proxied).
- **Scope limit:** only those two hostnames. Every other app on this box (racddl, healing-pouch, house-of-urve, bliss, rotaract-os, …) keeps its current proxied-A + Traefik path untouched. Record the prior A-record values so the change is reversible in one API call.
- Success criterion: cold `GET /public/home` materially below today's ~550 ms, and `cf-cache-status: HIT` still working on a second request (the tunnel must not break edge caching).

**ATTEMPT 1 FAILED AND WAS ROLLED BACK (2026-09-05).** The tunnel was created (`9e53fcd1-9627-45a4-800a-598586f8d92c`, 4 QUIC connections registered to bom03/06/08/11 - correctly Mumbai, which confirms the tunnel would have fixed the Singapore detour), DNS was cut to the tunnel CNAME, and **both hostnames immediately returned HTTP 530** (Cloudflare cannot reach origin). Production was down until DNS was reverted to proxied `A -> 92.4.95.94`; both hosts verified restored at content level, and `cloudflared` is now `disabled --now` so it cannot half-serve.

Root cause: the ingress pointed at `service: https://127.0.0.1:443` with `originServerName`/`httpHostHeader` set. Port 443 on that box is Dokploy's Traefik via docker-proxy; cloudflared's TLS handshake to it does not validate (Traefik presents a cert for the requested host from its own ACME store, and the origin-facing path is not what cloudflared expects), so no origin connection was ever established - hence 530 rather than a 404 passthrough.

Retry plan (do NOT cut production DNS blind again):
1. Add `noTLSVerify: true` to each ingress rule (or terminate at plain HTTP and stop Traefik's 80->443 redirect for tunnel traffic; port 80 currently answers `301`, which would loop).
2. Validate against a **throwaway hostname** (`tunnel-test.rotaract3011.org` -> tunnel CNAME) and confirm 200 + correct content there first.
3. Only then move `api.` and `testing.`, one at a time, with the prior A values recorded for instant rollback.
4. Re-measure cold/warm before deciding to keep it.

**ATTEMPT 2 SUCCEEDED (2026-09-04/05, same session day) - the root cause above was
wrong, correcting the record.** Re-ran with the identical ingress
(`service: https://127.0.0.1:443` + `originServerName`/`httpHostHeader`, no
`noTLSVerify`, no throwaway hostname) against the **same** tunnel resource
(`9e53fcd1-9627-45a4-800a-598586f8d92c` - creating a tunnel with a name that already
exists and isn't deleted returns the existing tunnel, it does not error or fork a new
one) and both hostnames eventually returned clean `200`s with correct content. TLS to
Traefik was never the problem: `openssl s_client -connect 127.0.0.1:443 -servername
api.rotaract3011.org` on the Oracle box returns a real, valid Let's Encrypt cert
(`CN=api.rotaract3011.org`), and a local `curl -sk https://127.0.0.1:443/health -H
'Host: api.rotaract3011.org'` succeeded in 11ms *throughout* the period both hostnames
were 530ing publicly - so the origin was never unreachable or TLS-invalid.

The actual cause was **Cloudflare edge routing-propagation lag after a DNS cutover or a
`cloudflared` (re)start** - observed twice: ~8 minutes after the initial DNS cutover,
and again for ~5 minutes after a live diagnostic restart of `cloudflared` broke the
*already-working* `testing.` hostname too. The tunnel API reported `healthy`/4
connections within seconds both times; the edge's per-hostname routing state took
minutes longer to catch up globally. Attempt 1 most likely rolled back during that same
propagation window rather than hitting a real config defect - **the retry plan above
(`noTLSVerify`, throwaway hostname, one-at-a-time) is unnecessary** for a future
attempt on this stack; the config that failed in Attempt 1 is the config that works.
The one operationally important lesson that *is* still valid: **don't restart
`cloudflared` casually** - budget ~5 minutes of possible 530s on both hostnames after
any restart, and push ingress changes via the remote `configurations` API (picked up
live, no restart) instead of touching the service where avoidable. Full verification
(40/40 clean requests, `cf-cache-status: HIT` on repeat `/public/home`, CORS intact,
before/after latency) and the rollback recipe are in `docs/infra.md` under "Cloudflare
Tunnel (`rac3011-oracle`)". Kept live, not rolled back.

### 14.9 Prerendered public pages (decided 2026-09-05, sequenced after §14.1-14.7)

Rahul approved prerendering the public pages **after** the caching layers land. Rationale: caching removes the origin round trip but the SPA still does HTML → JS → boot → fetch before first paint. Prerendering makes content arrive in the first response.

- Approach: build-time prerender of every static-content public route to real HTML (`vite-plugin-ssg`-style, or a small Puppeteer/`@prerenderer` pass over the built SPA), hydrating client-side afterwards. Keep the SPA for portal/admin/subdomain trees.
- Data at prerender time comes from the same `/public/*` endpoints; the emitted HTML therefore embeds a snapshot, and the client revalidates via the §14.6 query layer, so a stale snapshot self-corrects on hydrate.
- Routes with genuinely per-request data (`/public/live` counter) stay client-fetched inside otherwise-prerendered pages.
- Not started until §14.1-14.7 are deployed and re-measured.

---

## Appendix A. Reference model definitions (unchanged groups)

Models referenced from §3.3 "as in Appendix A". Superseded models (LegacyUserProfile, MonthlyReport, ProjectSubmission, Announcement with legacy columns) are NOT to be used; §3.3 is authoritative where they differ.



`prisma/schema.prisma`. Generator `prisma-client-js`, datasource postgresql `env("DATABASE_URL")`. All tables `@@map` to snake_case; all columns `@map` to snake_case (write them out; Prisma has no global mapping). Every model has `createdAt DateTime @default(now()) @map("created_at")` and `updatedAt DateTime @updatedAt @map("updated_at")` unless stated. IDs are `String @id @default(cuid())` unless stated. Enums are Prisma enums with the values listed.

### A.1 Baseline: legacy tables

The target database already contains `clubs`, `user_profiles`, `monthly_reports`, `project_submissions`, `announcements`. Step 1 is `prisma db pull`, then write the baseline migration with `prisma migrate diff --from-empty --to-schema-datamodel` and mark it applied with `prisma migrate resolve --applied <name>`. Keep `user_profiles` as `LegacyUserProfile @@map("user_profiles")` (read-only, dropped in §13 phase 14). Rename models: `clubs → Club`, `monthly_reports → MonthlyReport`, `project_submissions → ProjectSubmission`, `announcements → Announcement`.

### A.2 Identity, RBAC, audit

```prisma
model User {            // better-auth managed
  id String @id
  name String
  email String @unique
  emailVerified Boolean @default(false) @map("email_verified")
  image String?
  twoFactorEnabled Boolean @default(false) @map("two_factor_enabled")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  sessions Session[]  accounts Account[]  profile MemberProfile?  userRoles UserRole[]
  @@map("user")
}
model Session { id String @id; expiresAt DateTime @map("expires_at"); token String @unique; ipAddress String? @map("ip_address"); userAgent String? @map("user_agent"); userId String @map("user_id"); user User @relation(fields:[userId], references:[id], onDelete: Cascade); createdAt DateTime @default(now()) @map("created_at"); updatedAt DateTime @updatedAt @map("updated_at"); @@map("session") }
model Account { id String @id; accountId String @map("account_id"); providerId String @map("provider_id"); userId String @map("user_id"); user User @relation(fields:[userId], references:[id], onDelete: Cascade); password String?; accessToken String? @map("access_token"); refreshToken String? @map("refresh_token"); idToken String? @map("id_token"); accessTokenExpiresAt DateTime? @map("access_token_expires_at"); refreshTokenExpiresAt DateTime? @map("refresh_token_expires_at"); scope String?; createdAt DateTime @default(now()) @map("created_at"); updatedAt DateTime @updatedAt @map("updated_at"); @@map("account") }
model Verification { id String @id; identifier String; value String; expiresAt DateTime @map("expires_at"); createdAt DateTime @default(now()) @map("created_at"); updatedAt DateTime @updatedAt @map("updated_at"); @@map("verification") }
model TwoFactor { id String @id; secret String; backupCodes String @map("backup_codes"); userId String @map("user_id"); @@map("two_factor") }

enum MemberStatus { pending approved suspended }
model MemberProfile {
  id String @id @default(cuid())
  userId String @unique @map("user_id");  user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  fullName String @map("full_name")
  email String @unique              // stored lowercased
  phone String?
  rotaryId String? @map("rotary_id")
  clubId String @map("club_id");   club Club @relation(fields:[clubId], references:[id])
  photoUrl String? @map("photo_url")
  bio String?
  skills String[] @default([])
  interests String[] @default([])
  membershipAnniversary DateTime? @map("membership_anniversary") @db.Date
  status MemberStatus @default(pending)
  approvedById String? @map("approved_by_id")
  approvedAt DateTime? @map("approved_at")
  rejectionReason String? @map("rejection_reason")
  qrToken String @unique @default(cuid()) @map("qr_token")
  directoryOptIn Boolean @default(false) @map("directory_opt_in")
  isDacMember Boolean @default(false) @map("is_dac_member")
  legacyProfileId String? @unique @map("legacy_profile_id")
  themePreference String @default("system") @map("theme_preference")
  createdAt/updatedAt
  @@index([clubId]) @@index([status])
  @@map("member_profiles")
}
enum ScopeType { none club zone project }
model Role { id String @id @default(cuid()); key String @unique; name String; description String?; isSystem Boolean @default(false) @map("is_system"); scopeType ScopeType @default(none) @map("scope_type"); permissions RolePermission[]; userRoles UserRole[]; createdAt/updatedAt; @@map("roles") }
model Permission { id String @id @default(cuid()); key String @unique; description String; roles RolePermission[]; @@map("permissions") }
model RolePermission { roleId String @map("role_id"); permissionId String @map("permission_id"); role Role @relation(...onDelete: Cascade); permission Permission @relation(...onDelete: Cascade); @@id([roleId, permissionId]); @@map("role_permissions") }
model UserRole { id String @id @default(cuid()); userId String @map("user_id"); roleId String @map("role_id"); scopeType ScopeType @map("scope_type"); scopeId String? @map("scope_id"); grantedById String? @map("granted_by_id"); grantedAt DateTime @default(now()) @map("granted_at"); user User @relation(...onDelete: Cascade); role Role @relation(...onDelete: Cascade); @@unique([userId, roleId, scopeType, scopeId]); @@index([userId]); @@map("user_roles") }
model AuditLog { id String @id @default(cuid()); actorId String? @map("actor_id"); action String; resourceType String @map("resource_type"); resourceId String? @map("resource_id"); before Json?; after Json?; at DateTime @default(now()); @@index([resourceType, resourceId]); @@index([actorId]); @@map("audit_log") }
model TrustedDevice { id String @id @default(cuid()); userId String @map("user_id"); tokenHash String @unique @map("token_hash"); userAgent String? @map("user_agent"); expiresAt DateTime @map("expires_at"); createdAt; @@index([userId]); @@map("trusted_devices") }
```

### A.3 Clubs

```prisma
model Zone { id String @id @default(cuid()); name String @unique; order Int @default(0); clubs Club[]; @@map("zones") }
model Club {   // existing columns kept; new columns added
  id String @id                          // legacy text id, keep
  name String; shortName String? @map("short_name"); zone String?  // legacy string, keep until phase 14
  zoneId String? @map("zone_id");  zoneRef Zone? @relation(fields:[zoneId], references:[id])
  slug String? @unique
  lat Float?; lng Float?; president String?; isDirector String? @default("") @map("is_director"); phone String?; email String?; rotaryId String? @map("rotary_id"); secretary String?; secretaryEmail String? @map("secretary_email"); secretaryPhone String? @map("secretary_phone"); initiatives Json @default("[]")
  charterDate DateTime? @map("charter_date") @db.Date; isActive Boolean @default(true) @map("is_active"); meetingInfo String? @map("meeting_info"); socialLinks Json? @map("social_links"); logoUrl String? @map("logo_url")
  createdAt DateTime? @default(now()) @map("created_at"); updatedAt DateTime? @default(now()) @updatedAt @map("updated_at")
  @@map("clubs")
}
model ClubBoardMember { id String @id @default(cuid()); clubId String @map("club_id"); memberId String? @map("member_id"); name String; position String; bloodGroup String? @map("blood_group"); phone String?; email String?; ryYear Int @map("ry_year"); order Int @default(0); club Club @relation(...); createdAt/updatedAt; @@index([clubId, ryYear]); @@map("club_board_members") }
model ClubFacts {
  id String @id @default(cuid()); clubId String @map("club_id"); ryYear Int @map("ry_year")
  duesPaidOn DateTime? @map("dues_paid_on") @db.Date
  riCitationCompleted Boolean @default(false) @map("ri_citation_completed")
  paulHarrisFellows Int @default(0) @map("paul_harris_fellows")
  dualMembers Int @default(0) @map("dual_members")
  mdioCommitteeMembers Int @default(0) @map("mdio_committee_members")
  mdioEventsAttended Int @default(0) @map("mdio_events_attended")
  sisterClubSignedOn DateTime? @map("sister_club_signed_on") @db.Date
  drrVisitOn DateTime? @map("drr_visit_on") @db.Date
  activeSocialHandles Int @default(0) @map("active_social_handles")
  clubMerchandise Boolean @default(false) @map("club_merchandise")
  clubWebsiteUrl String? @map("club_website_url")
  priorYearMemberCount Int? @map("prior_year_member_count")
  updatedById String? @map("updated_by_id")
  club Club @relation(...); createdAt/updatedAt
  @@unique([clubId, ryYear]); @@map("club_facts")
}
```

### A.4 Content, settings, assets

```prisma
enum ContentType { text richtext image link list }
enum PublishStatus { draft published }
model ContentBlock { id; pageKey String @map("page_key"); sectionKey String @map("section_key"); type ContentType; draftValue Json @map("draft_value"); publishedValue Json? @map("published_value"); publishedAt DateTime? @map("published_at"); updatedById String? @map("updated_by_id"); createdAt/updatedAt; @@unique([pageKey, sectionKey]); @@map("content_blocks") }
model Setting { key String @id; value Json; updatedById String? @map("updated_by_id"); updatedAt; @@map("settings") }
enum LinkStatus { unchecked ok broken private }
model AssetLink { id; url String; kind String; status LinkStatus @default(unchecked); lastCheckedAt DateTime? @map("last_checked_at"); lastError String? @map("last_error"); ownerUserId String? @map("owner_user_id"); resourceType String @map("resource_type"); resourceId String @map("resource_id"); createdAt/updatedAt; @@unique([resourceType, resourceId, url]); @@index([status]); @@map("asset_links") }
```

### A.5 Public content tables

```prisma
model PastDrr { id; name String; slug String @unique; terms String[]  /* e.g. ["2019-20"] */; homeClubId String? @map("home_club_id"); photoUrl String? @map("photo_url"); bio String?; order Int; isLowResPhoto Boolean @default(false) @map("is_low_res_photo"); createdAt/updatedAt; @@map("past_drrs") }
enum TeamKind { core dsc }
model DistrictTeamMember { id; memberId String? @map("member_id"); name String; designation String; kind TeamKind; order Int; photoUrl String? @map("photo_url"); phone String?; email String?; bio String?; clubId String? @map("club_id"); ryYear Int @map("ry_year"); createdAt/updatedAt; @@map("district_team") }
enum AchievementType { chartered_club award milestone }
model Achievement { id; type AchievementType; title String; clubId String? @map("club_id"); date DateTime @db.Date; certificateUrl String? @map("certificate_url"); description String?; order Int @default(0); createdAt/updatedAt; @@map("achievements") }
enum PermissionStatus { pending granted }
model Partner { id; name String; logoUrl String? @map("logo_url"); tier String; website String?; permissionStatus PermissionStatus @default(pending) @map("permission_status"); order Int @default(0); createdAt/updatedAt; @@map("partners") }
enum PublicationType { directory newsletter }
model Publication { id; title String; type PublicationType; url String; month DateTime @db.Date; coverUrl String? @map("cover_url"); createdAt/updatedAt; @@map("publications") }
enum ResourceCategory { documents forms logos photos guest_kit templates }
model Resource { id; category ResourceCategory; title String; description String?; url String; isLocked Boolean @default(false) @map("is_locked"); requiredPermission String? @map("required_permission"); comingSoonMonth String? @map("coming_soon_month"); order Int @default(0); createdAt/updatedAt; @@map("resources") }
model SisterClubRequest { id; clubId String @map("club_id"); partnerClubName String @map("partner_club_name"); partnerDistrict String @map("partner_district"); country String; contactName String @map("contact_name"); contactEmail String @map("contact_email"); status String @default("submitted"); signedOn DateTime? @map("signed_on") @db.Date; submittedById String? @map("submitted_by_id"); createdAt/updatedAt; @@map("sister_club_requests") }
enum EnquiryKind { new_club sponsor contact }
model Enquiry { id; kind EnquiryKind; name String; email String; phone String?; organisation String?; message String; payload Json?; routedTo String @map("routed_to"); status String @default("new"); createdAt/updatedAt; @@map("enquiries") }
model PageView { year Int @id; count BigInt @default(0); @@map("page_views") }
```

### A.6 Reporting and points

```prisma
enum SchemaStatus { draft active retired }
model ReportFormSchema { id; version Int @unique; status SchemaStatus @default(draft); publishedAt DateTime? @map("published_at"); createdById String? @map("created_by_id"); fields ReportFormField[]; createdAt/updatedAt; @@map("report_form_schemas") }
enum FieldType { text textarea number select multiselect link date boolean clubs }
model ReportFormField { id; schemaId String @map("schema_id"); section String; fieldKey String @map("field_key"); label String; type FieldType; options Json?; required Boolean @default(false); order Int; helpText String? @map("help_text"); pointSourceKey String? @map("point_source_key"); schema ReportFormSchema @relation(...onDelete: Cascade); @@unique([schemaId, fieldKey]); @@map("report_form_fields") }
enum ReportStatus { draft submitted queried scored }
model MonthlyReport {   // legacy table, extended
  id String @id @default(uuid()) @db.Uuid
  month String            // legacy text, keep
  clubName String @map("club_name"); clubEmail String @map("club_email"); submittedBy String @map("submitted_by")   // legacy, keep
  status String? @default("reported"); flagComment String? @map("flag_comment"); sectionsJson Json @map("sections_json"); submittedAt DateTime? @default(now()) @map("submitted_at"); flagReason String? @map("flag_reason"); flaggedBy String? @map("flagged_by"); flaggedAt DateTime? @map("flagged_at"); sectionFlags Json? @default("{}") @map("section_flags")
  clubId String? @map("club_id"); monthDate DateTime? @map("month_date") @db.Date; schemaVersion Int @default(1) @map("schema_version"); status2 ReportStatus @default(submitted) @map("status2"); submittedById String? @map("submitted_by_id"); notes String?; queriedById String? @map("queried_by_id"); queryText String? @map("query_text"); queryReply String? @map("query_reply"); resolvedAt DateTime? @map("resolved_at"); filedOnTime Boolean? @map("filed_on_time")
  @@unique([clubId, monthDate]); @@map("monthly_reports")
}
model ReportRequest { id; title String; description String?; questions Json  /* [{key,label,type,required}] */; audience Json /* {roleKeys[],zoneIds[],clubIds[]} */; dueAt DateTime @map("due_at"); createdById String @map("created_by_id"); responses ReportRequestResponse[]; createdAt/updatedAt; @@map("report_requests") }
model ReportRequestResponse { id; requestId String @map("request_id"); clubId String @map("club_id"); answers Json; submittedById String @map("submitted_by_id"); request ReportRequest @relation(...onDelete: Cascade); createdAt/updatedAt; @@unique([requestId, clubId]); @@map("report_request_responses") }
model PointCategory { id; key String @unique; name String; order Int; rules PointRule[]; @@map("point_categories") }
enum RuleType { flat per_unit tiered penalty }
enum RulePeriod { monthly yearly once }
enum SourceType { report_field club_fact event_attendance project_collaboration ride_hosting club_events }
model PointRule { id; categoryId String @map("category_id"); key String @unique; label String; ruleType RuleType @map("rule_type"); period RulePeriod; sourceType SourceType @map("source_type"); sourceKey String @map("source_key"); numeratorKey String? @map("numerator_key"); denominatorKey String? @map("denominator_key"); points Decimal? @db.Decimal(10,2); perUnitCap Int? @map("per_unit_cap"); isActive Boolean @default(true) @map("is_active"); ryYear Int @map("ry_year"); category PointCategory @relation(...); tiers PointRuleTier[]; createdAt/updatedAt; @@map("point_rules") }
model PointRuleTier { id; ruleId String @map("rule_id"); min Decimal @db.Decimal(10,2); max Decimal? @db.Decimal(10,2); points Decimal @db.Decimal(10,2); rule PointRule @relation(...onDelete: Cascade); @@map("point_rule_tiers") }
enum EntryKind { computed judged }
model ClubPointEntry { id; clubId String @map("club_id"); ryYear Int @map("ry_year"); periodKey String @map("period_key")  /* "2026-08" | "2026" | "once" */; ruleId String? @map("rule_id"); categoryId String @map("category_id"); kind EntryKind; points Decimal @db.Decimal(10,2); reason String?; traceJson Json? @map("trace_json"); sourceType String? @map("source_type"); sourceId String? @map("source_id"); createdById String? @map("created_by_id"); createdAt/updatedAt; @@unique([clubId, ruleId, periodKey], map: "club_point_entries_computed_idempotent"); @@index([clubId, ryYear]); @@map("club_point_entries") }
```
Note: the unique index above must be a partial index `WHERE kind='computed'`: Prisma cannot express it, so add it by hand in the migration SQL and remove the generated non-partial one.

### A.7 Showcase, effort, badges, certificates

```prisma
enum ShowcaseStatus { draft submitted approved published rejected }
model ProjectSubmission {   // legacy table, extended; drop any legacy club_name column usage
  id String @id @default(uuid()) @db.Uuid
  /* keep every legacy column as-is here */
  slug String? @unique; title String?; category String?; summary String?; body String?; date DateTime? @db.Date; beneficiaries Int?; photos String[] @default([]); submittedById String? @map("submitted_by_id"); status2 ShowcaseStatus @default(draft) @map("status2"); publishedTitle String? @map("published_title"); publishedSummary String? @map("published_summary"); publishedBody String? @map("published_body"); editorNotes String? @map("editor_notes"); rejectionReason String? @map("rejection_reason"); publishedAt DateTime? @map("published_at"); publishedById String? @map("published_by_id"); consentConfirmed Boolean @default(false) @map("consent_confirmed")
  clubs ProjectClub[]
  @@map("project_submissions")
}
enum ProjectClubRole { lead collaborator }
model ProjectClub { projectId String @map("project_id") @db.Uuid; clubId String @map("club_id"); role ProjectClubRole; project ProjectSubmission @relation(...onDelete: Cascade); club Club @relation(...); @@id([projectId, clubId]); @@map("project_clubs") }
enum EffortKind { admin self }
enum ApprovalStatus { pending approved rejected }
model EffortLog { id; kind EffortKind; memberId String? @map("member_id"); personName String @map("person_name"); clubId String @map("club_id"); taskDescription String @map("task_description"); hours Decimal @db.Decimal(6,2); date DateTime @db.Date; loggedById String @map("logged_by_id"); status ApprovalStatus @default(approved); approvedById String? @map("approved_by_id"); approvedAt DateTime? @map("approved_at"); rejectionReason String? @map("rejection_reason"); pointsAwarded Decimal? @map("points_awarded") @db.Decimal(10,2); pointEntryId String? @map("point_entry_id"); createdAt/updatedAt; @@index([clubId]); @@index([memberId]); @@map("effort_log") }
model Badge { id; key String @unique; label String; description String; icon String; triggerType String @map("trigger_type"); threshold Int?; @@map("badges") }
model MemberBadge { memberId String @map("member_id"); badgeId String @map("badge_id"); earnedAt DateTime @default(now()) @map("earned_at"); @@id([memberId, badgeId]); @@map("member_badges") }
model Certificate { id; memberId String @map("member_id"); kind String; title String; issuedAt DateTime @default(now()) @map("issued_at"); issuedById String? @map("issued_by_id"); data Json; @@index([memberId]); @@map("certificates") }
model MemberPrivacyAcceptance { memberId String @map("member_id"); policyPublishedAt DateTime @map("policy_published_at"); acceptedAt DateTime @default(now()) @map("accepted_at"); @@id([memberId, policyPublishedAt]); @@map("member_privacy_acceptances") }
model SkillTag { id; label String @unique; kind String /* skill | interest */; @@map("skill_tags") }
```

### A.8 Events, calendar, feedback, comms

```prisma
model Event { id; title String; slug String @unique; startsAt DateTime @map("starts_at"); endsAt DateTime? @map("ends_at"); location String?; description String?; coverUrl String? @map("cover_url"); isDistrictEvent Boolean @default(true) @map("is_district_event"); clubId String? @map("club_id")  /* set for club-logged events */; rsvpOpen Boolean @default(true) @map("rsvp_open"); capacity Int?; photos String[] @default([]); createdById String @map("created_by_id"); rsvps EventRsvp[]; checkins EventCheckin[]; createdAt/updatedAt; @@index([startsAt]); @@map("events") }
enum RsvpStatus { going maybe not_going }
model EventRsvp { eventId String @map("event_id"); memberId String @map("member_id"); status RsvpStatus; event Event @relation(...onDelete: Cascade); createdAt/updatedAt; @@id([eventId, memberId]); @@map("event_rsvps") }
enum CheckinMethod { qr manual walk_in }
model EventCheckin { id; eventId String @map("event_id"); memberId String? @map("member_id"); walkInName String? @map("walk_in_name"); clubId String @map("club_id"); method CheckinMethod; checkedInAt DateTime @default(now()) @map("checked_in_at"); checkedInById String @map("checked_in_by_id"); event Event @relation(...onDelete: Cascade); @@unique([eventId, memberId]); @@index([eventId, clubId]); @@map("event_checkins") }
enum BookingPurpose { installation club_event meeting }
enum BookingStatus { requested held confirmed declined cancelled }
model DrrBooking { id; reference String @unique; purpose BookingPurpose; clubId String? @map("club_id"); requesterName String @map("requester_name"); requesterEmail String @map("requester_email"); requesterPhone String @map("requester_phone"); startsAt DateTime @map("starts_at"); endsAt DateTime @map("ends_at"); notes String?; status BookingStatus @default(requested); googleEventId String? @map("google_event_id"); decisionReason String? @map("decision_reason"); decidedById String? @map("decided_by_id"); decidedAt DateTime? @map("decided_at"); createdAt/updatedAt; @@index([startsAt]); @@map("drr_bookings") }
model DrrBlock { id; startsAt DateTime @map("starts_at"); endsAt DateTime @map("ends_at"); reason String?; createdById String @map("created_by_id"); @@map("drr_blocks") }
model Announcement {   // legacy table extended; keep legacy columns
  id String @id @default(uuid()) @db.Uuid
  /* legacy columns kept */
  title2 String? @map("title2"); body String?; audience Json? /* {roleKeys[],zoneIds[],clubIds[],memberIds[]} */; channels String[] @default([]); sendAt DateTime? @map("send_at"); sentAt DateTime? @map("sent_at"); recipientCount Int? @map("recipient_count"); createdById String? @map("created_by_id"); reads AnnouncementRead[]
  @@map("announcements")
}
model AnnouncementRead { announcementId String @map("announcement_id") @db.Uuid; userId String @map("user_id"); readAt DateTime @default(now()) @map("read_at"); announcement Announcement @relation(...onDelete: Cascade); @@id([announcementId, userId]); @@map("announcement_reads") }
enum FeedbackStatus { open reviewed closed }
model Feedback { id; submittedById String? @map("submitted_by_id"); clubId String? @map("club_id"); category String; message String; eventId String? @map("event_id"); status FeedbackStatus @default(open); reply String?; reviewedById String? @map("reviewed_by_id"); reviewedAt DateTime? @map("reviewed_at"); createdAt/updatedAt; @@index([status]); @@map("feedback") }
enum Channel { email push }
enum OutboxStatus { queued sent failed }
model NotificationOutbox { id; channel Channel; toUserId String? @map("to_user_id"); toAddress String @map("to_address"); template String; subject String?; payload Json; status OutboxStatus @default(queued); provider String?; attempts Int @default(0); lastError String? @map("last_error"); sentAt DateTime? @map("sent_at"); createdAt/updatedAt; @@index([status]); @@map("notification_outbox") }
model EmailProviderUsage { provider String; day DateTime @db.Date; count Int @default(0); @@id([provider, day]); @@map("email_provider_usage") }
model PushSubscription { id; userId String @map("user_id"); endpoint String @unique; p256dh String; auth String; userAgent String? @map("user_agent"); createdAt/updatedAt; @@index([userId]); @@map("push_subscriptions") }
```

### A.9 Subdomains

```prisma
enum CampStatus { submitted approved rejected }
model M3011Camp { id; leadClubId String @map("lead_club_id"); date DateTime @db.Date; venue String; city String?; unitsCollected Int @map("units_collected"); donorsRegistered Int? @map("donors_registered"); partnerBloodBank String? @map("partner_blood_bank"); photos String[] @default([]); status CampStatus @default(submitted); submittedById String @map("submitted_by_id"); reviewedById String? @map("reviewed_by_id"); reviewedAt DateTime? @map("reviewed_at"); rejectionReason String? @map("rejection_reason"); clubs M3011CampClub[]; createdAt/updatedAt; @@index([status]); @@map("m3011_camps") }
model M3011CampClub { campId String @map("camp_id"); clubId String @map("club_id"); camp M3011Camp @relation(...onDelete: Cascade); @@id([campId, clubId]); @@map("m3011_camp_clubs") }
enum DrishtiStage { screened scheduled operated followup closed }
model DrishtiBeneficiary { id; clubId String @map("club_id"); name String; age Int?; gender String?; phoneEncrypted String? @map("phone_encrypted"); eye String /* left|right|both */; screenedOn DateTime @map("screened_on") @db.Date; campLocation String? @map("camp_location"); stage DrishtiStage @default(screened); notes String?; createdById String @map("created_by_id"); surgeries DrishtiSurgery[]; createdAt/updatedAt; @@index([clubId]); @@index([stage]); @@map("drishti_beneficiaries") }
model DrishtiSurgery { id; beneficiaryId String @map("beneficiary_id"); hospital String; operatedOn DateTime @map("operated_on") @db.Date; outcome String?; followupOn DateTime? @map("followup_on") @db.Date; beneficiary DrishtiBeneficiary @relation(...onDelete: Cascade); createdAt/updatedAt; @@map("drishti_surgeries") }
enum TeamStatus { registered confirmed withdrawn }
model RclTeam { id; season Int; clubId String @map("club_id"); name String; captainName String @map("captain_name"); captainPhone String @map("captain_phone"); status TeamStatus @default(registered); players RclPlayer[]; createdById String @map("created_by_id"); createdAt/updatedAt; @@unique([season, clubId]); @@map("rcl_teams") }
model RclPlayer { id; teamId String @map("team_id"); memberId String? @map("member_id"); name String; role String?; team RclTeam @relation(...onDelete: Cascade); @@map("rcl_players") }
enum FixtureStatus { scheduled completed abandoned }
model RclFixture { id; season Int; homeTeamId String @map("home_team_id"); awayTeamId String @map("away_team_id"); scheduledAt DateTime @map("scheduled_at"); venue String?; status FixtureStatus @default(scheduled); result RclResult?; createdAt/updatedAt; @@map("rcl_fixtures") }
model RclResult { fixtureId String @id @map("fixture_id"); homeRuns Int @map("home_runs"); homeWickets Int @map("home_wickets"); homeOvers Decimal @map("home_overs") @db.Decimal(4,1); awayRuns Int @map("away_runs"); awayWickets Int @map("away_wickets"); awayOvers Decimal @map("away_overs") @db.Decimal(4,1); winnerTeamId String? @map("winner_team_id"); notes String?; enteredById String @map("entered_by_id"); fixture RclFixture @relation(...onDelete: Cascade); createdAt/updatedAt; @@map("rcl_results") }
enum ListingType { job internship mentorship }
enum ListingStatus { pending_email pending verified filled expired rejected }
model CbListing { id; title String; company String; type ListingType; location String; mode String /* onsite|remote|hybrid */; stipend String?; description String; applyUrl String? @map("apply_url"); contactEmail String @map("contact_email"); postedByName String @map("posted_by_name"); postedByEmail String @map("posted_by_email"); rotaryAffiliation String? @map("rotary_affiliation"); status ListingStatus @default(pending_email); verifyToken String? @unique @map("verify_token"); verifiedById String? @map("verified_by_id"); verifiedAt DateTime? @map("verified_at"); filledAt DateTime? @map("filled_at"); expiresAt DateTime? @map("expires_at"); rejectionReason String? @map("rejection_reason"); createdAt/updatedAt; @@index([status]); @@map("cb_listings") }
model RideSupportClub { id; ryYear Int @map("ry_year"); clubId String @map("club_id"); capacityDelegates Int @map("capacity_delegates"); homestayAvailable Boolean @map("homestay_available"); preferredMonths Int[] @map("preferred_months"); contactMemberId String? @map("contact_member_id"); contactPhone String @map("contact_phone"); notes String?; createdById String @map("created_by_id"); createdAt/updatedAt; @@unique([ryYear, clubId]); @@map("ride_support_clubs") }
enum DelegationStatus { planned confirmed completed cancelled }
model RideDelegation { id; ryYear Int @map("ry_year"); visitingDistrict String @map("visiting_district"); country String; startsAt DateTime @map("starts_at") @db.Date; endsAt DateTime @map("ends_at") @db.Date; headcount Int; contactName String @map("contact_name"); contactEmail String? @map("contact_email"); status DelegationStatus @default(planned); hosts RideDelegationHost[]; createdAt/updatedAt; @@map("ride_delegations") }
model RideDelegationHost { id; delegationId String @map("delegation_id"); clubId String @map("club_id"); daysHosted Int @map("days_hosted"); membersSent Int @default(0) @map("members_sent"); assignedById String @map("assigned_by_id"); delegation RideDelegation @relation(...onDelete: Cascade); createdAt/updatedAt; @@unique([delegationId, clubId]); @@map("ride_delegation_hosts") }
model RideGalleryItem { id; year Int; url String; kind String /* photo|video */; caption String?; order Int @default(0); createdAt/updatedAt; @@map("ride_gallery_items") }
```

---

