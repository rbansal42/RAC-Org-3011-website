# RAC District 3011 Platform — Implementation Spec (hand-off edition)

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
5. No file uploads to our servers. Any image/document field is a `String` URL to an external host (Google Drive, Google Photos, YouTube, etc.).
6. Every mutating endpoint has `@RequirePermission('<key>')` and a scope check (§4.4). Every list/read endpoint filters by the caller's scope inside the repository query.
7. Every notification goes through `NotificationPort.notify()` (§7). No module imports an email or push SDK directly.
8. Audit log rows (§4.6) are written for every action listed in §4.6.
9. No code comments unless they explain a constraint that is not visible in the code. No commented-out code.
10. Tests: each task below is done when its listed tests pass. Do not mark a task done without running the test command and reading the output.
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
`src/config/env.ts` parses `process.env` with a Zod schema (§11.2) and exits on failure. When `WORKER=1`, `AppModule` imports only `PrismaModule`, `NotificationsModule` (worker side), `LinkHealthModule`, `PointsModule` (recompute worker) and `DrrCalendarModule` (reminders) — controllers are not mounted.

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

## 3. Database schema (Prisma, exact)

`prisma/schema.prisma`. Generator `prisma-client-js`, datasource postgresql `env("DATABASE_URL")`. All tables `@@map` to snake_case; all columns `@map` to snake_case (write them out; Prisma has no global mapping). Every model has `createdAt DateTime @default(now()) @map("created_at")` and `updatedAt DateTime @updatedAt @map("updated_at")` unless stated. IDs are `String @id @default(cuid())` unless stated. Enums are Prisma enums with the values listed.

### 3.1 Baseline: legacy tables

The target database already contains `clubs`, `user_profiles`, `monthly_reports`, `project_submissions`, `announcements`. Step 1 is `prisma db pull`, then write the baseline migration with `prisma migrate diff --from-empty --to-schema-datamodel` and mark it applied with `prisma migrate resolve --applied <name>`. Keep `user_profiles` as `LegacyUserProfile @@map("user_profiles")` (read-only, dropped in §13 phase 14). Rename models: `clubs → Club`, `monthly_reports → MonthlyReport`, `project_submissions → ProjectSubmission`, `announcements → Announcement`.

### 3.2 Identity, RBAC, audit

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

### 3.3 Clubs

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

### 3.4 Content, settings, assets

```prisma
enum ContentType { text richtext image link list }
enum PublishStatus { draft published }
model ContentBlock { id; pageKey String @map("page_key"); sectionKey String @map("section_key"); type ContentType; draftValue Json @map("draft_value"); publishedValue Json? @map("published_value"); publishedAt DateTime? @map("published_at"); updatedById String? @map("updated_by_id"); createdAt/updatedAt; @@unique([pageKey, sectionKey]); @@map("content_blocks") }
model Setting { key String @id; value Json; updatedById String? @map("updated_by_id"); updatedAt; @@map("settings") }
enum LinkStatus { unchecked ok broken private }
model AssetLink { id; url String; kind String; status LinkStatus @default(unchecked); lastCheckedAt DateTime? @map("last_checked_at"); lastError String? @map("last_error"); ownerUserId String? @map("owner_user_id"); resourceType String @map("resource_type"); resourceId String @map("resource_id"); createdAt/updatedAt; @@unique([resourceType, resourceId, url]); @@index([status]); @@map("asset_links") }
```

### 3.5 Public content tables

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

### 3.6 Reporting and points

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
Note: the unique index above must be a partial index `WHERE kind='computed'` — Prisma cannot express it, so add it by hand in the migration SQL and remove the generated non-partial one.

### 3.7 Showcase, effort, badges, certificates

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

### 3.8 Events, calendar, feedback, comms

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

### 3.9 Subdomains

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

---

## 5. API catalogue

Conventions: JSON; ids in paths; list endpoints accept `?page=1&pageSize=25` and return `{ items, total, page, pageSize }`; every DTO is a Zod schema in `dto/` with `createZodDto`; errors `{ statusCode, error, message }`; 404 when the resource exists but is out of scope (do not leak existence). Unauthenticated public routes live under `/public/*` and set `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` unless stated.

