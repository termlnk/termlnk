# termlnk-web — self-hosted server twin of the desktop app

The web edition of [Termlnk](https://github.com/termlnk/termlnk). Same DI container, same business plugins, same vault — the desktop's Electron IPC is replaced with HTTP + WebSocket served by `@termlnk/web-server`, so you can reach your terminals, hosts, AI agent, SFTP, and skills from any modern browser.

> ⚠ **Run termlnk-web only on a machine you trust.** It holds the master key and has the same execution power as the desktop's Electron main process (direct SSH/SFTP, AI inference, local filesystem access). This is **not** a zero-knowledge public backend — that is a separate repository, `termlnk-server`.

## Prerequisites

| Item | Requirement |
|------|-------------|
| OS | Linux x86_64 / arm64 (any distro that runs Docker) |
| Docker | 24+ (with the bundled compose plugin) |
| Network | Able to listen on 443 / 3000, behind a reverse proxy or directly |
| TLS | Strongly recommended: Let's Encrypt auto-issued (built-in caddy profile) or your own reverse proxy |
| Memory | ≥ 1 GiB (SQLite + node-pty + ssh2 + AI inference buffers) |

## 30-second deploy

The image is prebuilt and published to GHCR (multi-arch amd64 / arm64) — no need to clone the whole monorepo or compile locally.

### One-line remote install

```bash
# HTTP only (localhost:3000)
curl -fSL https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy/install.sh | bash

# With automatic HTTPS (Caddy + Let's Encrypt)
curl -fSL https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy/install.sh \
  | bash -s -- --tls termlnk.example.com

# Demo mode (no login, for website embed)
curl -fSL https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy/install.sh \
  | bash -s -- --demo --tls demo.termlnk.com
```

### Local install (from the repo)

```bash
cd apps/web/deploy
./install.sh                                 # HTTP on 127.0.0.1:3000
./install.sh --tls termlnk.example.com       # automatic HTTPS
./install.sh --demo                          # demo mode, HTTP
./install.sh --demo --tls demo.termlnk.com   # demo mode, HTTPS
```

`install.sh` writes the randomly generated master password into `master_password.secret` (mode 600, already gitignored) and injects it as a **docker secret** — it never appears in the container environment or `docker inspect` output. **Back up this password immediately**: losing it makes the vault permanently unrecoverable (same semantics as a password manager such as Bitwarden).

### Lifecycle management (deploy.sh)

After install, `deploy.sh` is the single entry point for all operations:

```bash
./deploy.sh start          # start all services (idempotent)
./deploy.sh stop           # stop all services
./deploy.sh restart        # recreate containers
./deploy.sh status         # docker compose ps
./deploy.sh logs           # tail logs

./deploy.sh update         # pull latest image and restart
./deploy.sh backup         # copy SQLite vault to ./backups/
./deploy.sh restore <file> # restore vault from backup (DESTRUCTIVE)

./deploy.sh shell          # open a shell in the container
./deploy.sh uninstall      # tear down (volumes preserved)
./deploy.sh uninstall --purge  # tear down + delete data volumes (DESTRUCTIVE)
```

Manual equivalent (without `install.sh`):

```bash
cd apps/web/deploy
printf '%s' 'choose-a-strong-passphrase' > master_password.secret
chmod 600 master_password.secret
docker compose up -d
curl http://127.0.0.1:3000/__termlnk-web/status
# {"holderStatus":"unlocked","holderError":null,"authenticated":false}
```

Open `http://127.0.0.1:3000` in a browser, sign in with the master password, and you get the full feature set — equivalent to the desktop app.

### Build from source (air-gapped / custom image)

```bash
cd apps/web/deploy
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

This invokes `apps/web/Dockerfile` with the repo root as build context (`context: ../../..`) in a three-stage build. The first build takes ~5–10 minutes (node-pty must be compiled from source because it ships no Linux prebuild).

## Demo mode

Demo mode bypasses browser authentication and adds decorative macOS-style traffic lights to the header — designed for embedding as a live showcase on the [Termlnk website](https://www.termlnk.com).

### What changes in demo mode

| Feature | Normal | Demo |
|---------|--------|------|
| Login screen | Master password required | Skipped — direct to workbench |
| Traffic lights | Hidden (browser has no window chrome) | Shown (decorative, always active, no click response) |
| Sign-out button | Visible | Hidden |
| tRPC auth gate | Session cookie required | Open (no cookie needed) |
| Master password | Still required (vault encryption) | Still required (vault encryption) |

### Enable demo mode

**Via install.sh:**

```bash
./install.sh --demo --tls demo.termlnk.com
```

**Via environment variable:**

```bash
# In .env or docker-compose environment
TERMLNK_WEB_DEMO=true
```

**Via deploy.sh (edit .env then restart):**

```bash
# Edit .env: set TERMLNK_WEB_DEMO=true
./deploy.sh restart
```

> ⚠ **Never enable demo mode on a deployment that stores real SSH credentials.** Demo mode makes the app publicly accessible without authentication.

## Reverse-proxy production setup

Terminating TLS in front of termlnk-web and keeping it bound to `127.0.0.1:3000` (the container default) is strongly recommended.

### Built-in caddy (simplest, automatic HTTPS)

The compose file bundles a caddy service behind a `tls` profile that automatically requests certificates from Let's Encrypt:

```bash
TERMLNK_WEB_DOMAIN=termlnk.example.com docker compose --profile tls up -d
# or: ./install.sh --tls termlnk.example.com
```

Prerequisites: the domain's A/AAAA records point at this host, and 80/443 are reachable from the internet. Certificates and config are persisted in the `caddy_data` / `caddy_config` volumes. Caddy transparently proxies the `/trpc-ws` WebSocket upgrade and adds `X-Forwarded-Proto: https` (which makes the server flag the session cookie `Secure`).

### Self-managed nginx / caddy

If you already run your own reverse proxy, just point it at `127.0.0.1:3000`. Key requirements:

- Forward the WebSocket upgrade (`Upgrade` / `Connection: upgrade`).
- Set `X-Forwarded-Proto: $scheme` (so the server flags the cookie `Secure`).
- Raise `proxy_read_timeout` / `proxy_send_timeout` to 86400s (terminal sessions are often idle for hours).

nginx example:

```nginx
upstream termlnk_web { server 127.0.0.1:3000; }

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl http2;
    server_name termlnk.example.com;

    ssl_certificate     /etc/letsencrypt/live/termlnk.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/termlnk.example.com/privkey.pem;

    location / {
        proxy_pass http://termlnk_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

## Environment variables

Every `TERMLNK_*` variable can be injected via the `environment:` section of `docker-compose.yml` or your own EnvironmentFile.

| Variable | Default | Description |
|----------|---------|-------------|
| `TERMLNK_MASTER_PASSWORD_FILE` | _empty_ | Path to the master-password file (**preferred in production**; docker / k8s secrets, value never enters the container environment; a single trailing newline is stripped). Takes precedence over the next row |
| `TERMLNK_MASTER_PASSWORD` | _empty_ | Master password inline (mutually exclusive with `_FILE`; convenient for local dev, never write it to any file that enters git) |
| `TERMLNK_WEB_DEMO` | _empty_ | Set to `true` to enable demo mode (bypasses login, shows traffic lights). See [Demo mode](#demo-mode) |
| `TERMLNK_WEB_PORT` | `3000` | HTTP / WS listen port |
| `TERMLNK_WEB_HOST` | `0.0.0.0` in the image / `127.0.0.1` in the process | Listen address |
| `TERMLNK_WEB_TLS_CERT` | _empty_ | Direct TLS certificate (mutually exclusive with a reverse proxy) |
| `TERMLNK_WEB_TLS_KEY` | _empty_ | Direct TLS private key |
| `TERMLNK_WEB_CONFIG_DIR` | `/data` | Config / cache root (SQLite vault, user skills) |
| `TERMLNK_WEB_DB_PATH` | `/data/termlnk-web.db` | SQLite vault file |
| `TERMLNK_WEB_USER_SKILLS_DIR` | `/data/skills` | User skill directory |
| `TERMLNK_WEB_STATIC_ROOT` | `/app/renderer-dist` | SPA dist path (already correct inside the image) |
| `TERMLNK_WEB_MIGRATIONS_DIR` | `/app/resources/migrations` | Drizzle migrations (already set inside the image) |
| `TERMLNK_WEB_BUNDLED_SKILLS_DIR` | `/app/resources/bundled-skills` | Bundled skills (already set inside the image) |
| `TERMLNK_WEB_HOOK_CLI_DIR` | `/app/resources/agent-hook-cli` | AI hook helper source (already set inside the image) |
| `TERMLNK_CLOUD_BASE_URL` | _empty_ | Optional: connect to a `termlnk-server` public cloud for vault sync |
| `TERMLNK_WEB_TAG` | `latest` | Image tag compose pulls (can be pinned to a specific version) |
| `TERMLNK_WEB_DOMAIN` | _empty_ | Public domain for the `tls` profile; required only when caddy is enabled |

## Data persistence

The image declares `/data` as a named volume:

- `termlnk-web.db` — the SQLite vault (host credentials, AI provider config, extension config, ...; field-level ciphertext, encrypted with a key derived from the master key).
- `skills/` — user skills (not the bundled skills).

**Backup strategy**: periodically archive and encrypt the entire `/data` directory. **Keep both the master password and the `master_password.secret` file** — losing either makes the vault unrecoverable.

## Upgrading

```bash
./deploy.sh update
# or manually:
docker compose pull
docker compose up -d
```

The `/data` volume survives upgrades; on startup the new image automatically applies any pending Drizzle schema migrations. Source-build users run `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build` instead.

## Security checklist

- ✅ `master_password.secret` is mode `600`, owned by the deployer, and gitignored (it is by default).
- ✅ The container binds only to `127.0.0.1` (default); the reverse proxy enforces HTTPS upstream.
- ✅ The reverse proxy correctly forwards `X-Forwarded-Proto: https`, so the session cookie gets the `Secure` flag.
- ✅ The `/data` volume (which contains the SQLite vault file) is never placed in a public backup.
- ✅ Don't run on a shared host — termlnk-web holds the vault key, which is equivalent to root login.
- ✅ When using the prebuilt image, pin `TERMLNK_WEB_TAG` to a specific version (e.g. `v0.1.0`) to avoid silently pulling a newer version with breaking changes.
- ✅ Demo mode is **never** enabled on a deployment that stores real SSH credentials.

## FAQ

### Do I have to re-enter the master password after restarting the container?

**No** (as long as the secret on the host is still there). v1 strictly never persists any secret fragment to disk — restart = re-derive the master key. `master_password.secret` lives on the host, and docker re-injects it as a secret when the container restarts; you only need to re-supply the password if you delete that file or move to a new host without it.

### The browser shows "Termlnk Web is not ready"

The server's `holderStatus !== 'unlocked'`. Likely causes:

- `master_password.secret` doesn't exist / is empty.
- The shell that started compose didn't mount the secret file in (check that the `secrets:` section wasn't overridden).
- You changed the master password but the vault already exists (Argon2id derives a different key).

Run `curl http://127.0.0.1:3000/__termlnk-web/status` and read the `holderError` field for the detailed error.

### Multi-user support?

**v1 is single-tenant**: one termlnk-web instance = one user's vault. Multi-user support is deferred to P7.11 (see the architecture docs). If a team needs a vault per person, the current workaround is to deploy a separate container per member (different ports or subdomains).

### Relationship to termlnk-server

**Fully independent.** `termlnk-server` is the public zero-knowledge cloud-sync backend (separate repository); termlnk-web is the single-user "desktop, remoted". If you run both, termlnk-web acts as another sync client alongside desktop / mobile, sharing the same E2EE vault (via `TERMLNK_CLOUD_BASE_URL`).

### How big is the image?

~1.1 GB (arm64, glibc). It bundles the Node 24 runtime + compiled better-sqlite3 + node-pty + ssh2 + the prod dependency closure (tRPC, drizzle, ...) + the server-side ESM bundle + the browser SPA + Drizzle migrations + bundled skills.

## Known limitations (v1)

- **SFTP single-file size**: browser SFTP upload / download is capped at 4 MiB per file (`MAX_BYTES_PER_FILE`, see `BrowserFileTransferService`). The current `sftp.writeFile / sftp.readFile` base64-encode the whole file into a single tRPC mutation/query body, peaking at ~1.5× the file size in memory; a self-managed nginx with the default `client_max_body_size 1m` will also choke (the tRPC standalone adapter and the built-in Caddy v2 default impose no body limit). The cap is lifted once a stream-aware sftp procedure lands.
- **No OpenTelemetry / Prometheus metrics**: logs go to stdout. `docker logs` is enough to inspect the access pattern.
- **The container's "local terminal" = the container shell**: when you open a local PTY in the web UI, it enters the container shell, not the host shell — this is the v1 security semantics. Use the desktop app if you need a "host local terminal".
- **No IPv6-only host support**: it works, but docker-compose's default `127.0.0.1` is IPv4; for an IPv6-only host, change it to `[::1]:3000:3000`.
- **arm64's first build compiles node-pty from source** (no Linux prebuild), ~30% slower than amd64.
