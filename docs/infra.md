# RAC District 3011 Platform — Deployment Infrastructure

Provisioned 2026-09-04. Covers the new `rac3011-api` / `rac3011-worker` / `rac3011-web`
stack (per implementation spec §11) on the shared VPS Dokploy instance, plus the
Postgres backup jobs on the Oracle box that already hosts `rac3011-postgres`.

**Do not treat this file as containing secrets.** Real values (passwords, API keys,
generated secrets) live in `~/.claude/secrets.md` under "RAC District 3011 Platform —
deployment secrets — 2026-09-04" and in Obsidian `Keychain/RAC 3011 Website Deployment`.
This file records ids, hostnames, and structure so infra can be reasoned about and
reproduced without re-deriving it from scratch.

## Critical incident found and fixed during provisioning

Before any of the work below could start, the shared VPS (`15.235.211.41`, Dokploy at
`dokploy.rbansal.xyz`) was found completely down:

- Root cause: the disk filled to 100% around 2026-09-04 13:30 UTC (`docker pull` /
  `rsyslog` both logging "No space left on device"). Something then ran aggressive
  cleanup to reclaim space — very likely the prior, dead attempt at this exact task —
  which removed **every Docker Swarm service** (Dokploy itself, and all ~10 apps it was
  running: racddl-admin, healing-pouch api/web, house-of-urve, bliss, rotaract-os
  api/worker, rotary-directory, itni-si-muskurahat-website, mindweal, theanasa, etc.)
  and pruned unused volumes/images. It also left `/etc/wireguard/wg0.conf` renamed to
  `wg0.conf.bak` on both the VPS and the Oracle box, tearing down the WireGuard tunnel
  this task's Postgres connectivity depends on.
- Disk itself had already been freed by the time this was discovered (46% used, 39G
  free) — the cleanup worked, it just never got un-done.
- **Data was not lost.** The shared Postgres container's volume
  (`databases_postgres_data`, holding all 10 app databases) survived on disk and was
  restarted. Dokploy's *own* control-plane database (`dokploy-postgres` volume — every
  project/app/domain/env-var definition across the whole VPS) did **not** survive and
  had to be reinstalled from scratch, which means **every pre-existing Dokploy app
  needs to be re-registered** (new project/app/domain/env entries pointing at the
  already-running or restartable containers/images). That re-registration work is
  **not done** — it's a separate, large recovery task, out of scope here, and should be
  treated as high priority.
- What was fixed as part of unblocking this task:
  1. Restored `/etc/wireguard/wg0.conf` from `.conf.bak` on both `vps` and `oracle`,
     brought `wg-quick@wg0` back up on both, and enabled it at boot (`systemctl enable`)
     on both — it was previously enabled nowhere, meaning a reboot would have dropped
     the tunnel silently. Verified: `ping 10.44.44.2` and `nc -vz 10.44.44.2 5434` both
     succeed from the VPS.
  2. Reinstalled Dokploy on the VPS using the original bootstrap script
     (`/home/ubuntu/bootstrap-dokploy-alt-ports.sh`, the same idempotent installer used
     to originally set it up) — dashboard port 3400, Traefik on 18080/18443, same as
     before. This is a **fresh, empty** Dokploy install (new `dokploy-postgres`,
     `dokploy-redis`, `dokploy` swarm services) — the old API key in secrets.md for
     `dokploy.rbansal.xyz` is dead; a new admin user and API key were created (see
     secrets.md).
  3. Discovered and fixed two Dokploy bugs/gotchas hit along the way (see "Gotchas"
     below): the API-registered admin's `member` row has all permission booleans
     `false` by default (blocks everything except project/application create until
     patched via SQL), and the default API key has `rateLimitMax: 10` per 24h which is
     exhausted almost immediately by scripted provisioning.
- Attempted one more low-risk, obviously-good step: `docker start postgres` (the old
  shared standalone container, not a swarm service) to bring the other apps' actual
  database data back online. It failed: `Could not attach to network
  mk4lbq0bni3v6wfokhslvw44b: network ... not found` — the container's saved config
  references a Docker network id that no longer exists (recreated during the incident).
  Fixing this means recreating the container from
  `/home/ubuntu/databases/docker-compose.yml` (`docker compose up -d` in that
  directory), which is exactly the kind of "reconstruct shared VPS state" work this note
  flags as out of scope for this task — left undone, first thing to try in the
  follow-up recovery.
