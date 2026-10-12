# MCP Server Deployment Guide

**Target hardware:** Any hardware with ARMv7 architecture
**Stack:** Alpine Linux · Node.js 24 · Docker · Cloudflare Tunnel

---

## 1. Context and rationale

### Why this architecture

Running MCP servers via `npx ... &` in the background is unreliable on constrained hardware:

- `npx` re-resolves and re-installs the package on every launch, adding 10–70 s of cold-start latency that frequently exceeds the MCP client's connection timeout.
- Background processes die on SSH disconnect unless detached with `setsid`/`tmux`.
- Version drift means the same command can behave differently on different days.
- No resource isolation — a runaway Node process can exhaust the 1 GB RAM and trigger the OOM killer.

Docker solves all four. Alpine is the only distribution that still ships Node.js 24 for `armv7` (upstream Node dropped ARMv7 builds after v22), so it is the base of choice.

### Design principles

| Principle | Implementation |
|---|---|
| Base image is generic | Dockerfile contains **only** Node.js + npm. No MCP servers. |
| MCP servers are data, not code | Each server installs into its own host bind mount. |
| Reproducible at the base, flexible at the leaf | Rebuild base rarely; add/swap servers without touching it. |
| Runtime UID matches host UID | No hardcoded UID in the image; `--user` supplied per invocation. |
| Writable `$HOME` for any UID | `/home/node` at mode 1777, exported via `ENV HOME`. |

---

## 2. Prerequisites

- Docker installed and functional. Verify the kernel handles containers:

```
docker run --rm alpine:3.23 ping -c 2 8.8.8.8
```

If this fails with a gateway/netlink error, the kernel is too old.
- `cloudflared` available (either as a Docker image or a native binary) for exposing MCP endpoints.
- Decide on a root directory. This guide uses `/opt/mcp`. Replace as needed.

---

## 3. Directory layout

```
/opt/mcp/
├── Dockerfile.base          ← the generic base image
├── docker-compose.yml       ← optional, only for building the base
├── ms365/                   ← bind mount for the MS365 MCP server
│   ├── node_modules/
│   ├── package.json
│   └── token-cache.json     ← runtime state (persists across restarts)
└── filesystem/              ← bind mount for the next MCP server
    └── node_modules/
```

**One directory per MCP server.** Their dependency trees never collide, and each can be backed up, updated, or deleted independently.

---

## 4. Base image

### `Dockerfile.base`

```
# Base image: Alpine 3.23 + Node.js 24 + npm, nothing else.
#
# Alpine 3.23 ships Node.js 24 for armv7 in its main repository, even
# though upstream Node.js no longer builds for ARMv7.
# See: https://pkgs.alpinelinux.org/package/v3.23/main/armv7/nodejs
#
# No MCP server is baked in. No UID is hardcoded. The runtime user is
# supplied with --user at start time, and the world-writable HOME
# below ensures npm and other tools work under any UID.

FROM alpine:3.23.3

RUN apk add --no-cache nodejs npm

# Writable HOME for whatever UID the container runs as.
# Mode 1777 (sticky bit) lets any UID create files without letting
# one UID delete another's. Same convention as /tmp.
RUN mkdir -p /home/node && chmod 1777 /home/node

ENV HOME=/home/node

# Bind mount point for MCP packages installed later.
RUN mkdir -p /data
WORKDIR /data

# No USER directive — the UID comes from --user at runtime.
```

### Why each piece exists

| Line | Reason |
|---|---|
| `FROM alpine:3.23.3` | Only maintained distro with Node 24 for `armv7`. |
| `apk add nodejs npm` | The runtime and the package manager. Nothing else. |
| `chmod 1777 /home/node` | Fixes the `EACCES /.npm` error when `--user` is used. |
| `ENV HOME=/home/node` | Baked into the image so no `-e HOME=...` flag is needed per run. |
| No `USER` directive | UID is chosen at runtime, so it can always match the bind mount owner. |
| No MCP server | Servers are installed into bind mounts, not into the image. |

### Build

```bash
cd /opt/mcp
docker build -f Dockerfile.base -t mcp-base:node24-armv7 .
```

Rebuild only when you want a newer Node.js or npm. Adding MCP servers never requires a rebuild.

---

## 5. Installing an MCP server

The pattern is identical for every server. This example uses `@softeria/ms-365-mcp-server`.

### Step 5.1 — Create the bind mount directory (as your user)

```bash
mkdir -p /opt/mcp/ms365
```

