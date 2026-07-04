# Termlnk Web

**English** | [简体中文][readme-zh-cn-link]

Turn any browser into a full Termlnk workstation — SSH terminals, host management, AI agent, SFTP, and skills, all accessible from your browser without installing anything.

**When to use termlnk-web:**

- You want to manage servers from any device (tablet, someone else's laptop, your phone) without installing the desktop app
- You need a persistent, always-on terminal environment on a remote machine
- You want to embed a live Termlnk demo on a website

> **Run termlnk-web only on a machine you trust.** It has the same capabilities as the desktop app — direct SSH/SFTP access, AI inference, local filesystem access. Protect it like you would protect your SSH keys.

## Requirements

| Item | Minimum |
|------|---------|
| OS | Linux x86_64 / arm64 |
| Docker | 24+ (with compose plugin) |
| Memory | 1 GiB |
| Ports | 3000 (HTTP), or 80/443 (with HTTPS) |

## Quick start

Prebuilt images are published to GHCR (amd64 / arm64) — no need to clone the repo.

```bash
# HTTP only (localhost:3000)
curl -fSL https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy/install.sh | bash

# Automatic HTTPS (Caddy + Let's Encrypt)
curl -fSL https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy/install.sh \
  | bash -s -- --tls termlnk.example.com

# Demo mode (no login, for website embed)
curl -fSL https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy/install.sh \
  | bash -s -- --demo --tls demo.termlnk.com
```

From the repo: `cd apps/web/deploy && ./install.sh [--tls domain] [--demo]`.

The installer generates a random master password and saves it to `master_password.secret`. **Back up this password immediately** — losing it makes your data permanently unrecoverable.

## Managing your instance (deploy.sh)

```bash
./deploy.sh start              # start (idempotent)
./deploy.sh stop               # stop
./deploy.sh restart            # recreate containers
./deploy.sh update             # pull latest image + restart
./deploy.sh logs [service]     # tail logs
./deploy.sh status             # show container status
./deploy.sh backup             # snapshot the database to ./backups/
./deploy.sh restore <file>     # restore from backup (DESTRUCTIVE)
./deploy.sh shell              # open a shell in the container
./deploy.sh uninstall [--purge]  # tear down (--purge also deletes all data)
```

## HTTPS setup

### Option A: Built-in Caddy (easiest)

```bash
./install.sh --tls termlnk.example.com
```

Point your domain's DNS to this server and make sure ports 80/443 are open. Caddy handles certificate provisioning automatically.

### Option B: Your own reverse proxy

Point your proxy at `127.0.0.1:3000`:

- Forward WebSocket upgrades (`Upgrade` / `Connection: upgrade`)
- Set `X-Forwarded-Proto: $scheme` so the session cookie gets the `Secure` flag
- Set read/send timeout to `86400s` — terminal sessions can be idle for hours

<details>
<summary>nginx example</summary>

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

</details>

## Demo mode

Demo mode skips the login screen — anyone can access the workbench directly. Designed for embedding a live demo on your website.

Enable with `--demo` flag or set `TERMLNK_WEB_DEMO=true`.

> **Never enable demo mode when real SSH credentials are stored.** It makes the app publicly accessible without authentication.

## Build from source

For air-gapped environments or custom images:

```bash
cd apps/web/deploy

# Generate a master password (skip if master_password.secret already exists)
openssl rand -base64 32 > master_password.secret
chmod 600 master_password.secret

docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

First build takes ~5-10 min.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TERMLNK_MASTER_PASSWORD_FILE` | — | Path to master-password file (Docker / k8s secrets; recommended) |
| `TERMLNK_MASTER_PASSWORD` | — | Master password inline (for local dev; never commit to git) |
| `TERMLNK_WEB_DEMO` | — | `true` to enable demo mode |
| `TERMLNK_WEB_PORT` | `3000` | Listen port |
| `TERMLNK_WEB_HOST` | `0.0.0.0` | Listen address |
| `TERMLNK_WEB_TAG` | `latest` | Image tag (pin to a specific version in production) |
| `TERMLNK_WEB_DOMAIN` | — | Domain for built-in Caddy HTTPS |
| `TERMLNK_CLOUD_BASE_URL` | — | Connect to Termlnk Cloud for vault sync |

## Backup & data

Your data lives in the `/data` volume inside the container:

- `termlnk-web.db` — all your hosts, credentials, AI providers, and settings (sensitive fields are encrypted)
- `skills/` — user-installed skills

Run `./deploy.sh backup` regularly. Keep both the backup file and `master_password.secret` safe — you need both to restore.

## FAQ

**Do I need to re-enter the password after restart?** No. The password file stays on the host and Docker re-injects it automatically.

**"Termlnk Web is not ready"?** Run `curl http://127.0.0.1:3000/__termlnk-web/status` and check the `holderError` field. Usually means `master_password.secret` is missing or empty.

**Can multiple people share one instance?** Not yet — v1 is single-user. For teams, deploy a separate container per person.

**What's the difference from Termlnk Cloud?** termlnk-web is self-hosted and runs everything locally on your server. Termlnk Cloud is a separate sync service — if you use both, your desktop, mobile, and web instances stay in sync.

## Security checklist

- Back up `master_password.secret` and keep it somewhere safe
- Always use HTTPS for remote access (built-in Caddy or your own proxy)
- Pin `TERMLNK_WEB_TAG` to a specific version in production
- Never enable demo mode with real credentials
- Don't expose the `/data` volume in public backups

## Known limitations (v1)

- **SFTP file size**: browser upload/download limited to 4 MiB per file
- **Local terminal**: opens the container shell, not the host — use the desktop app for host-local terminals
- **IPv6-only hosts**: change the compose bind to `[::1]:3000:3000`

<!-- Language switcher -->
[readme-en-link]: ./README.md
[readme-zh-cn-link]: ./README.zh-CN.md
