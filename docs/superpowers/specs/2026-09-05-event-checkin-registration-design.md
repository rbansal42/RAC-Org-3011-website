# Event registration and check-in desk: design

Status: agreed 2026-09-05 with Rahul. Supersedes the thin check-in slice in
`2026-09-04-implementation-spec.md` §9.5 (`/portal/admin/events/:slug` EventCheckIn)
and §12 acceptance test 6, both of which assumed members-only RSVP.

## 1. Problem

A district event has a registration desk. People arrive, the desk confirms they are
registered, hands over a kit, and later a separate counter redeems meal coupons.
Organisers need live turnout by club and zone. The current system supports only the
narrow case: members who hold a portal login, RSVP through the portal, and are checked
in one at a time against a members-only table. It cannot represent a guest, an
unactivated member, a coupon, or an offline desk.

## 2. Confirmed decisions

1. All four attendee types are in scope: members with accounts, members without
   accounts, outside guests, and pure walk-ins.
2. Check-in and kit hand-over are one action. There is no separate kit flag.
   Coupons are separate items, redeemed later at their own counter.
3. The desk runs on volunteer phones and must work with the venue network down.
   A laptop shows the live stats board.
4. Codes reach attendees three ways: an emailed QR on registration, the existing
   portal member card, and name or phone lookup at the desk. No printed fallback.
5. Stats cover arrival counts and rate, club and zone breakdown, and coupon
   redemption. Desk performance analytics are out of scope.
6. A guest may be linked to a real club so club and zone turnout is accurate, but
   guest arrivals never count toward that club's attendance points. Only approved
   members score, which preserves the existing rule that walk-ins do not.
7. One redemption per coupon type per person, enforced by a unique constraint.

## 3. Data model

One spine table. Rejected alternatives: keeping `event_rsvps` alongside a new
registrations table (two answers to "who is coming", and the points engine has to
pick one), and bolting a guests table onto the existing pair (every desk, stats and
coupon query becomes a union, which is where the bugs would live).

```prisma
enum RegistrationKind   { member  guest }
enum RegistrationStatus { registered  cancelled }
enum RegistrationSource { portal  public_form  desk  import }

model EventRegistration {
  id              String             @id @default(cuid())
  eventId         String             @map("event_id")
  event           Event              @relation(fields: [eventId], references: [id], onDelete: Cascade)
  kind            RegistrationKind
  memberId        String?            @map("member_id")
  member          MemberProfile?     @relation(fields: [memberId], references: [id], onDelete: Cascade)
  clubId          String?            @map("club_id")
  club            Club?              @relation(fields: [clubId], references: [id])
  guestName       String?            @map("guest_name")
  guestEmail      String?            @map("guest_email")
  guestPhone      String?            @map("guest_phone")
  guestOrg        String?            @map("guest_org")
  status          RegistrationStatus @default(registered)
  source          RegistrationSource
  token           String             @unique @default(cuid())
  shortCode       String             @map("short_code")
  arrivedAt       DateTime?          @map("arrived_at")
  checkedInById   String?            @map("checked_in_by_id")
  checkinMethod   CheckinMethod?     @map("checkin_method")
  checkinClientId String?            @unique @map("checkin_client_id")
  registeredById  String?            @map("registered_by_id")
  notes           String?
  createdAt       DateTime           @default(now()) @map("created_at")
  updatedAt       DateTime           @updatedAt @map("updated_at")
  redemptions     EventCouponRedemption[]

  @@unique([eventId, memberId])
  @@unique([eventId, shortCode])
  @@index([eventId, clubId])
  @@index([eventId, arrivedAt])
  @@index([eventId, status])
  @@index([memberId])
  @@map("event_registrations")
}

model EventCoupon {
  id          String   @id @default(cuid())
  eventId     String   @map("event_id")
  event       Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  key         String
  label       String
  appliesTo   RegistrationKind[] @default([member, guest]) @map("applies_to")
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  redemptions EventCouponRedemption[]

  @@unique([eventId, key])
  @@map("event_coupons")
}

model EventCouponRedemption {
  id             String            @id @default(cuid())
  registrationId String            @map("registration_id")
  registration   EventRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  couponId       String            @map("coupon_id")
  coupon         EventCoupon       @relation(fields: [couponId], references: [id], onDelete: Cascade)
  redeemedAt     DateTime          @default(now()) @map("redeemed_at")
  redeemedById   String            @map("redeemed_by_id")
  clientId       String?           @unique @map("client_id")
  createdAt      DateTime          @default(now()) @map("created_at")
  updatedAt      DateTime          @updatedAt @map("updated_at")

  @@unique([registrationId, couponId])
  @@index([couponId])
  @@map("event_coupon_redemptions")
}
```