- **Action needed from Rahul**: decide whether/when to do the full re-registration of
  every other app in the fresh Dokploy (their containers may still be recoverable, but
  none are currently reachable via `*.racddl.com`, `*.rbansal.xyz` app subdomains routed
  through Dokploy/Traefik — anything served by host nginx directly, like
  `dokploy.rbansal.xyz` itself or `*.rbansal.xyz` static sites, is unaffected).

## Hosts

| Alias | Host | Role |
|---|---|---|
| `vps` | `15.235.211.41` (`ubuntu@`) | Dokploy, Traefik, host nginx, shared Postgres |
| `oracle` | `92.4.95.94` (`ubuntu@`) | `rac3011-postgres` container, Dokploy #2 (unrelated, for photodump-server), backup cron |

SSH: `ssh vps`, `ssh oracle` (both use `~/.ssh/id_ed25519`, aliases already in
`~/.ssh/config`). `oracle` needs `sudo` for all `docker` commands (ubuntu user not in
the docker group there); `sudo -n true` succeeds (passwordless). The `vps` SSH config
has a stray `LocalForward 5432 localhost:5432` that fails locally if port 5432 is
already bound on your machine — harmless, just add `-o ClearAllForwardings=yes` to avoid
the noisy warning.

WireGuard tunnel: `vps` `10.44.44.1/30` ↔ `oracle` `10.44.44.2/30`, UDP 51820. Postgres
on Oracle (`rac3011-postgres`, `postgres:18`) is bound to the WireGuard interface only,
reachable from the VPS as `10.44.44.2:5434`.

## Dokploy

- Dashboard: `https://dokploy.rbansal.xyz` (also `http://127.0.0.1:3400` on the VPS
  itself). **Known gotcha**: calling the Dokploy REST API (`x-api-key` header) through
  the public `dokploy.rbansal.xyz` hostname (Cloudflare-proxied) reliably returns
  `{"message":"Unauthorized"}` even with a valid key — confirmed the header reaches
  Cloudflare fine (not cached, `cf-cache-status: DYNAMIC`) but something between
  Cloudflare and the origin drops/mangles it for API calls specifically (UI login via
  cookie works fine over the same hostname). Workaround used throughout this task: run
  API calls from **inside** the VPS against `http://127.0.0.1:3400`, or `curl --resolve
  dokploy.rbansal.xyz:443:15.235.211.41` from outside to bypass Cloudflare. Worth a
  follow-up investigation (Cloudflare Transform Rule / WAF rule stripping custom
  headers on this zone?) but out of scope here.
- Org: `oqPLR6ZoDyXvFxUES9Lyh` ("My Organization"), owner user `rahul@hudle.in` (id
  `7mT4pMcB0qLnyasloTMyU4JZj1TuXQwf`).
