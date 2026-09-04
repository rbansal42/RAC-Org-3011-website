# RAC District 3011 Platform — Deployment Infrastructure

Provisioned 2026-09-04 (Oracle), correcting a same-day VPS-targeting attempt that is now
superseded. Covers the `rac3011-api` / `rac3011-worker` / `rac3011-web` stack (per
implementation spec §11) on the Oracle Dokploy instance, which already hosts the
`rac3011-postgres` database and the daily/15-min backup cron. Same-day, the platform's
GitHub org and public domain also changed (`rbansal42` → `round-robin-solutions`,
`staging-v2.rotaract3011.org` → `testing.rotaract3011.org`) — see "GitHub org + domain
migration" below for that reconciliation.

**Do not treat this file as containing secrets.** Real values (passwords, API keys,
generated secrets) live in `~/.claude/secrets.md` under "RAC District 3011 Platform —
Dokploy project + apps (rac3011)" and in Obsidian `Keychain/RAC 3011 Website Deployment`.
This file records ids, hostnames, and structure so infra can be reasoned about and
reproduced without re-deriving it from scratch.

## Superseded: the VPS attempt

Rahul decided the shared VPS (`15.235.211.41`, Dokploy at `dokploy.rbansal.xyz`) is being
decommissioned entirely and moved everything to the Oracle Cloud instance instead. A
same-day prior task had already provisioned a `rac3011` Dokploy project on the VPS
(projectId `LKsHHKk5Do5iQE18DfKrL`, apps `rac3011-api`/`rac3011-worker`/`rac3011-web`,
DNS for `api.` and `staging-v2.` pointed at the VPS, nginx vhosts on the VPS) — all of
that is now moot. It was **not** cleaned up (VPS Dokploy was left untouched entirely, per
explicit instruction not to operate on a box being decommissioned separately); it will go
away along with the rest of the VPS. If the VPS is ever revisited before decommission,
that orphaned project can be deleted via its Dokploy API, but this is not worth doing on
its own.