### 5.1 Public (no auth)
- `GET /public/home` → `{ hero: ContentValue, stats: {zones, focusAreas, foundedYear, ageRange}, flagship: FlagshipCard[5], showcaseTeaser: ShowcaseCard[4], visits: number }`
- `POST /public/visits` (throttle 1/min/IP) → increments `page_views[currentYear]`, returns `{ count }` (no cache)
- `GET /public/clubs?zone=` → `{ items: ClubCard[] }` (id, name, shortName, slug, zone, lat, lng, president, phone, email, initiativesCount, memberCount, projectsThisYear)
- `GET /public/clubs/:slug` → club + board (current ryYear) + published projects
- `GET /public/showcase?category=&club=&page=` → published projects, `GET /public/showcase/:slug`, `GET /public/showcase/clubs/:clubSlug`
- `GET /public/heritage`, `GET /public/heritage/:slug`
- `GET /public/leadership` → `{ core: TeamMember[], dsc: TeamMember[], clubs: {slug,name,president,secretary}[] }`; `GET /public/leadership/clubs/:slug` → board with blood groups
- `GET /public/initiatives` → for each project key `{ key, active, leadClub: ClubCard|null, summary: ProjectSummary|null, summaryAt: ISO|null, unreachable: boolean }` (summary from the subdomain module's `summary()`; if it throws, return last cached value from `settings` key `summary_cache:<key>` with its timestamp and `unreachable: true`)
- `GET /public/resources` → grouped by category; locked rows included with `isLocked: true` and no `url`
- `GET /public/publications`, `GET /public/achievements`, `GET /public/partners` (pending permission → `logoUrl: null`)
- `GET /public/events?from=&to=` (district events), `GET /public/events/:slug`, `GET /public/events/:slug.ics`, `GET /public/calendar.ics` (all district events of current RY)
- `GET /public/content/:pageKey` → published blocks map `{ [sectionKey]: value }`
- `POST /public/enquiries` `{ kind, name, email, phone?, organisation?, message, payload? }` (throttle 5/hour/IP; honeypot field `website` must be empty) → routes to the person in settings `enquiry_routing.<kind>` and notifies them
- `GET /public/drr-calendar/availability?month=YYYY-MM` → `{ slots: {startsAt, endsAt}[], status: 'ok'|'unreachable' }`
- `POST /public/drr-calendar/bookings` (throttle 3/hour/IP) → `{ reference, status:'requested' }`; `GET /public/drr-calendar/bookings/:reference`
- `GET /public/subdomains/:key/summary` → project summary (each §10 module implements `summary()`)
- Career Bridge public: `GET /public/careerbridge/listings?type=&mode=&q=`, `GET /public/careerbridge/listings/:id`, `POST /public/careerbridge/listings` (creates `pending_email`, sends verify link), `GET /public/careerbridge/verify/:token` (→ `pending`)
- RIDE public: `GET /public/ride/delegations`, `GET /public/ride/gallery?year=`
- RCL public: `GET /public/rcl/standings?season=`, `GET /public/rcl/fixtures?season=`
- Mission 3011 / Drishti public dashboards: `GET /public/mission3011/dashboard`, `GET /public/drishti/dashboard`

### 5.2 Members (`/members`, `/me`)
- `POST /members/register` (no auth) `{ fullName, email, phone, clubId, password }` → creates user + profile pending → 201; sends `member-registered` to club president/secretary
- `GET /me`, `PATCH /me/profile` (profile:edit) `{ phone?, photoUrl?, bio?, skills?, interests?, membershipAnniversary?, directoryOptIn?, themePreference? }` (setting `directoryOptIn=true` requires a current privacy acceptance, else 409 `PRIVACY_NOT_ACCEPTED`)
- `POST /me/privacy-acceptance` → records acceptance of `content_blocks(privacy-policy).publishedAt`
- `GET /me/qr.svg`, `GET /me/card` → `{ profile, milestones: Milestone[], badges, certificates }`
- `GET /me/club` → roster (approved members, public fields), board, published projects, report statuses, announcements
- `GET /me/points` (only if caller holds president/secretary/member of that club) → `{ ryYear, total, byMonth: {month, computed, judged}[], byCategory: {category, points}[] }`
- `GET /members?clubId=&status=&q=` (members:view, scope filter), `POST /members/:id/approve`, `POST /members/:id/reject {reason}`, `POST /members/:id/suspend`, `GET /members/pending`
- `POST /members/import/preview` (members:import) multipart CSV → `{ rows: {row, email, fullName, clubId, action:'create'|'link'|'skip', reason?}[] }`; `POST /members/import/commit` `{ rows }` → `{ created, linked, skipped }`
- `GET /directory?q=&skill=&interest=&clubId=&zoneId=` (directory:view; caller must have privacy acceptance) → opted-in approved members, public fields only
- `GET /skill-tags`

### 5.3 RBAC admin (`/rbac`, roles:manage)
`GET /rbac/roles`, `POST /rbac/roles {key,name,description,scopeType,permissionKeys[]}`, `PATCH /rbac/roles/:id`, `DELETE /rbac/roles/:id` (409 if isSystem or has holders), `GET /rbac/permissions`, `GET /rbac/user-roles?userId=`, `POST /rbac/user-roles {userId, roleKey, scopeType, scopeId}`, `DELETE /rbac/user-roles/:id`. `GET /audit?resourceType=&resourceId=&page=` (audit:view).

### 5.4 Clubs (`/clubs`)
`GET /clubs` (auth; all clubs, light), `GET /clubs/:id` (clubs:view scope), `PATCH /clubs/:id` (clubs:edit scope) `{ meetingInfo?, socialLinks?, logoUrl?, phone?, email? }`, `GET /clubs/:id/board?ryYear=`, `PUT /clubs/:id/board` (clubs:edit) `{ members: BoardMemberInput[] }`, `GET /clubs/:id/facts?ryYear=` (club_facts:edit or own club read), `PATCH /clubs/:id/facts` (club_facts:edit; audited; triggers `PointsEngine.recompute({clubId, ryYear, trigger:'club_fact'})`), `GET /zones`.

### 5.5 Content & settings
`GET /content/blocks?pageKey=` (content:edit) → drafts + published; `PUT /content/blocks/:pageKey/:sectionKey` `{ type, value }` (content:edit; image/link values are link-checked synchronously, response includes `linkStatus`); `POST /content/blocks/:pageKey/:sectionKey/publish` (content:publish; audited); `GET /settings` (settings:manage), `PUT /settings/:key` (settings:manage; audited; validated per key by `SettingsSchema` §8.3; setting `subdomain.<key>.leadClubId` grants `project_admin` scoped to that project to that club's president/secretary user_roles and revokes it from the previous lead club).
Admin CRUD (public_content:manage, audited on write): `/admin/achievements`, `/admin/partners`, `/admin/publications`, `/admin/resources`, `/admin/past-drrs`, `/admin/district-team` — each `GET`, `POST`, `PATCH /:id`, `DELETE /:id`, plus `POST /admin/<x>/reorder { ids[] }`. `GET /admin/link-health?status=` , `POST /admin/link-health/:id/recheck`.

### 5.6 Reports (`/reports`)
- `GET /reports/schema/active`, `GET /reports/schema` (requests:manage), `POST /reports/schema/draft` (clone active → new draft version), `PUT /reports/schema/:version/fields { fields[] }` (draft only), `POST /reports/schema/:version/publish` (sets active, retires previous; audited)
- `GET /reports/mine?ryYear=` (reports:submit; scope) ; `GET /reports/:id`
- `PUT /reports/drafts/:clubId/:month` `{ values: Record<fieldKey, unknown>, notes? }` (reports:submit; scope; upsert status draft) ; `POST /reports/:id/submit` → validates against schema (required, types; `clubs` fields must be existing club ids) → status submitted, `filedOnTime = submittedAt <= deadline` where deadline = settings `report.deadlineDay` of following month; emits `report.submitted`
- `POST /reports/:id/query { text }` (reports:review; scope) → status queried, notify submitter; `POST /reports/:id/reply { text }` (reports:submit; submitter club) → status submitted, notify querier
- `GET /reports/overview?month=&zoneId=` (reports:review) → per club: `filed|not_filed|queried|scored`, computed/judged totals
- `GET /reports/:id/assist` (reports:score) → `{ suggestions: {fieldKey, suggestion, evidence}[], summary }` from Anthropic (model env `ANTHROPIC_MODEL` default `claude-sonnet-5`), input = the report's `notes` + values; nothing persisted
- Ad-hoc: `GET/POST /requests` (requests:manage), `GET /requests/open` (reports:submit), `PUT /requests/:id/responses/:clubId { answers }`

### 5.7 Points (`/points`)
`GET /points/categories`; `GET /points/rules?ryYear=` ; `POST /points/rules`, `PATCH /points/rules/:id`, `PUT /points/rules/:id/tiers { tiers[] }`, `POST /points/rules/:id/deactivate` (point_rules:manage; audited; enqueue `points.recompute-all {ryYear}`); `GET /points/clubs/:clubId/months/:month` (reports:score or reports:review; scope) → `{ computed: {categoryKey, subtotal, entries: Trace[]}[], judged: {points, reason, by, at}|null, report: {id,status} }`; `PUT /points/clubs/:clubId/months/:month/judged { points, reason }` (reports:score; reason min 10 chars; audited; sets report status scored); `DELETE` same path; `GET /points/clubs/:clubId/trend?ryYear=` (scope; own club for president/secretary/member); `GET /points/officer-dashboard?ryYear=&month=` (reports:review) → clubs behind threshold, filed %, top categories, queue counts.

### 5.8 Showcase (`/showcase`)
`GET /showcase/mine`, `PUT /showcase/drafts/:id?` (showcase:submit) `{ title, category, date, summary, body, photos[], beneficiaries?, collaboratorClubIds[], consentConfirmed }`, `POST /showcase/:id/submit` (requires consentConfirmed; notifies club president/secretary), `GET /showcase/queue?status=` (showcase:publish; scope by lead club), `PATCH /showcase/:id/published-copy { publishedTitle, publishedSummary, publishedBody, editorNotes }`, `POST /showcase/:id/publish` (audited; sets slug; emits `showcase.published`; triggers recompute for lead club with trigger `project_collaboration`), `POST /showcase/:id/reject { reason }`.

### 5.9 Effort, badges, certificates
`GET /effort?clubId=&status=` (effort:log or effort:approve scope), `POST /effort` (effort:log) `{ personName, memberId?, clubId, taskDescription, hours, date }` → approved; `POST /me/contributions` (any member) → kind self, status pending; `GET /me/contributions`; `POST /effort/:id/approve|reject` (effort:approve; scope); `PUT /effort/:id/points { points, reason? }` (reports:score; creates/updates judged `club_point_entries` with `sourceType:'effort'`, `sourceId`, `periodKey = YYYY-MM of date`, reason `Effort log: <taskDescription>` + optional reason; audited). `GET /me/badges`, `GET /me/certificates`, `GET /me/certificates/:id.pdf`, `POST /members/:id/certificates { kind }` (members:approve scope) → issue.

### 5.10 Events, feedback
`GET /events?from=&to=&clubId=` (auth), `POST /events` (events:manage for district events; club_events:log for `isDistrictEvent=false` with own clubId), `PATCH /events/:id`, `DELETE /events/:id`; `PUT /events/:id/rsvp { status }` (member; 409 when capacity reached and status going); `GET /events/:id/attendance` (events:checkin or events:manage) → per club counts; `POST /events/:id/checkins { qrToken? , memberId?, walkInName?, clubId? }` (events:checkin; exactly one of qrToken|memberId|walkInName; duplicate → 200 with `alreadyCheckedIn: true`); `GET /events/:id/checkins`; after each check-in enqueue `points.recompute {clubId, ryYear, month, trigger:'event_attendance'}` debounced 30s per (event, club).
`POST /feedback` (feedback:submit) `{ category, message, eventId? }` (anonymous allowed when settings `feedback.allowAnonymous`), `GET /feedback/mine`, `GET /feedback?status=` (feedback:review), `POST /feedback/:id/reply { reply, status }` (audited; notifies submitter).

### 5.11 Announcements, notifications
`GET /announcements/feed` (auth; those whose resolved audience includes caller; marks nothing), `POST /announcements/:id/read`; `POST /announcements/audience/estimate { audience }` → `{ count, byChannel: {email, push} }`; `POST /announcements` (announcements:send; audience must be within caller scope unless announcements:send_all) `{ title, body, audience, channels[], sendAt? }`; `GET /announcements/sent`. `POST /push/subscriptions { endpoint, keys }`, `DELETE /push/subscriptions/:endpoint`, `GET /push/vapid-public-key`.

### 5.12 DRR calendar admin (drr_calendar:manage)
`GET /drr-calendar/bookings?status=`, `POST /drr-calendar/bookings/:id/confirm`, `POST /drr-calendar/bookings/:id/decline { reason }`, `POST /drr-calendar/blocks`, `DELETE /drr-calendar/blocks/:id`, `GET /drr-calendar/status` (Google reachability).

### 5.13 Subdomain admin routes — see §10.

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
2. For each rule, ask the adapter for `sourceType` to produce inputs: `adapter.inputs({ clubId, ryYear, month, rule })` returning `{ periodKey, input }[]` (monthly rules: one per month in scope — the given month, or all months July..current when `month` omitted; yearly: one with `periodKey = String(ryYear)`; once: one with `periodKey = 'once'`).
3. For each (rule, periodKey): evaluate; upsert `club_point_entries` computed row by `(clubId, ruleId, periodKey)` with points + trace; delete the row when evaluation is null.
4. Delete computed rows for this club/ryYear whose rule is inactive or deleted.
5. Emit `points.recomputed {clubId, ryYear}`.

Adapters (`PointSourceAdapter` interface, one class each, registered in a map by `sourceType`):
- `report_field`: reads submitted reports for the club/month(s); `input.value|count` = numeric coercion of `values[sourceKey]` (arrays → length; booleans → 1/0); for ratio rules reads `numeratorKey`/`denominatorKey`. Special key `filed_on_time` → `MonthlyReport.filedOnTime`.
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
Providers in order: `resend` (cap env `RESEND_DAILY_CAP` default 100), `mailgun` (100), `gmail` (500). `pick(day)`: first provider whose `email_provider_usage.count < cap` and not marked failed in the last 10 minutes (in-memory). Increment count atomically (`INSERT ... ON CONFLICT DO UPDATE count = count + 1 RETURNING count`) before sending; on send error mark provider failed and try the next; if all fail, outbox row `failed` with error, BullMQ retries with backoff 1m, 10m, 1h (3 attempts). `MAIL_DRIVER=console` logs instead of sending. In non-production, recipients not in `MAIL_ALLOWLIST` are rewritten to the first allowlisted address with the original address prepended to the subject.

### 6.6 Announcement audience resolution
`resolve(audience) → userIds`: union of (users holding any `roleKeys` role) ∩ (if `zoneIds` or `clubIds` given: users whose profile club is in those zones/clubs, plus role holders scoped to those zones/clubs) ∪ explicit `memberIds`. Empty audience object = nobody (400).

### 6.7 Milestones and badges (`src/badges/evaluators.ts`)
Badges seeded: `first_project` (showcase published where submitter), `events_10`, `events_25` (checkins count), `hours_25`, `hours_100` (approved effort hours), `service_1y`, `service_3y` (membershipAnniversary), `phf` (club_facts increments cannot attribute; instead a manual `POST /members/:id/badges/phf` by dsc). Evaluate on events `showcase.published`, `checkin.created`, `effort.approved`, nightly `badges.anniversaries`. Certificates issued automatically for `service_1y/3y`, `hours_100`; PDF via pdfkit: A4 landscape, Montserrat (bundle TTF in `assets/fonts`), pink `#D81B60` rule line, district logo top-left (`assets/district-logo.jpg`), name 36pt, title 18pt, issued date, reference id, signature line "District Rotaract Representative".

### 6.8 Legacy report compatibility
`sections_json` from schema version 1 has keys `clubMeetings, clubServices, communityServices, internationalServices, vocationalServices, districtProjects`, each an array of activity objects (`eventName, date, venue, areaOfFocus, clubStrength, initiatedBy, ...`). Seed `report_form_schemas` version 1 as `retired` with one `textarea` field per legacy section (fieldKey = legacy key) so history renders. Version 2 (active) fields, in order, section "Monthly activity log": `activities` (type `list` of activity rows is NOT a field type — instead model the monthly report as repeated activity rows: fields below apply per activity, and `values.activities` is an array of objects validated against these fields):
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

## 8. Seed data (`prisma/seed-system.ts` — idempotent upserts)

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
8.6 Flagship cards (content block `home.flagship` list): Mahadan 9.0, Clean Yamuna & Green NCR, Digital Literacy Labs, Pediatric Health Screening, Youth Leadership Assembly — copy from mockup Home section.
8.7 `skill_tags`: skills [Photography, Video editing, Graphic design, Public speaking, Event management, Fundraising, Social media, Writing, Web development, First aid, Teaching, Music, Anchoring, Logistics], interests [Community Service, Club Service, International Service, Professional Development, Public Image, Environment, Health, Education].
8.8 Dev-only seed (`prisma/seed-dev.ts`, run when `SEED_DEV=1`): super admin `admin@rotaract3011.org` / `Admin@12345`, one president+secretary+3 members for the first 5 clubs, 3 submitted reports, 2 published projects, 2 district events with checkins, sample announcements — enough for every screen to show data.

---

## 9. Web application

### 9.1 Tokens (`src/styles/tokens.css`) — exact
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
- `/showcase` ShowcasePage → `/public/showcase` → Part 1 §3; category filter chips, uniform-height grid, pagination. `/showcase/:slug` ShowcaseDetailPage → Part 1 §4 (photos gallery, lead + collaborating clubs, related). `/showcase/clubs/:clubSlug` ClubShowcasePage → Part 3 §22.
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
- `/portal/admin/clubs` AdminClubs (Portal Part 1 §6) → `/reports/overview`.
- `/portal/admin/clubs/:clubId/:month` ScoreMonth (Portal Admin Part 1 §1): computed per category with expandable trace, one judged input + reason, save, query; "Assist" button (reports:score) shows suggestions panel from `/reports/:id/assist`.
- `/portal/admin/clubs/:clubId/facts` ClubFacts (Part 1 §3). `/portal/admin/point-rules` (Part 1 §2). `/portal/admin/report-form` FormBuilder (Part 1 §4: field list with drag handles or up/down buttons, add field drawer, preview, publish version). `/portal/admin/requests/new` + `/portal/admin/requests` (Part 1 §5). `/portal/content` ContentEditor (Part 1 §6). `/portal/admin/roles` (Part 1 §7). `/portal/admin/events/:slug` EventCheckIn (Part 2 §9: camera QR via `@zxing/browser`, manual search, walk-in, live per-club counts). `/portal/members` MembersApprovals (Part 2 §10) + import wizard (upload → preview table → commit → report). `/portal/admin/effort-log` (Part 2 §12). `/portal/admin/announcements` Compose (Portal Part 2 §12) with `/portal/admin/announcements/audience` AudienceBuilder (Portal Admin Part 2 §13, live estimate). `/portal/admin/settings` (Part 2 §14). `/portal/admin/feedback` (Part 2 §15). `/portal/admin/showcase` ShowcaseQueue (Portal Part 1 §7: submitted text verbatim left, editable published copy right). `/portal/admin/users` (Portal Part 1 §8: user roles management, grant/revoke scoped roles). `/portal/admin/events` EventsAdmin (CRUD). `/portal/admin/public-content/*` simple CRUD tables for achievements/partners/publications/resources/past-drrs/district-team. `/portal/admin/audit`.

**Subdomain surfaces** — see §10 for routes; shells use `SubdomainShell`.

### 9.6 Frontend behaviours that are easy to get wrong
- Never block the page with a full-screen loader; use skeletons in place.
- Forms: disable submit while pending, show field errors from Zod (client) and from API 400 `details[]` (server).
- Lists: URL-synced filters (`useSearchParams`).
- Images: always `ImageSlot`, never bare `<img>` for external URLs.
- Push permission: only requested from the Settings page button or after the first announcement is opened (`sessionStorage` flag), never on load.
- Dark mode: toggling sets `data-theme` on `<html>` and persists via `PATCH /me/profile` when logged in.

---

## 10. Project subdomains

Each project module in the API lives in `src/subdomains/<key>/` and exports `summary(): Promise<ProjectSummary>` where `ProjectSummary = { headline: string; value: number; target?: number; unit: string; secondary: {label: string; value: number|string}[]; updatedAt: string }`. Each web surface has `src/app/routes/<key>.routes.tsx` + `src/features/<key>/`.

**mission3011** (Subdomains Part 1 §1–3). Routes: `/` and `/dashboard` (progress vessel: CSS-only filling container to `units/3011`, units by zone bars, latest approved camps, per-club table), `/camps` (list + "Log a camp" form: president/secretary of any club; fields date, venue, city, units, donors, partner blood bank, participating clubs multi-select, photo links), `/admin` (subdomain:mission3011:manage: approvals desk approve/reject with reason). API: `GET /mission3011/camps?status=`, `POST /mission3011/camps`, `POST /mission3011/camps/:id/approve|reject`, `GET /public/mission3011/dashboard`. Approved camps only count. Summary value = Σ units approved, target 3011.

**drishti** (Part 1 §4–6). Routes: `/dashboard` (100-surgery target gauge, pipeline counts, hospitals, per-club), `/beneficiaries` (log a patient form; list with stage filter; phone shown masked `••••1234` unless project admin), `/surgeries` (pipeline board columns screened→scheduled→operated→followup→closed with "Move to" buttons; keyboard accessible; each move records a surgery row when entering operated). API: `GET/POST /drishti/beneficiaries`, `PATCH /drishti/beneficiaries/:id/stage {stage, surgery?}`, `GET /public/drishti/dashboard`. Phone encrypted with AES-256-GCM (`DRISHTI_PII_KEY`), decrypted only for project admins. Summary value = operated count, target 100.

**rcl** (Part 1 §7–9). Routes: `/standings` (public), `/fixtures` (public; admin enters results inline), `/register` (president/secretary: one team per club per season, roster up to 15). API: `GET/POST /rcl/teams`, `PATCH /rcl/teams/:id`, `GET/POST /rcl/fixtures`, `PUT /rcl/fixtures/:id/result`, `GET /public/rcl/standings`, `GET /public/rcl/fixtures`. Summary value = teams registered.

**careerbridge** (Part 2 §10–13). Routes: `/opportunities` (public browse with filters, verified+filled listings; filled shown with "Filled" badge), `/:id` (detail; apply URL / contact reveal button), `/post` (public form; honeypot; success "check your email"), `/admin` (verification desk: pending list, verify/reject/mark filled/expire; posted-vs-filled counters). Expiry job daily marks verified listings older than `careerbridge.expiryDays` as expired. Summary value = verified open listings, secondary filled count.

**ride** (Part 2 §14–17). Routes: `/incoming` (public list of delegations with dates, headcount, assigned host clubs), `/support-club` (president/secretary registration form: capacity, homestay, preferred months, contact; one per club per RY; editable), `/gallery` (public; year tabs; photos via ImageSlot, videos embedded for youtube.com/youtu.be/drive.google.com/file), `/admin` (subdomain:ride:manage: delegations CRUD; host assignment drawer listing registered support clubs with capacity and preferred-month match; add host row with days hosted and members sent; multiple hosts per delegation). API: `GET/POST /ride/support-clubs`, `GET/POST/PATCH /ride/delegations`, `PUT /ride/delegations/:id/hosts { hosts: {clubId, daysHosted, membersSent}[] }` (replaces set; audited; recompute for every affected club; notifies hosts), `GET/POST/DELETE /ride/gallery`. Summary value = delegations this RY, secondary host clubs count.

---

## 11. Deployment and configuration

### 11.1 Infrastructure (already exists)
- Postgres 18 container `rac3011-postgres` on the Oracle instance, reachable from the VPS as `10.44.44.2:5434`, db `rac3011`, user `rac3011`. Password in `~/.claude/secrets.md` under "RAC District 3011 Website — Postgres (Oracle)".
- VPS `15.235.211.41` runs Dokploy; Cloudflare proxies `rotaract3011.org`; origin cert `/etc/ssl/cloudflare/rotaract3011.pem` + `.key`.
- Redis: create Dokploy service `rac3011-redis` (redis:7, no public port).

### 11.2 Environment variables (exact names)
API: `NODE_ENV`, `PORT` (3000), `WORKER` (unset|1), `DATABASE_URL`, `SHADOW_DATABASE_URL` (CI only), `REDIS_URL`, `AUTH_SECRET` (32+ bytes), `AUTH_URL` (`https://api.rotaract3011.org`), `COOKIE_DOMAIN`, `WEB_ORIGINS` (comma list), `MAIL_DRIVER` (console|pool), `MAIL_FROM` (`Rotaract District 3011 <no-reply@rotaract3011.org>`), `MAIL_ALLOWLIST`, `RESEND_API_KEY`, `RESEND_DAILY_CAP`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_DAILY_CAP`, `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD`, `GMAIL_DAILY_CAP`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:...`), `GOOGLE_SERVICE_ACCOUNT_JSON_B64`, `DRR_CALENDAR_ID`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `DRISHTI_PII_KEY` (32-byte hex), `SENTRY_DSN`, `LOG_LEVEL`, `SEED_DEV`.
Web (build-time): `VITE_API_ORIGIN`, `VITE_SENTRY_DSN`, `VITE_VAPID_PUBLIC_KEY`.

### 11.3 Dokploy apps (project `rac3011`)
- `rac3011-api`: Docker image built by GitHub Actions to `ghcr.io/rbansal42/rac3011-api:main`; command default; domain `api.rotaract3011.org`; healthcheck `/health`. Run `prisma migrate deploy && npm run seed` as the container entrypoint pre-step (`docker-entrypoint.sh`).
- `rac3011-worker`: same image, env `WORKER=1`, no domain.
- `rac3011-web`: Dockerfile build from repo; domains `staging.rotaract3011.org` initially; at cutover add `rotaract3011.org`, `www.rotaract3011.org`, `mission3011.`, `drishti.`, `rcl.`, `careerbridge.`, `ride.rotaract3011.org`.
Cloudflare DNS: proxied `A` records for each hostname → `15.235.211.41`. Host nginx vhost per hostname proxying to Traefik `127.0.0.1:18080` with the origin cert (copy the existing `staging.rotaract3011.org` vhost).

### 11.4 Web CSP (nginx `add_header Content-Security-Policy`)
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://drive.google.com https://*.googleusercontent.com https://photos.google.com https://*.ggpht.com https://i.ytimg.com; media-src 'self' https://drive.google.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://drive.google.com; connect-src 'self' https://api.rotaract3011.org https://*.sentry.io; worker-src 'self'; manifest-src 'self'`

### 11.5 CI (GitHub Actions, both repos)
API: `npm ci` → `npm run lint` → `npx prisma validate` → `npm run test` → `npm run test:e2e` (service container postgres:18 for shadow + testcontainers) → migration replay check (`prisma migrate deploy` on a fresh DB) → build image → push GHCR on `main` → call Dokploy redeploy API. Web: `npm ci` → `tsc -b` → `npm test` → `npm run build` → `npx playwright test` (against `vite preview` + API mock server in `e2e/mock-api.ts`) → Dokploy redeploy on `main`.

---

## 12. Acceptance tests (must exist and pass)

API e2e (supertest, real Postgres):
1. Login with legacy-migrated president → 2FA email OTP required → verify → `/me` shows `president` scoped to their club and `member` role.
2. President of club A `GET /reports/:idOfClubB` → 404. ZRR of Zone Prithvi lists `/reports/overview` → only Prithvi clubs. DSC sees all.
3. Submit report with `physical_meetings=3`, two activities (one flagship, one community with 4 collaborating clubs) → `club_point_entries` has `club_physical_meetings=60`, `flagship_continued=50`, `cd_collaboration` tier [2,6)=20, `rep_on_time=20` when before deadline.
4. Update `club_facts.paulHarrisFellows=2` → `ri_phf` yearly entry 500; update again to 1 → 250 (idempotent replace). `drr_visit` once: set date twice → single entry 40.
5. Judged points without reason → 400; with reason → audit_log row with before/after.
6. Check-in 6 of 12 approved members of club X to a district event → `cd_attendance` = 20 for that month.
7. Member self-registers → president receives `member-registered` outbox row; approve → member sees `/me/club`; duplicate email register → 409.
8. CSV import with 3 rows: one existing (link), one new, one duplicated inside file (skip) → counts `{created:1, linked:1, skipped:1}`.
9. Directory: opt-in without privacy acceptance → 409; after acceptance → listed; non-opted members never appear.
10. Showcase: member submits with consent → president notified; DSC edits published copy and publishes → `/public/showcase/:slug` returns published copy, not submitted text; collaborator clubs returned as objects with ids.
11. Announcement audience `{roleKeys:['secretary'], zoneIds:[Agni]}` estimate = number of secretaries of Agni clubs; sending creates one outbox row per recipient per channel; president targeting another club → 403.
12. Email pool: with usage resend=100 for today → next send uses mailgun; when mailgun send throws → gmail used and outbox `provider='gmail'`.
13. DRR booking on a slot overlapping a Google busy interval → 409; valid → `requested` + `googleEventId` set (fake Google client); confirm → notification `booking-confirmed`.
14. RIDE: assign hosts `[A: 3 days, 2 members]` → A gets `is_ride_hosting_days=120`, `is_ride_members_sent=60`, `is_ride_both=50`; reassign to B → A's entries removed.
15. Career Bridge: post → `pending_email`; verify token → `pending`; verify by admin → visible in `/public/careerbridge/listings`; expiry job after N days → `expired` hidden.
16. RCL: two teams, one result 150/5 in 20 ov vs 120/8 in 20 ov → standings winner 2 pts, NRR +1.5/−1.5.
17. Link health: Drive id returning 404 from fake Drive client → status broken → owner gets `link-broken` once; rerun → no second notification.
18. `POST /public/visits` twice from same IP within a minute → second is 429; counter increments once.

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