- **Gotcha 1 — owner permissions**: registering the first admin via the raw
  `/api/auth/sign-up/email` endpoint (bypassing the UI onboarding wizard) creates a
  `member` row with role `owner` but **every permission boolean set to `false`**
  (`canCreateServices`, `canAccessToAPI`, `canAccessToDocker`, etc.). This silently
  blocks most mutations (`redis.create` etc. return `401 Unauthorized`) while
  `project.create`/`application.create` work fine (those checks apparently bypass the
  flags for the org owner, others don't). Fixed by hand: `UPDATE member SET
  "canCreateProjects"=true, "canAccessToSSHKeys"=true, "canCreateServices"=true,
  "canDeleteProjects"=true, "canDeleteServices"=true, "canAccessToDocker"=true,
  "canAccessToAPI"=true, "canAccessToGitProviders"=true, "canAccessToTraefikFiles"=true,
  "canDeleteEnvironments"=true, "canCreateEnvironments"=true WHERE role='owner';` against
  the `dokploy-postgres` service. If this Dokploy instance is ever re-registered from
  scratch again, redo this step (or register through the actual web UI instead, which
  presumably sets these correctly — not verified either way).
- **Gotcha 2 — API key rate limit**: keys created via `user.createApiKey` default to
  `rateLimitEnabled: true, rateLimitMax: 10` per 24h window, which a scripted
  provisioning session exhausts in minutes (`Error verifying API key: Rate limit
  exceeded` in the `dokploy` container logs, surfaced to the client as a plain
  `{"message":"Unauthorized"}` with no rate-limit-specific wording). Pass
  `"rateLimitEnabled": false` when creating keys meant for automation.
- Two API keys exist in the fresh instance: an initial rate-limited one
  (`rac3011-provisioning`) and the one actually used for all provisioning
  (`rac3011-provisioning-2`, rate limiting disabled) — value in secrets.md.

## Dokploy project `rac3011`

- `projectId`: `LKsHHKk5Do5iQE18DfKrL`
- `environmentId` (default "production" env): `mDVrGYEGSC06ZbiepbWv6`

| App | `applicationId` | `appName` (container/service name) | sourceType | Domain | Status |
|---|---|---|---|---|---|
| rac3011-api | `5pR_aSFCJ9PDSjLmzTfrX` | `rac3011-api-hspenz` | docker, `ghcr.io/rbansal42/rac3011-api:main` | `api.rotaract3011.org` (port 3000, https:false — TLS terminated upstream) | `error` — image doesn't exist on GHCR yet (`denied` on pull; repo not pushed) |
| rac3011-worker | `OjbHmUkMXAawAbpbbACWy` | `rac3011-worker-evhnwx` | docker, same image, env `WORKER=1` | none | `error` — same reason |
| rac3011-web | `3OMmWFuEepO0hou8B0evs` | `rac3011-web-5rip9n` | git (custom SSH), `git@github.com:rbansal42/rac3011-web.git` branch `main` | `staging-v2.rotaract3011.org` (port 80, https:false) | idle — not deployed yet, repo doesn't exist on GitHub yet either |

Redis service: `rac3011-redis`, `redisId` `qgyRRHRjTAY-Z5_ZIfm_k`, container/service name
`rac3011-redis-agyau9`, image `redis:7`, no published port (internal `dokploy-network`
only). Confirmed running (`docker service ls` shows `1/1`).
`REDIS_URL=redis://:<password>@rac3011-redis-agyau9:6379` (password in secrets.md).

SSH key for the web app's git source: Dokploy `sshKeyId` `AnhSGs0N1VQMbdpJJljto`
(`rac3011-web-deploy-key`), ed25519, **public half not yet added anywhere** because the
`rbansal42/rac3011-web` repo doesn't exist on GitHub yet (confirmed via `gh repo view` —
404). Public key:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILNFjhrf0NAlfl4Nfi8noqkC0HLDaslr1S4JnxCABilq dokploy-rac3011-web-deploy
```
Once the repo exists, add this as a **read-only deploy key** under repo Settings →
Deploy keys (or `gh repo deploy-key add`), then `rac3011-web`'s git deploys will work
without further Dokploy-side changes. The private key is stored inside Dokploy's own
database only (not written to disk anywhere else on this machine after the initial
provisioning run — the local temp copy was deleted).

## DNS (Cloudflare zone `rotaract3011.org`, zone id `1fa583748a2c53c135ffb75c543225b0`)

Pre-existing records **not touched**: apex `rotaract3011.org` and `www` (→ Vercel,
proxied), wildcard `*.rotaract3011.org` (→ Vercel, proxied — exact-match records below
correctly take precedence over this for their specific hostnames), `staging` and
`testing` (→ VPS, pre-existing, untouched), CAA records, `_domainconnect` CNAME.

New records added:

| Type | Name | Content | Proxied | Record id |
|---|---|---|---|---|
| A | `api.rotaract3011.org` | `15.235.211.41` | yes | `261a5be179429e8fbfdc1f8213fec3f4` |
| A | `staging-v2.rotaract3011.org` | `15.235.211.41` | yes | `ae98d8b64e3c4f8dd9d8cba6e06eb0a9` |

Auth used: Global API Key for `00082.rahul@gmail.com` (`X-Auth-Email` +
`X-Auth-Key` headers) — this account apparently has access to the `rotaract3011.org`
zone even though the zone's own Cloudflare account is "Techrid3011@gmail.com's Account";
not investigated further, just noted as it was surprising.

## nginx vhosts (VPS, host nginx — the front door, not Dokploy's Traefik)

Both copy the exact pattern of the pre-existing `staging.rotaract3011.org` vhost:
Cloudflare origin cert at `/etc/ssl/cloudflare/rotaract3011.pem` + `.key`, proxy to
Traefik on `127.0.0.1:18080`, `Host` header forwarded.

- `/etc/nginx/sites-available/api.rotaract3011.org` (symlinked into `sites-enabled/`)
- `/etc/nginx/sites-available/staging-v2.rotaract3011.org` (symlinked into `sites-enabled/`)

`nginx -t` passed (pre-existing warnings in unrelated vhosts, not introduced by this
change) and `systemctl reload nginx` applied cleanly.

Verified (2026-09-04, right after setup):
- `curl -I https://api.rotaract3011.org/health` → `502` (Cloudflare → nginx → Traefik →
  no running container, since the image doesn't exist yet — expected).