Note: the VPS-side `docs/infra.md` predecessor (this file's previous revision) also
recorded a detailed "critical incident" — a disk-full event on the VPS that allegedly
wiped Dokploy and took down racddl-admin, healing-pouch, house-of-urve, bliss,
rotaract-os, rotary-directory, itni-si-muskurahat, etc. This directly conflicts with what
this session verified independently: all of those exact apps are healthy and running on
**Oracle's** Dokploy (`dokploy2.rbansal.xyz`), confirmed via `docker service ls` showing
every one of them `1/1` and via each app's live domain serving traffic. That incident
narrative was not re-verified against the VPS (out of scope — VPS was not touched at
all this session) and should not be trusted at face value; it's flagged here rather than
silently dropped, since whoever wrote it may have been confused about which box hosts
what, or the VPS may genuinely be in that state independent of Oracle.

## Hosts

| Alias | Host | Role |
|---|---|---|
| `oracle` | `92.4.95.94` (`ubuntu@`) | Dokploy #2 (`dokploy2.rbansal.xyz`), `rac3011-postgres`, `rac3011` project, backup cron |

SSH: `ssh oracle` (`~/.ssh/id_ed25519`, alias in `~/.ssh/config`). `oracle` needs `sudo`
for all `docker` commands (ubuntu user not in the docker group); `sudo -n true` succeeds
(passwordless).

Oracle also runs Dokploy's own swarm cluster hosting racddl-admin, healing-pouch
api/web, house-of-urve (+staging), bliss, rotaract-os api/worker/web/redis,
rotary-directory, itni-si-muskurahat, anasa, arteo, rotaract-world, photodump-server,
and others — all confirmed `Up`/`1/1` this session. **None of these were modified.**
Their config was read-only inspected (via `application.one`) purely to determine the
Postgres connection pattern and to confirm the GHCR registry credential to reuse.

## Dokploy (Oracle)

- Dashboard: `https://dokploy2.rbansal.xyz` (nominally; see gotcha below — currently only
  reliably reachable from inside Oracle via `http://127.0.0.1:3000`).
- API key: value in secrets.md ("RAC District 3011 Platform — Dokploy project + apps
  (rac3011)"), sent as `x-api-key`. This is the **same key already used** for the
  photodump-server Dokploy provisioning on this instance (per
  `Keychain`/secrets.md "photodump-server — Dokploy deployment (Oracle)") — reused, not
  regenerated.
- **Gotcha — public dashboard hostname is currently broken.** `https://dokploy2.rbansal.xyz/*`
  returns a plain-text `404 page not found` (Traefik's own default-backend response, not
  Dokploy's JSON error format) for both UI and API paths. Root cause: the host `nginx`
  that used to proxy `443 → 127.0.0.1:3000` for this hostname was stopped and disabled
  today (`systemctl` shows `Stopped nginx.service` at `2026-09-04T07:21:13Z`, before this
  session started) in favor of Dokploy's Traefik binding directly to host ports 80/443 for
  all app domains (confirmed: `dokploy-traefik` container publishes `0.0.0.0:80` and
  `0.0.0.0:443` directly, `nginx.service` is `inactive`/`disabled`). Traefik has no route
  registered for the dashboard's own hostname (it only routes domains explicitly added via
  `domain.create` on applications), so the dashboard itself 404s publicly. This is a
  **pre-existing gap, not introduced by this task** — every API call in this task's
  provisioning was made by SSHing into Oracle and hitting `http://127.0.0.1:3000/api/*`
  directly, the same workaround pattern documented for the VPS's similar (but
  differently-caused) "public API broken" issue. Not fixed here — it's shared
  control-plane routing that affects every app's dashboard access on this box, out of
  this task's scope. Follow-up: either register `dokploy2.rbansal.xyz` as a Traefik file-
  provider route, or re-enable nginx on a port Traefik doesn't own.

## Dokploy project `rac3011`

- `projectId`: `LZtk_0V6xvKx0mUFDnIzn`
- `environmentId` (default "production" env): `nNzCRHCyT1N0PtPwmT4FH`

| App | `applicationId` | `appName` | Image | Domain | Status (2026-09-04, post org/domain migration) |
|---|---|---|---|---|---|
| rac3011-api | `0eZ3PUE32RMTbbcolNKRT` | `rac3011-api-ybwq5j` | `ghcr.io/round-robin-solutions/rac3011-api:main` | `api.rotaract3011.org` (port 3000) | pulls and starts, then **crash-loops**: Prisma `Error: P3005 The database schema is not empty` (needs a migration baseline). App/DB issue, not GHCR — `/health` 502s |
| rac3011-worker | `sV4bTThhBQEsebPTBHibc` | `rac3011-worker-0zu2rf` | same image, env `WORKER=1` | none | same crash-loop, same reason |
| rac3011-web | `09a5zLs62V25Wdl6dF2KX` | `rac3011-web-otgv0w` | `ghcr.io/round-robin-solutions/rac3011-web:main` | `testing.rotaract3011.org` (port 80, changed from `staging-v2.rotaract3011.org`) | **live**, `1/1` running, `curl -I https://testing.rotaract3011.org/` → `200` |

### GitHub org + domain migration (2026-09-04)

The district platform's GitHub org and public domain changed same-day, after the above
was first provisioned:

- **GitHub org**: `rbansal42/rac3011-api` and `rbansal42/rac3011-web` → new private repos
  `round-robin-solutions/rac3011-api` and `round-robin-solutions/rac3011-web`, full git
  history pushed. The old personal repos still exist on GitHub untouched, with local
  remotes named `rbansal42-old` (at `/Volumes/Code/rac3011-api` and
  `/Volumes/Code/rac3011-web`).
- **CI rewritten** on both new repos to the same Blacksmith ARM64-only pattern every
  other app on this Dokploy instance uses (`round-robin-solutions/racddl`'s
  `.github/workflows/deploy.yml` was the reference): `runs-on:
  blacksmith-4vcpu-ubuntu-2404-arm`, `useblacksmith/setup-docker-builder@v1`,
  `useblacksmith/build-push-action@v2`, `platforms: linux/arm64` only (no amd64, no
  QEMU — the earlier VPS-era workflow used QEMU multi-arch, which this session's CI
  history shows had timeout problems). Both repos got a new `saveDockerProvider`+
  `redeploy` step gated on `vars.DOKPLOY_BASE_URL != ''`.
- **Image paths** now `ghcr.io/round-robin-solutions/rac3011-api` and
  `.../rac3011-web`.
- **Repo vars/secrets** set on both new org repos: `DOKPLOY_API_KEY` (secret),
  `DOKPLOY_BASE_URL=https://dokploy2.rbansal.xyz` (var), plus
  `DOKPLOY_API_APPLICATION_ID`/`DOKPLOY_WORKER_APPLICATION_ID` (rac3011-api) and
  `DOKPLOY_WEB_APPLICATION_ID` (rac3011-web).
- **Domain**: the `rac3011-web` Dokploy application's domain record (`domainId`
  `RoDUqKi4pDuftV4_0T2FS`) was updated in place from `staging-v2.rotaract3011.org` to
  `testing.rotaract3011.org` via `domain.update` (same `certificateType: letsencrypt`
  pattern as every other domain on this instance — see "TLS / routing" below, unchanged).
  This is Rahul's new requirement: the app lives at `testing.rotaract3011.org`, not
  `staging-v2.`.
- **DNS**: Cloudflare A record for `testing.rotaract3011.org` (zone
  `1fa583748a2c53c135ffb75c543225b0`, record id `494729a16f748a0e1159263c5febc7e9`) was
  repointed from `15.235.211.41` (the decommissioned VPS, where it used to serve the
  *old legacy* `rbansal42/RAC-Org-3011-website` site) to Oracle's `92.4.95.94`. The old
  `staging-v2.rotaract3011.org` A record was **left in place** (still resolves to
  Oracle) even though Dokploy no longer has a domain record routing that hostname — low
  priority per Rahul, conservative choice documented in `docs/decisions.md`. `api.` and
  the legacy production `rotaract3011.org`/`staging.` (Vercel) were untouched.

