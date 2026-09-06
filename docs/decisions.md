# Decisions (rac-org-3011-website — infra/org level)

Project-level infra/org decisions for the district platform's GitHub org migration
(`rbansal42` → `round-robin-solutions`) and domain change
(`staging-v2.rotaract3011.org` → `testing.rotaract3011.org`). Per-repo build/code
decisions live in `rac3011-api/docs/decisions.md` and `rac3011-web/docs/decisions.md`;
this file is for decisions that span the org/infra layer.

- 2026-09-04: **`staging-v2.rotaract3011.org`'s Cloudflare A record was left in place**
  (still pointing at Oracle `92.4.95.94` from the earlier same-day infra pass), even
  though the Dokploy `rac3011-web` application's domain was switched from
  `staging-v2.rotaract3011.org` to `testing.rotaract3011.org` (not appended — the app
  now has exactly one domain record). Rahul explicitly said this was low priority either
  way. Conservative choice: leave the DNS record rather than delete it — it now resolves
  to a host with no Traefik route for that hostname (no `domain.create` entry), so it
  will 404/reset harmlessly rather than serve anything, and deleting DNS is harder to
  reverse quickly than deleting an unused-but-inert record later if this repo is revisited.
- 2026-09-04: **GHCR pull credential was NOT recreated or given a new PAT.** The existing
  "GHCR rbansal42" Dokploy registry credential (a `gho_` OAuth-style token, `registryId`
  `3xV9hoh-urh0mGgtP-FBf`) was reused as-is on `rac3011-api`/`rac3011-worker`/`rac3011-web`,
  same as the original infra pass already did. `rbansal42` is confirmed an **org admin**
  (owner-tier) of `round-robin-solutions` (`GET /orgs/round-robin-solutions/memberships/rbansal42`
  → `role: admin`), and this same credential is already the one every other app on this
  Dokploy instance (racddl-admin, house-of-urve, bliss, etc. — all now living under
  `round-robin-solutions/*` forks) uses successfully to pull org-owned GHCR images. Per
  GitHub's documented package permission model, organization owners have implicit access
  to every package the org owns regardless of the package's own visibility setting, so no
  package-visibility change or new fine-grained PAT was expected to be necessary. See
  `infra.md` "GHCR access" section for the actual redeploy-test outcome.
- 2026-09-04: **No fine-grained PAT was minted.** GitHub has no API to create personal
  access tokens (classic or fine-grained) — they can only be created interactively via the
  web UI or `gh auth login`/`gh auth refresh` device flow, neither of which this session
  had interactive browser access to complete. This was the documented fallback path in the
  task brief; it was correctly identified as unavailable rather than attempted and left
  half-done.
- 2026-09-06: **Never use `@Query('nested')` in this API. Express 5 parses query strings
  with the `simple` parser, so bracketed keys arrive flat.** `GET /user-roles?filter[userId]=x`
  had been silently ignoring its filter and returning every user-role grant in the district.
  Root cause: express 5 sets `query parser` to `simple` by default
  (`express/lib/application.js:97`) and `src/main.ts` does not override it, so the request
  arrives as the flat key `{"filter[userId]": "x"}`, never as `{filter: {userId: "x"}}`.
  `user-roles.controller.ts` was the only controller reading `@Query('filter')` directly;
  its `filter?.userId` was therefore always `undefined`. Every other list endpoint routes
  through `parseListQuery`, whose `collectFilters` matches the literal `/^filter\[(.+)\]$/`
  form as well as the nested one, which is exactly why no other endpoint was affected.
  **Rule going forward: every list endpoint takes `@Query() raw` and goes through
  `parseListQuery`.** Fixed in rac3011-api#11 with a regression test in
  `test/rbac/matrix.e2e.ts` that was proven to fail against the old controller.
  Consequence of the bug, had it shipped unnoticed: the `/portal/admin/users` screen shows a
  selected user's grants with a per-row Revoke, so it would have listed the whole district's
  grants under whichever user was selected and revoked the wrong member's role. Not a
  privilege leak (only `super_admin` holds `roles:manage`, which can already read every
  grant) but a destructive wrong-target bug.
  The alternative fix, flipping the global query parser to `extended`, was rejected: it would
  change parsing behaviour for every endpoint at once to repair one controller that had simply
  bypassed the established helper.
- 2026-09-06: **`/portal/admin/roles` does not implement a frontend "super admin" check**,
  despite the task list wording "create role (super admin)". Spec §4.8.5 says `super_admin`
  is a role and not a code path, and §4.8.6 says the frontend never enforces, so the create
  control is gated on the same `roles:manage` route guard as the rest of the screen and the
  API stays the boundary. Related and still open: `rac3011-web/src/lib/permissions.ts:17`
  short-circuits `can()` to true when `roleKey === 'super_admin'`, which is precisely the
  check §4.8.5 forbids. It predates this work (commit `4e90966`) and is not exploitable
  because the API enforces independently, but it should be removed.