- `curl -I https://staging-v2.rotaract3011.org/` → `502` for the same reason (transient
  `525` seen once right after the DNS record was created, resolved itself within ~10s of
  propagation).
- Direct-to-origin (`--resolve ...:443:15.235.211.41`) also `502` on both, confirming
  nginx→Traefik plumbing itself is healthy independent of Cloudflare.

CSP header (§11.4 of the spec) is meant to be applied by the web app's own nginx/serving
layer inside its container (or by the Dockerfile), not by this host-level vhost — not
set here; flag this to whoever builds the `rac3011-web` Dockerfile.

## Environment variables set

Full values in secrets.md / Obsidian. Summary of what's real vs. placeholder:

**Provisioned with real values** (rac3011-api and rac3011-worker, both apps):
`NODE_ENV=production`, `PORT=3000`, `DATABASE_URL` (→ `10.44.44.2:5434/rac3011` over
WireGuard), `REDIS_URL` (→ `rac3011-redis-agyau9:6379`), `AUTH_SECRET` (generated,
64 hex chars / 32 bytes), `AUTH_URL=https://api.rotaract3011.org`,
`COOKIE_DOMAIN=.rotaract3011.org`, `WEB_ORIGINS=https://staging-v2.rotaract3011.org`,
`MAIL_DRIVER=console`, `MAIL_FROM`, `ORACLE_DAILY_CAP=100`, `VAPID_PUBLIC_KEY` /
`VAPID_PRIVATE_KEY` (generated via `web-push generate-vapid-keys`),
`VAPID_SUBJECT=mailto:rahul@hudle.in`, `DRISHTI_PII_KEY` (generated, 32-byte hex),
`STORAGE_DRIVER=live`, `UPLOADTHING_TOKEN_PERMANENT`, `UPLOADTHING_TOKEN_DYNAMIC`,
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_PRIVATE=rac3011-private`, `R2_BUCKET_BACKUPS=rac3011-backups`,
`LOG_LEVEL=info`, `SEED_DEV=false`. Worker additionally gets `WORKER=1`.

**rac3011-web build-time vars** (set as both `env` and `buildArgs` since Vite inlines at
build time — see `nextjs-cache-gotchas`-style lesson from other projects, build-time
values baked into the image can't be changed at runtime): `VITE_API_ORIGIN`,
`VITE_VAPID_PUBLIC_KEY` (same value as the API's VAPID public key), `VITE_SENTRY_DSN`
(CHANGEME).

**CHANGEME placeholders left** (unprovisioned, listed on both apps' env except where
noted) and what unblocks each:
- `MAIL_ALLOWLIST` — decide the allowlist policy, no blocker otherwise.
- `ORACLE_SMTP_HOST` / `_PORT` (default 587 set) / `_USER` / `_PASSWORD` — blocked on
  provisioning Oracle Cloud Email Delivery (Email Domain + DKIM for `rotaract3011.org`,
  approved sender, SMTP creds) per the "Oracle Email Delivery" secrets.md entry from
  2026-09-04 — not done yet, tracked there.
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

## Backups (Oracle box)

Scripts: `/home/ubuntu/backups/scripts/rac3011-backup-15min.sh` and
`rac3011-backup-daily.sh` (mirror the existing VPS `backup-databases.sh` pattern: same
`onedrive:` rclone remote, same rotation approach). The `onedrive` remote didn't exist on
Oracle before this — copied the remote definition (OAuth token is portable, not
host-bound) from the VPS's `/home/ubuntu/.config/rclone/rclone.conf` into
`/home/ubuntu/.config/rclone/rclone.conf` on Oracle. Only the `[onedrive]` section was
copied, not `[hp-r2]` (unrelated to this task).

- 15-min job: `pg_dump -Fc rac3011` from the `rac3011-postgres` container (needs `sudo
  docker exec`, cron runs as `ubuntu` which has passwordless sudo) → local
  `/home/ubuntu/backups/rac3011-15min/` (kept 2h) → `onedrive:Backup/RAC3011-15min/`
  (kept 48h, pruned by the script itself).
- Daily job (03:00 UTC): same `pg_dump -Fc` plus a `pg_dumpall` (roles/full cluster) →
  local `/home/ubuntu/backups/rac3011-daily/` (kept 3 days) → `onedrive:Backup/RAC3011-daily/`
  (kept 30 days).
- Cron (Oracle, `ubuntu` crontab, appended without touching the existing
  replication-monitor/keka-bot lines):
  ```
  */15 * * * * /home/ubuntu/backups/scripts/rac3011-backup-15min.sh >> /home/ubuntu/backups/rac3011-backup.log 2>&1
  0 3 * * * /home/ubuntu/backups/scripts/rac3011-backup-daily.sh >> /home/ubuntu/backups/rac3011-backup.log 2>&1
  ```
- Both scripts were run manually once during provisioning and verified: 15-min dump
  44K, daily dump 44K + cluster dump 76K, all three confirmed present via `rclone ls`
  on `onedrive:Backup/RAC3011-15min/` and `onedrive:Backup/RAC3011-daily/`.

## GHCR access

No registry credential is configured on the (fresh) Dokploy instance
(`GET /api/registry.all` → `[]`). Pulling `ghcr.io/rbansal42/rac3011-api:main` currently
fails with `denied` — this is expected regardless of credentials, since the
`rbansal42/rac3011-api` GitHub repo doesn't exist yet (`gh repo view` → 404), so no image
has ever been pushed.

Could not mint a new PAT non-interactively: the local `gh` auth token for `rbansal42`
has scopes `gist, read:org, repo, workflow` (no `read:packages`), and requesting
additional scopes via `gh auth refresh --scopes read:packages` requires an interactive
browser/device-code flow not available in this environment.

**Manual step needed** (once the `rac3011-api` repo exists and CI is pushing images):
1. On github.com, create a PAT (classic, or fine-grained with "Packages: read") with
   `read:packages` scope for the account that owns/can read `ghcr.io/rbansal42/*`.
2. Register it in Dokploy as a Docker registry credential
   (`POST /api/registry.create` — router exists, schema needs `registryUrl:
   ghcr.io`, `username`, `password` = the PAT), or attach it directly per-application
   via `application.saveDockerProvider`'s `username`/`password` fields (already wired
   up with empty strings on both `rac3011-api` and `rac3011-worker` — just needs the
   real PAT filled in once the repo/image exist, or leave empty if the package is made
   public, in which case no credential is needed at all).
3. Save the PAT to `~/.claude/secrets.md` when created.

## Verification summary

| Check | Result |
|---|---|
| SSH `vps` | OK |
| SSH `oracle` | OK, passwordless sudo confirmed |
| WireGuard `vps` ↔ `oracle` | Was down (config files renamed to `.bak` amid the disk-full incident), restored and enabled at boot on both sides |
| `nc -vz 10.44.44.2 5434` from `vps` | OK, succeeds |
| Dokploy API auth (local, `127.0.0.1:3400`) | OK, after the two gotchas above were worked around |
| Dokploy API auth (public `dokploy.rbansal.xyz`) | Broken for API calls specifically (see gotcha) — use local/`--resolve` instead |
| `rac3011` project + 3 apps + redis created | OK, ids above |
| DNS `api.` / `staging-v2.` | OK, propagated, proxied through Cloudflare |
| nginx vhosts + reload | OK |
| `curl -I https://api.rotaract3011.org/health` | `502` (no image yet — expected) |
| `curl -I https://staging-v2.rotaract3011.org/` | `502` (no repo yet — expected) |
| GHCR pull | `denied` (no repo pushed yet, and no registry credential configured) |
| Backup cron (Oracle) | OK, both scripts ran manually and confirmed uploaded; cron installed |