#### GHCR access — resolved, no visibility change needed

The task assumed the existing GHCR pull credential might not have read access to
`round-robin-solutions`-owned packages once the repos moved into the org, and offered a
fallback of making the packages "internal"/org-visible if genuinely blocked. **Neither
was needed.** Verified by testing directly rather than guessing:

- `rbansal42` (the Dokploy registry credential's username) is confirmed an **org admin**
  (owner-tier) of `round-robin-solutions`: `GET
  /orgs/round-robin-solutions/memberships/rbansal42` → `{"role":"admin","state":"active"}`.
  GitHub's package permission model grants organization owners implicit access to every
  package the org owns, regardless of that package's own visibility setting — this is
  the same reason the credential already worked for the other 7 apps' org-owned images
  before this task started.
- Both new repos' CI ran, and the image build+push step (`useblacksmith/build-push-action@v2`)
  **succeeded** for both `rac3011-api` and `rac3011-web`, confirmed via
  `gh run view --json jobs`. The overall CI run was marked `failure` only because of the
  *next* step (see below) — not the image push.
- A manual redeploy was done via SSH (`ssh oracle "curl ... http://127.0.0.1:3000/api/application.saveDockerProvider"`
  then `.../application.redeploy`) against all three applicationIds. All three pulled
  `ghcr.io/round-robin-solutions/rac3011-*:main` and started with **no auth/manifest
  error** — `docker service ps` shows the old `ghcr.io/rbansal42/rac3011-web:main` task
  shut down and replaced by the new org image, `Running`.
- **No fine-grained PAT was created** (there is no API to mint one; it requires
  interactive browser/`gh auth` device-flow, unavailable this session) and **no package
  visibility was changed** — both were considered per the task brief and ruled
  unnecessary once the redeploy test above succeeded. See `docs/decisions.md`.

Each CI run's own `saveDockerProvider`+`redeploy` step still **fails** (`curl: (22) ...
404 page not found`) because it targets `vars.DOKPLOY_BASE_URL=https://dokploy2.rbansal.xyz`,
the same broken public dashboard hostname documented below (pre-existing, not introduced
by this migration). This means CI merges will keep building+pushing images correctly but
will not auto-redeploy until that routing gap is fixed; redeploys have to be triggered
manually via SSH the same way this session did, exactly as was already true for the
original (VPS-targeted) provisioning.

#### Still blocked: rac3011-api / rac3011-worker crash-loop

Unrelated to GHCR or the org/domain migration: once pulled and started, both containers
exit immediately with Prisma `Error: P3005 The database schema is not empty` (needs
`prisma migrate resolve --applied ...` or an equivalent baseline against the existing
`rac3011` Postgres schema before `prisma migrate deploy` will proceed). This is an
app/DB-state issue that predates this session's org/domain work and was not
investigated or fixed here (out of this task's scope). `curl -I
https://api.rotaract3011.org/health` will keep returning `502` until it's resolved.

Redis service: `rac3011-redis`, `redisId` `g1tOU3T_AVtUmr1cPmUsV`, `appName`
`rac3011-redis-2rddqj`, image `redis:7`, no published port (internal `dokploy-network`
only). Deployed and confirmed running (`docker service ls` shows `1/1`).
`REDIS_URL=redis://:<password>@rac3011-redis-2rddqj:6379` (password in secrets.md).

No git-based source / SSH deploy key was set up for any of the three apps — all use
`sourceType: docker`, matching the task's preference for image-based deploys on an
instance with no GitHub App connected (same pattern as `photodump-server` on this same
Oracle Dokploy).

## Database connection — chosen approach

`rac3011-postgres` (`postgres:18`, standalone container, not a Swarm service) predates
this project and was already running on Oracle, published to the host at
`127.0.0.1:5434` and `10.44.44.2:5434` (the WireGuard address used when the API/worker
were expected to run on the VPS, reaching Oracle over the tunnel).

Now that the apps run on the **same box** as the database, the WireGuard address is
unnecessary indirection. Instead, `rac3011-postgres` was attached directly to
`dokploy-network` (the attachable Swarm overlay network Dokploy uses for all
apps/services on this instance — confirmed `attachable=true`, `scope=swarm`) via:

```
docker network connect dokploy-network rac3011-postgres
```

This is exactly the pattern every other app on this Dokploy instance uses for its own
Redis (e.g. `rotaract-os-api` reaches `rotaract-os-redis-bmzjky:6379` the same way) — an
internal Docker DNS name on the shared overlay network, no host-published port or tunnel
involved. Verified: `docker run --rm --network dokploy-network postgres:18 pg_isready -h
rac3011-postgres -p 5432 -U rac3011` → `accepting connections`.

`DATABASE_URL=postgresql://rac3011:<password>@rac3011-postgres:5432/rac3011` (container's
internal port `5432`, not the host-published `5434`).

**Caveat**: `docker network connect` is a live, per-container operation, not persisted in
any compose file (the container was started standalone, not via `docker compose up`). If
`rac3011-postgres` is ever removed and recreated (image upgrade, etc.), it needs to be
reconnected to `dokploy-network` by hand, or the run/compose definition needs to be
updated to include that network. Not automated as part of this task.

The apps' *other* Postgres-backed peers on this box (`rotaract-os-api`, `racddl-admin`,
`healing-pouch-api`) actually reach a different, host-native (non-containerized) Postgres
process at `172.18.0.1:5432` (the Docker bridge gateway address, since that Postgres
binds `0.0.0.0:5432` on the host directly) — that pattern doesn't apply here since
`rac3011-postgres` is its own dedicated container, not the shared host Postgres. The
`dokploy-network` attach approach above is the correct analog for a dedicated-container
database rather than the shared host one.

## DNS (Cloudflare zone `rotaract3011.org`, zone id `1fa583748a2c53c135ffb75c543225b0`)

`api.rotaract3011.org` (id `261a5be179429e8fbfdc1f8213fec3f4`) — created by the superseded
VPS attempt — was **updated in place** to point at Oracle's public IP `92.4.95.94`
instead of the VPS's `15.235.211.41`. Cloudflare-proxied.

`testing.rotaract3011.org` (id `494729a16f748a0e1159263c5febc7e9`) is the **live app
domain as of 2026-09-04's org/domain migration**, replacing `staging-v2.rotaract3011.org`.
This record pre-existed (created 2026-09-03, pointing at the legacy VPS `15.235.211.41`
where it served the *old* `rbansal42/RAC-Org-3011-website` legacy site) and was
repointed in place to `92.4.95.94`. Cloudflare-proxied.

The old `staging-v2.rotaract3011.org` A record (id `ae98d8b64e3c4f8dd9d8cba6e06eb0a9`) was
**left as-is**, still resolving to `92.4.95.94` — Dokploy's domain record for `rac3011-web`
was moved (not duplicated) to `testing.`, so this hostname no longer has a Traefik route
and 404s/resets. Rahul said this was low priority either way; see `docs/decisions.md`.

Auth used: Global API Key for `00082.rahul@gmail.com` (`X-Auth-Email` + `X-Auth-Key`
headers), same as the original VPS-targeting task used.

**Update 2026-09-04 (later same day, §14.8 of the implementation spec): both records
converted from proxied `A → 92.4.95.94` to proxied `CNAME → <tunnel-id>.cfargotunnel.com`**
— see "Cloudflare Tunnel (rac3011-oracle)" below for the full story, rationale, and
rollback recipe. `api.rotaract3011.org`'s record was deleted and recreated during
troubleshooting, so its **current** id is `621a856f50395c34625f64476455f9db` (the id
`261a5be179429e8fbfdc1f8213fec3f4` referenced above no longer exists).
`testing.rotaract3011.org` kept its id (`494729a16f748a0e1159263c5febc7e9`), just PATCHed
to CNAME. Every other record in this zone (apex, `www`, `*`, `staging.`, `staging-v2.`,
`_domainconnect`) is untouched.

## Cloudflare Tunnel (`rac3011-oracle`) — origin path for api./testing., decided 2026-09-05

**Why**: measured from Delhi, this zone is served from Singapore (free plan has no India
PoP) while the Oracle origin is ~30ms away in India — cold requests were detouring
Delhi→Singapore→India→Singapore→Delhi (520-580ms cold, 141ms warm-connection, 135ms
direct-to-origin, ~30ms origin app time; ~380ms of the cold cost was TCP+TLS setup).
Rahul's decision (§14.8 of the implementation spec): Cloudflare Tunnel (free), not Argo
(paid), not un-proxying (would forfeit WAF + edge cache). Only `api.rotaract3011.org` and
`testing.rotaract3011.org` were moved — every other app/zone on this box or account is
untouched.

- **Tunnel**: `rac3011-oracle`, id `9e53fcd1-9627-45a4-800a-598586f8d92c`, created via
  `POST /accounts/6df5d6f65155cc519f481070550102fc/cfd_tunnel` (API, not
  `cloudflared tunnel login` — no interactive browser available). `config_src: cloudflare`
  (remote-managed ingress, pushed via `PUT .../cfd_tunnel/{id}/configurations`), so the
  ingress rules live in Cloudflare's control plane, not a local `config.yml` on Oracle.
- **Ingress** (2 hostname rules + catch-all 404):
  ```json
  {
    "ingress": [
      { "hostname": "api.rotaract3011.org", "service": "https://127.0.0.1:443",
        "originRequest": { "originServerName": "api.rotaract3011.org", "httpHostHeader": "api.rotaract3011.org" } },
      { "hostname": "testing.rotaract3011.org", "service": "https://127.0.0.1:443",
        "originRequest": { "originServerName": "testing.rotaract3011.org", "httpHostHeader": "testing.rotaract3011.org" } },
      { "service": "http_status:404" }
    ]
  }
  ```
  Target is `https://127.0.0.1:443` (Traefik's `websecure` entrypoint, TLS +
  `letsencrypt` certResolver via HTTP-01 on port 80), **not** port 80 — Traefik's `web`
  entrypoint has a zone-wide `redirect-to-https` middleware, so proxying plain HTTP would
  create a redirect loop against an edge that's already terminating TLS. `originServerName`
  is set explicitly so Traefik's SNI-based per-domain TLS routing picks the right
  router/cert (confirmed via `openssl s_client -connect 127.0.0.1:443 -servername
  api.rotaract3011.org` → `CN=api.rotaract3011.org`, real Let's Encrypt cert).
  `httpHostHeader` preserves the original Host header so Traefik's `Host(...)` router
  rules keep matching (Traefik's service config already has `passHostHeader: true`).
  Verified live on Oracle first, before DNS cutover: `curl -sk
  https://127.0.0.1:443/health -H 'Host: api.rotaract3011.org'` → `200` in ~11ms.
- **Install**: official ARM64 `.deb` (`cloudflared-linux-arm64.deb` from the GitHub
  releases page), `sudo dpkg -i`, then `sudo cloudflared service install <token>` — this
  is the token-based one-shot installer, **not** the Hermes-gateway pattern (that's a
  user-level systemd service; this is a **system-level** unit since it needs no per-user
  state and Oracle already has passwordless root `sudo`). Installer auto-creates:
  - Unit file: `/etc/systemd/system/cloudflared.service` (`enabled`, running as root,
    `ExecStart=/usr/bin/cloudflared --no-autoupdate tunnel run --token-file
    /etc/cloudflared/token`)
  - Token file: `/etc/cloudflared/token`
  - `sudo systemctl status cloudflared` / `sudo systemctl restart cloudflared` /
    `sudo journalctl -u cloudflared -f` to manage.
  - Confirmed `enabled` (survives reboot) and `active (running)`, 4 QUIC edge connections
    registered (Mumbai `bom03`/`bom06`/`bom08`/`bom09`/`bom11` — colo varies per
    (re)connect, not fixed), tunnel status `healthy` via
    `GET /accounts/{acct}/cfd_tunnel/{id}`.
- **DNS cutover**: both `api.rotaract3011.org` and `testing.rotaract3011.org` changed
  from proxied `A → 92.4.95.94` to proxied `CNAME → 9e53fcd1-9627-45a4-800a-598586f8d92c.cfargotunnel.com`.
  **Rollback (one call per hostname, reversible any time)**: PATCH the record back to
  `{"type":"A","content":"92.4.95.94","proxied":true}` — no other zone record needs to
  change, the tunnel/cloudflared can keep running idle either way.
- **Gotcha — expect ~5 minutes of 530/error-1033 after any `cloudflared` restart.**
  Immediately after DNS cutover, `api.rotaract3011.org` returned `530 (error code:
  1033 — "Argo Tunnel error", no active connector found)` consistently for ~8 minutes
  despite the tunnel showing `healthy`/4 connections the whole time in the Cloudflare
  API, correct DNS, correct ingress config, and the origin itself responding `200` in
  11ms when queried directly on the box. Ruled out during troubleshooting: DNS
  misconfiguration (verified via `dig @1.1.1.1`, records correct), duplicate/conflicting
  DNS records (only the expected ones exist — checked the whole zone), WAF/firewall
  rules, page rules, origin rules, load balancers, custom hostnames (none configured on
  this zone), zone SSL mode (`full`, correct). Recreating the DNS record from scratch
  (delete + fresh `POST` instead of `PATCH`-in-place) did not help either — still failed.
  **The actual trigger was restarting `cloudflared` for a diagnostic test**: stopping and
  restarting it broke the *already-working* `testing.rotaract3011.org` too, and both
  hostnames then took **~5 minutes** (not seconds) to start routing correctly again,
  even though the tunnel API reported `healthy` connections within ~5 seconds of
  startup. Conclusion: Cloudflare's edge takes several minutes to propagate a
  Tunnel-hostname's *live* routing state globally after a connector reconnects — likely
  because `cloudflared` briefly logs "No ingress rules were defined... will return 503"
  for about 1 second before it fetches its remote config on every fresh start, and edge
  nodes that probe during that exact window can hold a negative/stale result for
  several minutes before re-checking. **Operational implication: don't restart
  `cloudflared` casually** (e.g. for config tweaks) — each restart costs ~5 minutes of
  possible 530s on both hostnames, worse than the problem the tunnel was built to fix.
  A `systemctl reload` isn't supported by cloudflared for this; the practical mitigation
  is to push ingress changes via the remote `configurations` API (which cloudflared picks
  up live, no restart) rather than reinstalling/restarting the service, and to avoid
  restarts during business hours.
- **Verification after the 5-minute settle**: 40/40 consecutive requests (20 each
  hostname) returned `200` with zero errors; `GET /public/home` twice showed
  `cf-cache-status: HIT` on the second request (tunnel does not break §14.1/14.2 edge
  caching); CORS preflight headers (`Origin: https://testing.rotaract3011.org` →
  `access-control-allow-origin`/`-credentials`) still correct on `api.`; SPA HTML and
  `/health` JSON content both verified byte-for-byte sane (not just HTTP 200).
- **Measured improvement** (Delhi, after the tunnel settled, curl `-w
  time_total`, 2026-09-05):

  | | Baseline (proxied-A, pre-tunnel) | Post-tunnel |
  |---|---|---|
  | `api.rotaract3011.org/health` cold (fresh TCP+TLS each time) | 314-526ms (one 5.2s outlier observed) | 301-498ms, no outliers across 20 reqs |
  | `testing.rotaract3011.org/` cold | 331-598ms | 289-299ms |
  | `api.../health` warm (2nd+ req, reused connection) | 144ms | 134ms |
  | `testing.../` warm (2nd+ req, reused connection) | 147-390ms | 135ms |

  Net effect: real but modest — the origin (Oracle Traefik) already answers in
  single-digit-to-low-double-digit ms, and `s-maxage=600` edge caching (landed the same
  day by the parallel caching workstream) already absorbs most repeat-request cost
  independent of the tunnel. The tunnel's clearest win is **eliminating cold-request
  variance** (no more multi-second outliers) and shaving ~50-250ms off cold/first-hit
  requests by removing the CF-edge→origin TCP+TLS handshake. It did **not** need to be
  rolled back — no regression versus baseline on any measured path.

## TLS / routing — no nginx vhost needed

The task's default assumption (mirror the `photodump.rbansal.xyz` nginx→Traefik-on-18080
pattern) turned out to be **stale** and was not followed, after verifying live state:

- `nginx.service` on Oracle is `inactive`/`disabled` (stopped today, before this session,
  for reasons unrelated to this task — see the Dokploy dashboard gotcha above).
- Nothing listens on `127.0.0.1:18080` any more.
- `dokploy-traefik` binds host ports `80`/`443` directly (`0.0.0.0:80`, `0.0.0.0:443`).
- Every live app domain on this Dokploy instance (`racddl.com`, `api-ros.rbansal.xyz`,
  `thp-api.rbansal.xyz`, etc.) uses `certificateType: "letsencrypt"` with Traefik's own
  ACME HTTP-01 challenge on port 80 (`certResolver: letsencrypt` in
  `/etc/dokploy/traefik/traefik.yml`) — confirmed live: `racddl.com` presents a real
  per-domain Let's Encrypt-issued cert (`CN=racddl.com`, issuer Google Trust Services
  WE1), not a wildcard or Cloudflare origin cert.

So `api.rotaract3011.org` and (originally) `staging-v2.rotaract3011.org` were registered
the same way, via `domain.create` on each application (`certificateType: letsencrypt`,
`https: true`, correct internal port, no separate nginx vhost, no origin-cert file
needed). This matches the *current* convention for every other app on this instance,
superseding the older nginx+Cloudflare-origin-cert pattern the `photodump-server`
secrets.md note (2026-09-02) still describes (that note is now stale for Oracle in
general, not just for this project). The `rac3011-web` domain record was later changed
in place to `testing.rotaract3011.org` via `domain.update` (same `certificateType:
letsencrypt`), not re-created.

Verified 2026-09-04 (before the org/domain migration, images not pushed yet):
- `curl -I https://api.rotaract3011.org/health` → `502` (Cloudflare → Traefik reached
  fine, no backend container running yet since the image doesn't exist — expected).
- `curl -I https://staging-v2.rotaract3011.org/` → `502` (same reason).

Re-verified 2026-09-04 (after the org/domain migration, images pushed and pulled):
- `curl -I https://testing.rotaract3011.org/` → `200`, real `rac3011-web` SPA HTML
  served (edge TLS cert `CN=rotaract3011.org`, Google Trust Services — Cloudflare
  Universal SSL, picked up within minutes of the DNS repoint).
- `curl -I https://api.rotaract3011.org/health` → still `502` — not a GHCR/routing issue
  this time, the container itself crash-loops on a Prisma migration-baseline error (see
  "Still blocked" above).

CSP header (§11.4 of the spec) still needs to be applied by the web app's own
nginx/serving layer inside its container (the `rac3011-web` Dockerfile already runs
`nginx:alpine` — the CSP header should be added to its `nginx.conf`, not at any
host/Traefik layer, since there is no host nginx layer for this app any more).

## Environment variables set

Full values in secrets.md / Obsidian. Summary of what's real vs. placeholder — unchanged
from the original VPS-targeting provisioning (all secrets were **reused**, not
regenerated, per instruction):

**Provisioned with real values** (rac3011-api and rac3011-worker, both apps):
`NODE_ENV=production`, `PORT=3000`, `DATABASE_URL` (→ `rac3011-postgres:5432/rac3011` on
`dokploy-network`, see above — this is the one value that changed from the VPS attempt),
`REDIS_URL` (→ `rac3011-redis-2rddqj:6379`, new password, redis re-created fresh on
Oracle), `AUTH_SECRET`, `AUTH_URL=https://api.rotaract3011.org`,
`COOKIE_DOMAIN=.rotaract3011.org`, `WEB_ORIGINS=https://testing.rotaract3011.org`
(updated 2026-09-04 from `staging-v2.rotaract3011.org` via `application.saveEnvironment`
on both `rac3011-api` and `rac3011-worker`, to match the domain migration — otherwise the
API would reject the web app's CORS origin once it's actually running),
`MAIL_DRIVER=console`, `MAIL_FROM`, `ORACLE_DAILY_CAP=100`, `VAPID_PUBLIC_KEY` /
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:rahul@hudle.in`, `DRISHTI_PII_KEY`,
`STORAGE_DRIVER=live`, `UPLOADTHING_TOKEN_PERMANENT`, `UPLOADTHING_TOKEN_DYNAMIC`,
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_PRIVATE=rac3011-private`, `R2_BUCKET_BACKUPS=rac3011-backups`,
`LOG_LEVEL=info`, `SEED_DEV=false`. Worker additionally gets `WORKER=1`.
`AUTH_SECRET`, `DRISHTI_PII_KEY`, and both `VAPID_*` keys are the **exact same values**
the VPS attempt generated earlier today (reused from secrets.md, not regenerated).

**rac3011-web** is image-based (not a Dokploy git/build source), so Vite's build-time
`VITE_*` vars are **not** set as Dokploy application env — they're baked into the image at
CI build time instead (GitHub Actions repo variables on
`round-robin-solutions/rac3011-web`: `VITE_API_ORIGIN=https://api.rotaract3011.org`,
`VITE_VAPID_PUBLIC_KEY` same value as above, `VITE_SENTRY_DSN` left unset/CHANGEME).

**CHANGEME placeholders left** (unprovisioned, listed on both apps' env except where
noted) and what unblocks each:
- `MAIL_ALLOWLIST` — decide the allowlist policy, no blocker otherwise.
- `ORACLE_SMTP_HOST` / `_PORT` (default 587 set) / `_USER` / `_PASSWORD` — blocked on
  provisioning Oracle Cloud Email Delivery (Email Domain + DKIM for `rotaract3011.org`,
  approved sender, SMTP creds) per the "Oracle Email Delivery" secrets.md entry — Oracle
  Cloud **Email Delivery** (the email product) is a separate thing from Oracle Cloud (the
  infra host) and remains unprovisioned. Not done yet.
- `RESEND_API_KEY`, `RESEND_DAILY_CAP` — need a Resend account/API key for this domain.
- `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_DAILY_CAP` — need a Mailgun account.
- `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD`, `GMAIL_DAILY_CAP` — need a Gmail
  account + app password for the fallback mail driver.
- `GOOGLE_SERVICE_ACCOUNT_JSON_B64`, `DRR_CALENDAR_ID` — need a Google Cloud service
  account with Calendar API access and the actual DRR calendar's id.
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` — need an Anthropic API key for whatever
  AI-assisted feature the spec's `ai` router covers; no key available in secrets.md.
- `SENTRY_DSN` (api) / `VITE_SENTRY_DSN` (web) — need a Sentry project created for this
  app.
- `SHADOW_DATABASE_URL` — intentionally not set; spec marks it CI-only.

## Backups (Oracle box) — unaffected

Same scripts/cron as before this task (they always targeted Oracle, never the VPS, so
the VPS-vs-Oracle decision doesn't change anything here):
`/home/ubuntu/backups/scripts/rac3011-backup-15min.sh` and `rac3011-backup-daily.sh`,
cron entries `*/15 * * * *` and `0 3 * * *` in the `ubuntu` crontab, uploading to
`onedrive:Backup/RAC3011-15min/` (48h retention) and `onedrive:Backup/RAC3011-daily/`
(30d retention).

Re-verified this session: cron still installed, most recent 15-min dump at `16:00` UTC
(2 minutes before the check), most recent daily dump + cluster dump at `15:33` UTC —
all three confirmed present both locally and on the `onedrive` remote via `rclone lsl`.

## GHCR access — original (superseded) provisioning note

**Reused an existing registry credential** rather than creating a new one: this Oracle
Dokploy instance already has a "GHCR rbansal42" credential (`registryId`
`3xV9hoh-urh0mGgtP-FBf`, username `rbansal42`) used by `racddl-admin`, `rotaract-os-*`,
`house-of-urve`, `bliss`, `itni-si-muskurahat`, `arteo`, `anasa`, and others already
running on this instance. The same username/password were applied directly to all three
`rac3011-*` applications via `application.saveDockerProvider`. Confirmed working:
deployment logs show `Login Succeeded` immediately followed by `Error response from
daemon: manifest unknown` — i.e. authentication is fine, the only failure is that no
image had ever been pushed at that point.

**This entire section is now superseded by the "GitHub org + domain migration" section
above** — both `rbansal42/rac3011-api` and `rbansal42/rac3011-web` moved into
`round-robin-solutions` the same day, with CI rewritten to Blacksmith and images now
successfully pushed and pulled under the new org-owned paths.

## Verification summary

| Check | Result |
|---|---|
| SSH `oracle` | OK, passwordless sudo confirmed |
| Oracle public IP | `92.4.95.94`, confirmed via `curl -4 ifconfig.me` on Oracle |
| `rac3011` project + 3 apps + redis created (Oracle Dokploy) | OK, ids above |
| `rac3011-redis` deploy | OK, `1/1` running |
| `rac3011-postgres` reachable via `dokploy-network` | OK, `pg_isready` succeeds at `rac3011-postgres:5432` |
| GitHub org moved `rbansal42` → `round-robin-solutions` (both repos) | OK, full history pushed, old repos untouched |
| CI rewritten to Blacksmith ARM64-only, both repos | OK, both CI runs' build+push jobs succeeded (`gh run view --json jobs`) |
| GHCR org image pull (all 3 apps) | OK — verified via manual SSH redeploy, `docker service ps` shows new `ghcr.io/round-robin-solutions/rac3011-*:main` images `Running`, no auth/manifest error. No new PAT or package-visibility change needed (org-admin implicit access) |
| `rac3011-web` domain moved `staging-v2.` → `testing.rotaract3011.org` | OK, `domain.update` on existing `domainId`, `certificateType: letsencrypt` unchanged |
| DNS `testing.rotaract3011.org` repointed to Oracle | OK, Cloudflare API confirms `92.4.95.94` |
| DNS `api.rotaract3011.org` | unchanged, still `92.4.95.94` |
| DNS `staging-v2.rotaract3011.org` | left as-is (Rahul: low priority), no longer routed by Dokploy |
| `curl -I https://testing.rotaract3011.org/` | **`200`**, real `rac3011-web` SPA served |
| `curl -I https://api.rotaract3011.org/health` | `502` — app/DB issue (Prisma `P3005`, migration baseline needed), not GHCR/routing |
| `WEB_ORIGINS` env on rac3011-api/worker | updated to `https://testing.rotaract3011.org` to match the domain move |
| Backup cron (Oracle) | OK, unaffected |
| VPS orphan project | Left alone — VPS is being decommissioned separately, not touched this session |
| Other 7 `round-robin-solutions` repos / other Oracle apps | Read-only inspection only, not modified |

**Update 2026-09-04/05**: several rows above are now stale — `rac3011-api`'s Prisma
P3005 crash-loop was fixed by a parallel workstream (confirmed `/health` → `200` at the
start of the tunnel task) and both `api.` and `testing.` DNS records are no longer plain
`A → 92.4.95.94` (see "Cloudflare Tunnel" section above for the current state and why).

| Check (Cloudflare Tunnel task) | Result |
|---|---|
| `rac3011-oracle` tunnel created via API | OK, id `9e53fcd1-9627-45a4-800a-598586f8d92c`, status `healthy`, 4 QUIC connections to Mumbai (`bom*`) colos |
| `cloudflared` installed + systemd service | OK, ARM64 `.deb`, `sudo cloudflared service install <token>`, unit `enabled` + `active`, survives reboot |
| Ingress → Traefik `websecure` (127.0.0.1:443) with correct SNI/Host | OK, verified locally pre-cutover (`200` in 11ms) and via `openssl s_client` (correct per-domain LE cert) |
| DNS cutover, both hostnames, proxied A → proxied CNAME to tunnel | OK, only those 2 records touched, rollback recipe recorded |
| Edge routing after cutover | Took ~8 min to stabilize initially, then ~5 min again after a diagnostic `cloudflared` restart (see gotcha above) — **not a permanent break**, self-resolved, no rollback needed |
| Post-settle: 20x `api.../health` + 20x `testing.../` | 40/40 `200`, zero errors |
| `cf-cache-status: HIT` on 2nd `GET /public/home` | OK — tunnel does not break edge caching |
| CORS from `testing.` origin against `api.` | OK, correct `access-control-allow-origin`/`-credentials` |
| Cold/warm latency vs baseline | Modest real improvement, cold-request variance eliminated (see measurement table above) |