**Do this before `docker run`.** If Docker creates the directory itself (because it doesn't exist), the daemon creates it as `root:root`, and your UID cannot write into it. That is the source of the `EACCES /data/node_modules` error.

If the directory already exists and is root-owned:

```bash
sudo chown -R "$(id -u):$(id -g)" /opt/mcp/ms365
```

### Step 5.2 — Install the server into the bind mount

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v /opt/mcp/ms365:/data \
  mcp-base:node24-armv7 \
  sh -c "npm install --omit=optional --prefix /data @softeria/ms-365-mcp-server"
```

| Flag | Why |
|---|---|
| `--rm` | The install container is disposable — one-shot. |
| `--user "$(id -u):$(id -g)"` | Files on the host are owned by you, not root. |
| `-v /opt/mcp/ms365:/data` | The bind mount. Packages land on the host filesystem. |
| `npm install --omit=optional` | Skips optional native deps (keytar for MS365) that lack ARMv7 prebuilts. |
| `--prefix /data` | Installs locally into `/data`, not globally. Predictable path. |

### Step 5.3 — Verify

```bash
ls -la /opt/mcp/ms365/node_modules/.bin/
```

The server binary should be listed there and owned by your user.

---

## 6. Running an MCP server

### Generic pattern

```bash
docker run -d \
  --name mcp-<server-name> \
  --restart unless-stopped \
  --network host \
  --user "$(id -u):$(id -g)" \
  -v /opt/mcp/<server-name>:/data \
  --memory 256m \
  --memory-swap 512m \
  mcp-base:node24-armv7 \
  node /data/node_modules/.bin/<server-binary> <args>
```

| Flag | Why |
|---|---|
| `-d` | Detached. |
| `--restart unless-stopped` | Survives reboots and crashes. |
| `--network host` | Simplest for a single-node setup; no port mapping to maintain. |
| `--user` | Runtime UID must match the install UID. |
| `--memory 256m` | Hard cap. Prevents a runaway process from exhausting the 1 GB board. |
| `--memory-swap 512m` | Allows 256 MB of swap beyond the resident cap. |

### MS365 specific (@softeria/ms-365-mcp-server)

As for `MS365_MCP_ALLOWED_REDIRECT_URIS` read more details [here](https://github.com/Softeria/ms-365-mcp-server/blob/main/docs/deployment.md)

```yaml
services:
  ms365:
    image: mcp-base:node24-armv7
    container_name: mcp-ms365
    restart: unless-stopped
    network_mode: host
    user: "1000:1000"
    volumes:
      - /opt/mcp/ms365:/data
    environment:
      - MS365_MCP_USE_KEYTAR=0
      - MS365_MCP_ORG_MODE=true # For Work/Organization tenant
      - MS365_MCP_OUTPUT_FORMAT=toon # Enable TOON output format
      - MS365_MCP_CLOUD_TYPE=global # Global or China
      # App Registration
      - MS365_MCP_TENANT_ID=
      - MS365_MCP_CLIENT_ID=     
      # Token Storage (see here: https://github.com/softeria/ms-365-mcp-server#token-storage)
      - MS365_MCP_TOKEN_CACHE_PATH=/data/token-cache.json
      - MS365_MCP_SELECTED_ACCOUNT_PATH=/data/selected-account.json
      # Others
      - MS365_MCP_PUBLIC_URL=<your-mcp-domain>
      - MS365_MCP_ALLOWED_REDIRECT_URIS=http://127.0.0.1:8420/callback,https://claude.ai/api/mcp/auth_callback
      # - MS365_MCP_BODY_FORMAT=html # Return email bodies as HTML instead of plain text
      # - MS365_MCP_RATE_LIMIT_DISABLED=1 # Default 120req on /mcp and 30req on /authorize, /token, and /register
    command: node /data/node_modules/.bin/ms-365-mcp-server --http 3000
    deploy:
      resources:
        limits:
          memory: 256m
```

---

## 7. Adding the next MCP server

The pattern repeats identically. Replace `<server>` and `<pkg>` as needed.

```
# 1. Create the bind mount directory
mkdir -p /opt/mcp/<server>

# 2. Install
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v /opt/mcp/<server>:/data \
  mcp-base:node24-armv7 \
  sh -c "npm install --omit=optional --prefix /data <pkg>"

# 3. Run
docker run -d \
  --name mcp-<server> \
  --restart unless-stopped \
  --network host \
  --user "$(id -u):$(id -g)" \
  -v /opt/mcp/<server>:/data \
  --memory 256m \
  --memory-swap 512m \
  mcp-base:node24-armv7 \
  node /data/node_modules/.bin/<binary> <args>
```

### Checking ARMv7 compatibility before installing

Most MCP servers are pure JavaScript and work anywhere Node works. A few have native dependencies that may lack ARMv7 prebuilts. Before installing, check the package's dependencies:

```
docker run --rm mcp-base:node24-armv7 \
  sh -c "npm view <pkg> dependencies"
```

Red flags: `keytar`, `better-sqlite3`, `sharp`, `tree-sitter`, `@node-llama-cpp`, `onnxruntime-node`. If any appear:

1. Check whether the dependency is **optional** (`npm view <pkg> optionalDependencies`). If so, `--omit=optional` handles it.
2. Check whether the server offers a WASM or pure-JS alternative.
3. If neither, the server likely cannot run on ARMv7.

---

## 9. Updating and removing servers

### Update a server

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v /opt/mcp/ms365:/data \
  mcp-base:node24-armv7 \
  sh -c "cd /data && npm update @softeria/ms-365-mcp-server"

docker restart mcp-ms365
```

### Pin to a specific version

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v /opt/mcp/ms365:/data \
  mcp-base:node24-armv7 \
  sh -c "cd /data && npm install @softeria/ms-365-mcp-server@1.2.3"
```

### Remove a server

```bash
docker rm -f mcp-ms365
rm -rf /opt/mcp/ms365
```

The base image and other servers are untouched.

### Update the base image (Node.js)

```bash
docker build -f Dockerfile.base -t mcp-base:node24-armv7 .
docker restart mcp-ms365 mcp-filesystem   # restart each running server
```

Existing server installs keep working; only the runtime is new.

---

### Diagnostic commands

```bash
# Is the container running?
docker ps --filter name=mcp-

# What does it say?
docker logs --tail 100 mcp-ms365

# What's inside the bind mount?
ls -la /opt/mcp/ms365/node_modules/.bin/

# Who owns the bind mount?
stat -c '%U:%G %a' /opt/mcp/ms365

# Is the port listening?
ss -tlnp | grep 3000

# What UID is the container actually running as?
docker exec mcp-ms365 id
```

---

## 11. Design decisions and why

### Bind mount vs. named volume

Bind mounts were chosen because:

- They're plain host directories — inspectable, editable, backupable with `cp`/`rsync`.
- Migration to another host is a simple `rsync`.
- The trade-off is that UID/GID must be managed manually (see §5.1), whereas named volumes are transparent.

### No `USER` directive in the Dockerfile

Hardcoding `USER 1000` (or `USER mcp`) forces every deployment to use that UID. Since the bind mount owner must match the container UID, and every host has a different UID for its primary user, hardcoding causes permission mismatches on the first machine that isn't UID 1000. Removing `USER` and using `--user "$(id -u):$(id -g)"` at runtime makes the image UID-agnostic.

### `ENV HOME=/home/node` in the image

Baking the `HOME` path into the image means no per-run `-e HOME=...` flag is needed. Every `docker run`, `docker exec`, and `docker compose` invocation gets it automatically.

### `/home/node` instead of `/tmp`

`/tmp` would work for the immediate npm install, but:

- It's mode 1777 by convention and cannot be tightened without breaking other tools.
- It may be overlaid as tmpfs at runtime, silently shifting npm's cache to RAM — a real risk on a 1 GB board.
- `/home/node` matches the convention used by the official `node` Docker image.

### `--omit=optional` for MS365

The MS365 server declares `keytar` as an optional dependency. Keytar binds to OS credential stores and publishes prebuilts only for `linux-x64` and `linux-arm64`. On ARMv7, `npm install` falls back to compiling from source, which frequently fails or exhausts memory. `--omit=optional` skips it entirely, and the runtime env var `MS365_MCP_USE_KEYTAR=0` tells the server not to look for it.

### `--memory 256m` per server

Without a cap, a bug in any MCP server can consume all 1 GB and trigger the OOM killer, which may take down unrelated processes. 256 MB is generous for a Node.js MCP server that isn't doing heavy compute.

---

## 12. Quick reference

```
# ── Base image ────────────────────────────────────────────────
docker build -f Dockerfile.base -t mcp-base:node24-armv7 .

# ── Install an MCP server ─────────────────────────────────────
mkdir -p /opt/mcp/<server>
docker run --rm --user "$(id -u):$(id -g)" \
  -v /opt/mcp/<server>:/data \
  mcp-base:node24-armv7 \
  sh -c "npm install --omit=optional --prefix /data <pkg>"

# ── Run it ────────────────────────────────────────────────────
docker run -d --name mcp-<server> \
  --restart unless-stopped --network host \
  --user "$(id -u):$(id -g)" \
  -v /opt/mcp/<server>:/data \
  --memory 256m --memory-swap 512m \
  mcp-base:node24-armv7 \
  node /data/node_modules/.bin/<binary> <args>

# ── Inspect ───────────────────────────────────────────────────
docker logs --tail 50 mcp-<server>
docker exec mcp-<server> id
docker restart mcp-<server>

# ── Update ────────────────────────────────────────────────────
docker run --rm --user "$(id -u):$(id -g)" \
  -v /opt/mcp/<server>:/data \
  mcp-base:node24-armv7 \
  sh -c "cd /data && npm update <pkg>"
docker restart mcp-<server>

# ── Remove ────────────────────────────────────────────────────
docker rm -f mcp-<server>
rm -rf /opt/mcp/<server>
```