`Event` gains `registrationRequired Boolean @default(false)`.

Two constraints Prisma cannot express, added in the hand-written migration SQL:

```sql
alter table event_registrations add constraint event_registrations_identity_ck
  check ((kind = 'member' and member_id is not null and guest_name is null)
      or (kind = 'guest'  and member_id is null     and guest_name is not null));

create unique index event_registrations_event_guest_email_uq
  on event_registrations (event_id, lower(guest_email)) where guest_email is not null;
```

The second one makes a repeat public registration idempotent: the same email for the
same event returns the existing registration and resends its email rather than
creating a duplicate.

### Why check-in is a state, not a table

`arrivedAt` plus `checkedInById` and `checkinMethod` live on the registration row.
The desk then reads and writes one row per scan, the arrival curve is one indexed
column, and a walk-in stops being a special case: it is a registration created at the
desk with `source = desk` and `arrivedAt` set in the same insert. The only cost is
that the points engine's attendance query moves off `event_checkins`, which is a
single repository method with one caller.

### Why there is no entitlement table

A registration is entitled to every coupon on its event whose `appliesTo` contains its
`kind`. One array column replaces a join table and still covers the real case, which
is that guests do not receive the same items as delegates.

### Idempotency without a log table

`checkinClientId` and `EventCouponRedemption.clientId` are UUIDs the phone generates
before the write ever reaches the network. A replay of the device's own queued scan
carries the same id and returns success against the same row. A different id arriving
at an already-arrived row returns the already-checked-in result with the winner's name
and time. Two unique columns replace an append-only scan table, and the audit log
already records who did what.

### Short codes

Six characters from an alphabet with no O, 0, I or 1, unique per event, generated with
retry on collision. Typed at the desk when a camera will not focus.

## 4. Migration, expand then contract

Release one creates the three tables and `Event.registrationRequired`, backfills
registrations from `event_rsvps` with status `going` and from `event_checkins`
(arrival fields carried over, walk-in rows becoming `kind = guest` with `guestName`
from `walkInName`), and moves every read and write, including the points query, to the
new tables. `event_rsvps` and `event_checkins` are left in place untouched.

A later release drops both old tables and renames `Event.rsvpOpen` to
`registrationOpen`. Never bundled with the additive migration: this repo has already
taken a production outage from combining a drop with an add.

## 5. API

Public, unauthenticated, throttled with a honeypot field, following
`careerbridge-public.controller.ts`:

- `POST /public/events/:slug/registrations` with name, email, phone, and either a
  `clubId` from the district's clubs or a free-text `guestOrg`. Returns the short
  code. Sends the `event-registered` notification carrying the QR. Returns 409
  `CAPACITY_FULL` when the event is full.
- `GET /public/registrations/:token/qr.png` renders the QR for embedding in that
  email. The token is the secret, so no session is required.

Authenticated member:

- `PUT /events/:id/registration` creates or cancels the caller's own registration,
  replacing the RSVP action for events flagged `registrationRequired`.

Desk, `events:checkin`, club-scoped exactly as the permission already behaves:

- `GET /events/:id/roster` returns the offline snapshot: event, coupon definitions,
  and every in-scope registration with `id`, `token`, the member's card `qrToken`
  when there is one, `displayName`, `clubId`, `clubName`, `kind`, `shortCode`,
  `phoneLast4`, `arrivedAt`, and redeemed coupon keys. Carries an `ETag` derived from
  the row count and the maximum `updatedAt`; responds 304 when unchanged. Full phone
  numbers and email addresses are deliberately excluded: only the last four digits are
  needed for lookup, and the snapshot sits on a volunteer's personal phone.
- `POST /events/:id/checkins` with `{ clientId, method, occurredAt, token | shortCode |
  registrationId }`. Returns the confirm card, `alreadyCheckedIn`, and when true the
  winner's name and time. Unknown token is a 404.
- `POST /events/:id/registrations` creates a registration at the desk, optionally
  checking in within the same request, and may exceed capacity.
