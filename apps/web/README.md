# termlnk-web — self-hosted server twin of the desktop app

The web edition of [Termlnk](https://github.com/termlnk/termlnk). Same DI container, same business plugins, same vault — the desktop's Electron IPC is replaced with HTTP + WebSocket served by `@termlnk/web-server`, so you can reach your terminals, hosts, AI agent, SFTP, and skills from any modern browser.

> ⚠ **termlnk-web 必须部署在你自己信任的机器上。** 它持有 master key,与桌面端 Electron 主进程拥有相同的执行权限(直连 SSH/SFTP、跑 AI 推理、读取本机文件系统)。这不是 zero-knowledge 公共后端 — 那是另一个独立仓库 `termlnk-server`。

## 前置要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Linux x86_64 / arm64 (任何能跑 Docker 的发行版) |
| Docker | 24+(compose plugin 内置) |
| 网络 | 反代或直连场景下能监听 443 / 3000 |
| TLS | 强烈推荐:Let's Encrypt 自动签发(内置 caddy profile)或自己的反代 |
| 内存 | ≥ 1 GiB(含 SQLite + node-pty + ssh2 + AI inference 缓冲) |

## 30 秒速跑

镜像已预构建并发布到 GHCR(多架构 amd64 / arm64),无需克隆整个 monorepo 或本地编译。
最小化部署只需要 `apps/web/` 这个目录(`docker-compose.yml` / `install.sh` /
`Caddyfile`)。

```bash
cd apps/web

# 一键部署:生成强 master password → 拉镜像 → 启动 → 健康检查
./install.sh

# 需要自动 HTTPS(内置 caddy + Let's Encrypt):
./install.sh --tls termlnk.example.com
```

`install.sh` 把随机生成的 master password 写入 `master_password.secret`(权限 600,
已 gitignore),并以 **docker secret** 注入容器 — 它不会出现在容器环境变量或
`docker inspect` 输出里。**请立即备份该密码**:丢失它意味着 vault 永久不可恢复
(与 Bitwarden 等密码管理器同语义)。

手动等价操作:

```bash
cd apps/web
printf '%s' 'choose-a-strong-passphrase' > master_password.secret
chmod 600 master_password.secret
docker compose up -d
curl http://127.0.0.1:3000/__termlnk-web/status
# {"holderStatus":"unlocked","holderError":null,"authenticated":false}
```

浏览器访问 `http://127.0.0.1:3000`,输入 master password 登录,即可使用与桌面端
等价的全部功能。

### 从源码本地构建(air-gapped / 定制镜像)

```bash
cd apps/web
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

会从仓库根上下文(`context: ../..`)调用 `apps/web/Dockerfile` 三阶段构建。首次约
5–10 分钟(node-pty 必须源码编译,因为它不发布 Linux prebuild)。

## 反代生产配置

强烈推荐在 termlnk-web 前终止 TLS,让它仅监听 127.0.0.1:3000(容器默认行为)。

### 内置 caddy(最简单,自动 HTTPS)

compose 自带一个 `tls` profile 的 caddy 服务,自动向 Let's Encrypt 申请证书:

```bash
TERMLNK_WEB_DOMAIN=termlnk.example.com docker compose --profile tls up -d
# 或:./install.sh --tls termlnk.example.com
```

前提:域名 A/AAAA 记录指向本机,80/443 公网可达。证书与配置持久化在
`caddy_data` / `caddy_config` volume。caddy 透明代理 `/trpc-ws` 的 WebSocket 升级,
并自动带上 `X-Forwarded-Proto: https`(让服务端在 cookie 上加 `Secure` flag)。

### 自管 nginx / 自管 caddy

如果你已有自己的反代,让它指向 `127.0.0.1:3000` 即可。关键要求:

- 透传 WebSocket 升级(`Upgrade` / `Connection: upgrade`)
- 设 `X-Forwarded-Proto: $scheme`(让服务端在 cookie 上加 `Secure`)
- 把 `proxy_read_timeout` / `proxy_send_timeout` 拉到 86400s(终端会话常常空闲数小时)

nginx 示例:

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

## 环境变量参考

所有 `TERMLNK_*` 变量都可通过 `docker-compose.yml` 的 `environment:` 段或自己的
EnvironmentFile 注入。

| 变量 | 默认 | 说明 |
|------|------|------|
| `TERMLNK_MASTER_PASSWORD_FILE` | _空_ | Master password 文件路径(**生产首选**;docker / k8s secrets,值不入容器环境;尾部单个换行会被剥除)。优先级高于下一行 |
| `TERMLNK_MASTER_PASSWORD` | _空_ | Master password 字面量(与 `_FILE` 二选一;本地 dev 方便用,禁止写到任何会入 git 的文件) |
| `TERMLNK_WEB_PORT` | `3000` | HTTP / WS 监听端口 |
| `TERMLNK_WEB_HOST` | `0.0.0.0` 镜像内 / `127.0.0.1` 主机内 | 监听地址 |
| `TERMLNK_WEB_TLS_CERT` | _空_ | 直连 TLS 证书(与反代二选一) |
| `TERMLNK_WEB_TLS_KEY` | _空_ | 直连 TLS 私钥 |
| `TERMLNK_WEB_CONFIG_DIR` | `/data` | 配置 / 缓存根目录(SQLite vault、用户 skills) |
| `TERMLNK_WEB_DB_PATH` | `/data/termlnk-web.db` | SQLite vault 文件 |
| `TERMLNK_WEB_USER_SKILLS_DIR` | `/data/skills` | 用户 skill 目录 |
| `TERMLNK_WEB_STATIC_ROOT` | `/app/renderer-dist` | SPA dist 路径(镜像内已正确指向) |
| `TERMLNK_WEB_MIGRATIONS_DIR` | `/app/resources/migrations` | Drizzle migrations(镜像内已设) |
| `TERMLNK_WEB_BUNDLED_SKILLS_DIR` | `/app/resources/bundled-skills` | 内置 skills(镜像内已设) |
| `TERMLNK_WEB_HOOK_CLI_DIR` | `/app/resources/agent-hook-cli` | AI hook helper 源(镜像内已设) |
| `TERMLNK_CLOUD_BASE_URL` | _空_ | 可选:连接 `termlnk-server` 公共云做 vault 同步 |
| `TERMLNK_WEB_TAG` | `latest` | compose 拉取的镜像 tag(可固定到具体版本) |
| `TERMLNK_WEB_DOMAIN` | _空_ | `tls` profile 的公网域名;仅启用 caddy 时必填 |

## 数据持久化

镜像把 `/data` 声明为 named volume:

- `termlnk-web.db` — SQLite vault(主机凭据、AI provider 配置、扩展配置...
  字段级密文,由 master key 派生加密)
- `skills/` — 用户 skills(不含 bundled-skills)

**备份策略**:定期把整个 `/data` 目录打包并加密保存。**请同时保存 master password
和 `master_password.secret` 文件**——丢失任一即 vault 不可恢复。

## 如何升级

```bash
cd apps/web
docker compose pull            # 拉新版镜像;或指定 TERMLNK_WEB_TAG=vX.Y.Z 锁版本
docker compose up -d
```

`/data` volume 跨升级保留;新镜像启动时 Drizzle migration 自动应用待执行的 schema
变更。源码构建用户改用 `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`。

## 安全检查清单

- ✅ `master_password.secret` 文件权限 `600`,所有者为部署者,且已加入 `.gitignore`(默认就是)
- ✅ 容器仅绑 `127.0.0.1`(默认),反代上游强制 HTTPS
- ✅ 反代正确传 `X-Forwarded-Proto: https`,确保 session cookie 上 `Secure` flag
- ✅ `/data` volume 不放公共备份(含 SQLite vault 文件)
- ✅ 不在共享主机上跑 — termlnk-web 持 vault key,与登 root 等价
- ✅ 使用预构建镜像时,把 `TERMLNK_WEB_TAG` 钉到一个具体版本(如 `v0.1.0`),
     避免静默拉到带 breaking change 的新版本

## 常见问题

### 重启容器后必须重新提供 master password 吗?

**否**(只要宿主上的 secret 还在)。v1 严格不持久化任何 secret 片段到 disk,
重启 = 重新派生 master key。`master_password.secret` 存在于宿主,重启容器时
docker 会重新以 secret 注入;只有删除该文件、或切换到没有它的新宿主时才需要
重新提供密码。

### 浏览器看到 "Termlnk Web is not ready"

服务端 `holderStatus !== 'unlocked'`。可能原因:

- `master_password.secret` 文件不存在 / 内容为空
- 启动 compose 的 shell 没把 secret file 挂进去(确认 `secrets:` 段没被覆盖)
- 改了 master password,但 vault 已存在(Argon2id 派生出的不是同一把 key)

`curl http://127.0.0.1:3000/__termlnk-web/status` 看 `holderError` 字段拿详细错误。

### 多用户支持?

**v1 是单租户**:一个 termlnk-web 实例 = 一个用户的 vault。多用户支持留 P7.11
(详见架构文档)。如果团队需要每人一份 vault,目前的解法是为每个成员部署独立容器
(不同端口或不同子域)。

### 与 termlnk-server 关系

**完全独立**。`termlnk-server` 是公共 zero-knowledge 云同步后端(独立仓库);
termlnk-web 是单用户的"desktop 远程化"。两者都跑了:termlnk-web 充当 desktop
之外的一个 sync 客户端,与桌面端 / 移动端共享同一份 E2EE vault(通过
`TERMLNK_CLOUD_BASE_URL` 接入)。

### 镜像有多大?

约 1.1 GB(arm64,glibc)。包含 Node 24 runtime + 编译好的 better-sqlite3 +
node-pty + ssh2 + tRPC 与 drizzle 等 prod 依赖闭包 + 服务端 ESM bundle +
浏览器 SPA + Drizzle migrations + bundled skills。

## 已知限制(v1)

- **SFTP 单文件大小**:浏览器 SFTP 上传 / 下载受限于 4 MiB / 文件(`MAX_BYTES_PER_FILE`,
  详见 `BrowserFileTransferService`)。原因是当前 `sftp.writeFile / sftp.readFile`
  把整个文件 base64 编码塞进一个 tRPC mutation/query 体,内存峰值约 1.5× 文件大小;
  自管 nginx 默认 `client_max_body_size 1m` 也会卡(tRPC standalone adapter 与
  内置 Caddy v2 默认都不限制 body)。Stream-aware sftp procedure 落地后会取消该限制。
- **没有 OpenTelemetry / Prometheus 指标**:日志走 stdout。`docker logs` 即可看
  access pattern。
- **容器内"本地终端"= 容器 shell**:当你在 web 端开本地 PTY,它进入容器 shell
  而不是宿主 shell — 这是 v1 的安全语义。需要"宿主本地终端"请改用桌面端。
- **不支持 IPv6 only host**:可用,但 docker-compose 默认 `127.0.0.1` 是 IPv4;
  若仅 IPv6 请改 `[::1]:3000:3000`。
- **arm64 首次构建需源码编译 node-pty**(无 Linux prebuild),约比 amd64 慢 30%。
