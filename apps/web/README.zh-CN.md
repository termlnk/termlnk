# Termlnk Web

[English][readme-en-link] | **简体中文** 

把任何浏览器变成完整的 Termlnk 工作站——SSH 终端、主机管理、AI Agent、SFTP、Skills，无需安装任何东西，打开浏览器即可使用。

**什么场景下需要部署 termlnk-web：**

- 你想从任何设备（平板、别人的电脑、手机）管理服务器，而不需要安装桌面客户端
- 你需要在远程机器上运行一个持久的、随时可用的终端环境
- 你想在网站上嵌入一个 Termlnk 的在线演示

> **请仅在你信任的机器上运行 termlnk-web。** 它拥有和桌面客户端相同的能力——直接 SSH/SFTP 访问、AI 推理、本地文件系统访问。请像保护 SSH 密钥一样保护它。

## 系统要求

| 项目 | 最低要求 |
|------|---------|
| 操作系统 | Linux x86_64 / arm64 |
| Docker | 24+（含 compose 插件） |
| 内存 | 1 GiB |
| 端口 | 3000（HTTP），或 80/443（启用 HTTPS 时） |

## 快速开始

预构建的镜像已发布到 GHCR（支持 amd64 / arm64），无需克隆仓库。

```bash
# 仅 HTTP（localhost:3000）
curl -fSL https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy/install.sh | bash

# 自动 HTTPS（Caddy + Let's Encrypt）
curl -fSL https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy/install.sh \
  | bash -s -- --tls termlnk.example.com

# Demo 模式（免登录，用于网站嵌入展示）
curl -fSL https://raw.githubusercontent.com/termlnk/termlnk/main/apps/web/deploy/install.sh \
  | bash -s -- --demo --tls demo.termlnk.com
```

从仓库本地安装：`cd apps/web/deploy && ./install.sh [--tls domain] [--demo]`。

安装脚本会自动生成一个随机主密码并保存到 `master_password.secret`。**请立即备份此密码**——丢失后你的数据将永久不可恢复。

## 管理实例（deploy.sh）

```bash
./deploy.sh start              # 启动（幂等）
./deploy.sh stop               # 停止
./deploy.sh restart            # 重建容器
./deploy.sh update             # 拉取最新镜像并重启
./deploy.sh logs [service]     # 查看日志
./deploy.sh status             # 查看容器状态
./deploy.sh backup             # 将数据库快照到 ./backups/
./deploy.sh restore <file>     # 从备份恢复（破坏性操作）
./deploy.sh shell              # 进入容器 shell
./deploy.sh uninstall [--purge]  # 卸载（--purge 同时删除所有数据）
```

## HTTPS 配置

### 方案 A：内置 Caddy（最简单）

```bash
./install.sh --tls termlnk.example.com
```

将域名 DNS 指向你的服务器，确保 80/443 端口可达。Caddy 会自动签发证书。

### 方案 B：使用自己的反向代理

将代理指向 `127.0.0.1:3000`：

- 转发 WebSocket 升级（`Upgrade` / `Connection: upgrade`）
- 设置 `X-Forwarded-Proto: $scheme`，确保 Session Cookie 带上 `Secure` 标志
- 将读写超时设为 `86400s`——终端会话可能长时间空闲

<details>
<summary>nginx 配置示例</summary>

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

## Demo 模式

Demo 模式跳过登录界面，任何人都可以直接访问工作台。适用于在网站上嵌入在线演示。

通过 `--demo` 参数或设置 `TERMLNK_WEB_DEMO=true` 启用。

> **存有真实 SSH 凭证时，绝不要启用 Demo 模式。** 它会让应用在无需认证的情况下公开访问。

## 从源码构建

适用于离线环境或自定义镜像：

```bash
cd apps/web/deploy

# 生成主密码（如果 master_password.secret 已存在则跳过）
openssl rand -base64 32 > master_password.secret
chmod 600 master_password.secret

docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

首次构建约需 5-10 分钟。

## 配置项

| 变量 | 默认值 | 说明 |
|------|-------|------|
| `TERMLNK_MASTER_PASSWORD_FILE` | — | 主密码文件路径（Docker / k8s secrets，推荐使用） |
| `TERMLNK_MASTER_PASSWORD` | — | 主密码明文（本地开发用，切勿提交到 git） |
| `TERMLNK_WEB_DEMO` | — | 设为 `true` 启用 Demo 模式 |
| `TERMLNK_WEB_PORT` | `3000` | 监听端口 |
| `TERMLNK_WEB_HOST` | `0.0.0.0` | 监听地址 |
| `TERMLNK_WEB_TAG` | `latest` | 镜像标签（生产环境建议锁定具体版本） |
| `TERMLNK_WEB_DOMAIN` | — | 内置 Caddy HTTPS 的域名 |
| `TERMLNK_CLOUD_BASE_URL` | — | 连接 Termlnk Cloud 进行 Vault 同步 |

## 备份与数据

你的数据存储在容器内的 `/data` 卷中：

- `termlnk-web.db` — 所有主机、凭证、AI Provider 和设置（敏感字段已加密）
- `skills/` — 用户安装的 Skills

定期执行 `./deploy.sh backup`。妥善保管备份文件和 `master_password.secret`——恢复时两者缺一不可。

## 常见问题

**重启后需要重新输入密码吗？** 不需要。密码文件保存在宿主机上，Docker 重启时自动重新注入。

**显示 "Termlnk Web is not ready"？** 执行 `curl http://127.0.0.1:3000/__termlnk-web/status` 查看 `holderError` 字段。通常是 `master_password.secret` 缺失或为空。

**多人能共用一个实例吗？** 暂时不行——v1 是单用户的。团队使用可以为每个人部署独立的容器。

**和 Termlnk Cloud 有什么区别？** termlnk-web 是自托管的，所有数据都在你自己的服务器上运行。Termlnk Cloud 是独立的同步服务——如果两者同时使用，你的桌面端、移动端和 Web 端的数据会保持同步。

## 安全清单

- 备份 `master_password.secret` 并妥善保管
- 远程访问务必使用 HTTPS（内置 Caddy 或自行配置代理）
- 生产环境锁定 `TERMLNK_WEB_TAG` 到具体版本
- 存有真实凭证时绝不启用 Demo 模式
- 不要将 `/data` 卷放入公开备份

## 已知限制（v1）

- **SFTP 文件大小**：浏览器上传/下载限制为单文件 4 MiB
- **本地终端**：打开的是容器 shell 而非宿主机——如需宿主机终端请使用桌面客户端
- **纯 IPv6 主机**：需将 compose 绑定改为 `[::1]:3000:3000`

<!-- Language switcher -->
[readme-en-link]: ./README.md
[readme-zh-cn-link]: ./README.zh-CN.md