- `POST /events/:id/coupon-redemptions` with `{ clientId, couponKey, token |
  registrationId }`. Redeeming twice returns the original redemption rather than an
  error. Redeeming a coupon whose `appliesTo` excludes the registration's kind is a
  409.
- `GET /events/:id/stats` returns registered, arrived and expected counts, a
  ten-minute arrivals histogram, per-club and per-zone turnout including clubs that
  registered but have nobody present, and per-coupon issued against redeemed.

Organiser, `events:manage`: coupon definition CRUD under `/events/:id/coupons`, and a
CSV export of registrations.

`occurredAt` is stored as `arrivedAt` after clamping to the window
`[event.startsAt - 6h, serverNow]`, so one volunteer's wrong device clock cannot
distort the arrival curve. `createdAt` keeps the true server receipt time, making any
divergence visible.

## 6. Desk experience

One screen. The camera stays open continuously and the operator never taps to scan.
Every result is a full-screen card with a single colour and a single instruction:

- Green: registered. Name and club in large type, coupon chips below, kit due.
- Amber: already checked in, with the time and the volunteer who did it.
- Red: not registered, with a "register and check in" button that does both in one
  action.

Each outcome has its own haptic pattern so a volunteer working a queue does not have
to read the screen. A name or phone lookup field is permanently present for people
with no phone. A persistent badge shows the offline state and the queued scan count.
The same screen switches into coupon mode, where a scan redeems the selected coupon
instead of checking in.

## 7. Offline

Before doors open, the device pulls the roster into IndexedDB. Scans resolve locally
against it, so the confirm card appears with no network at all. Writes queue in
IndexedDB with their client id and `occurredAt` and are flushed by a service worker on
reconnect, with a foreground flush loop as a fallback where Background Sync is
unavailable. First write to commit wins; a later scan of the same person from another
phone receives the amber result rather than an error. The roster is refreshed on
demand and whenever the ETag changes.

## 8. Existing code this changes

- `PointsSourceRepository.countCheckinsForClubAtEvents` queries
  `event_registrations` where `kind = member`, `arrivedAt` is not null and
  `status = registered`. Guests are excluded by kind, preserving today's behaviour
  that only approved members score. Acceptance test 6 is unchanged.
- `AttendanceRecomputeTrigger` continues to fire on check-in, unchanged.
- The public calendar's RSVP control becomes a registration action for events flagged
  `registrationRequired`.
- `/portal/admin/events/:slug`, currently a placeholder, becomes the desk.
- Two new notification templates, `event-registered` and a reworked
  `event-reminder`, both carrying the short code.

## 9. Acceptance tests

1. A guest registers through the public form, receives a token, and is checked in by
   token. The same email registering again returns the same registration.
2. A member registers in the portal and is checked in with their permanent card
   `qrToken`, not the per-registration token.
3. Replaying a check-in with the same `clientId` returns success against the same row
   and does not change `arrivedAt`.
4. A second volunteer checking in the same person with a different `clientId` gets
   `alreadyCheckedIn` with the first volunteer's name and time.
5. `occurredAt` an hour before the clamp window is stored clamped, while `createdAt`
   records the real receipt time.
6. A club-scoped `events:checkin` grant sees only its own club's registrations in the
   roster and cannot check in another club's registrant.
7. Redeeming a coupon twice returns the original redemption; redeeming a coupon whose
   `appliesTo` excludes the caller's kind is a 409.
8. Six of twelve approved members of a club arrive at a district event and the club's
   attendance point input is 50, matching the existing acceptance test 6, while a
   guest linked to that club changes nothing.
9. The public registration form rejects a filled honeypot with a fake success and
   creates no row, and returns 409 when the event is at capacity.
10. Playwright: the desk checks someone in with the browser context offline, the queue
    badge shows one pending scan, and the row reaches the server after the context
    goes back online.

## 10. Phasing

Phase one: schema and migration, all registration paths, the emailed QR, an online
desk, and the stats board. Usable at any venue with working wifi.

Phase two: roster snapshot, IndexedDB queue, service worker, and the offline
conflict paths. This is what makes the desk safe at a venue without.

## 11. Non-goals

Payments and ticketing, waitlists, printed badges, seat or session allocation,
multiple redemptions of one coupon type, desk performance analytics, and photo-based
identity verification. Members currently have no photos on file, so the desk confirms
that a code is valid and unused, not that the bearer is the person named.
