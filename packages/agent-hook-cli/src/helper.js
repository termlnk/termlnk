#!/usr/bin/env node
/**
 * Termlnk agent hook helper (auto-installed; do not edit manually).
 *
 * Invoked by `launcher.sh` / `launcher.cmd` whenever an external AI agent's
 * hook fires. Forwards the event to the running Termlnk HTTP hook server
 * over 127.0.0.1 loopback, using either env vars (when the agent inherited
 * them from a Termlnk PTY) or the `runtime.json` discovery file sitting
 * next to this helper's install directory (when the agent is running in
 * any other terminal).
 *
 * Contract:
 *   - stdin: the agent's hook payload (JSON string), up to 64 KiB
 *   - stdout: for blocking hooks (permission-request), the HTTP response body
 *             from the server (so the agent can parse the decision); for
 *             non-blocking hooks, always `{}` so the agent never blocks on
 *             malformed output
 *   - exit code: always 0 — the helper must never break an agent even if
 *                Termlnk is not running or unreachable
 */

'use strict';

const { Buffer } = require('node:buffer');
const { execSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const process = require('node:process');

const MAX_STDIN_BYTES = 64 * 1024;
const FIRE_FORGET_TIMEOUT_MS = 5_000;
const PERMISSION_TIMEOUT_MS = 120_000;

/**
 * Discovery file path. Self-located from the helper's own install location:
 * the launcher installs `helper.js` into `<configPath>/bin/hook-helper.js`
 * and the hook server writes discovery info to `<configPath>/runtime.json`.
 * `TERMLNK_RUNTIME_FILE` may override for tests / alternative deployments.
 */
const RUNTIME_FILE = process.env.TERMLNK_RUNTIME_FILE
  || path.resolve(__dirname, '..', 'runtime.json');

function emptyOkAndExit() {
  try {
    process.stdout.write('{}');
  } catch {
    // ignore
  }
  process.exit(0);
}

function parseArgs(argv) {
  const result = { agent: 'unknown', event: 'unknown' };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--agent' && value) {
      result.agent = value;
      i++;
    } else if (key === '--event' && value) {
      result.event = value;
      i++;
    }
  }
  return result;
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks = [];
    let totalSize = 0;
    let resolved = false;
    const done = (value) => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(value);
    };
    process.stdin.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_STDIN_BYTES) {
        process.stdin.destroy();
        done(Buffer.concat(chunks).slice(0, MAX_STDIN_BYTES).toString('utf8'));
        return;
      }
      chunks.push(chunk);
    });
    process.stdin.on('end', () => {
      done(Buffer.concat(chunks).toString('utf8'));
    });
    process.stdin.on('error', () => {
      done('');
    });
  });
}

function readRuntimeFile() {
  try {
    const raw = fs.readFileSync(RUNTIME_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (data && typeof data.port === 'number' && typeof data.token === 'string') {
      return { port: data.port, token: data.token };
    }
  } catch {
    // Silently ignore — file missing or malformed
  }
  return null;
}

function resolveEndpoint() {
  const envPort = process.env.TERMLNK_HOOK_PORT;
  const envToken = process.env.TERMLNK_HOOK_TOKEN;
  if (envPort && envToken) {
    const port = Number(envPort);
    if (Number.isFinite(port) && port > 0) {
      return { port, token: envToken, source: 'env' };
    }
  }
  const fromFile = readRuntimeFile();
  if (fromFile) {
    return { ...fromFile, source: 'runtime' };
  }
  return null;
}

function detectTty() {
  // Hook stdin is piped (agent payload), so `tty` on fd 0 returns "not a tty".
  // Use `/dev/tty` redirect to read the controlling tty — the terminal the
  // agent process is attached to, which is inherited down the process chain.
  if (process.platform === 'win32') {
    return '';
  }
  try {
    const out = execSync('tty < /dev/tty', {
      shell: '/bin/sh',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 500,
    })
      .toString('utf8')
      .trim();
    if (out && !out.includes('not a tty')) {
      return out;
    }
  } catch {
    // ignore
  }
  if (process.env.SSH_TTY) {
    return process.env.SSH_TTY;
  }
  if (process.env.TTY) {
    return process.env.TTY;
  }
  try {
    const out = execSync(`ps -o tty= -p ${process.pid}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 500,
    })
      .toString('utf8')
      .trim();
    if (out && out !== '?' && out !== '??') {
      return out.startsWith('/dev/') ? out : `/dev/${out}`;
    }
  } catch {
    // ignore
  }
  return '';
}

function collectMeta() {
  return {
    ppid: process.ppid,
    tty: detectTty(),
    cwd: safeCwd(),
    termProgram: process.env.TERM_PROGRAM || '',
  };
}

function safeCwd() {
  try {
    return process.cwd();
  } catch {
    return '';
  }
}

function resolveSessionId(meta) {
  const envId = process.env.TERMLNK_SESSION_ID;
  if (envId) {
    return envId;
  }
  // Fingerprint intentionally excludes `cwd` — it's runtime-mutable state
  // (the agent may execute `cd` or Bash tools that switch directories), not
  // part of the process's identity. Including it would produce a different
  // `external-<hash>` every time the agent changes directories, which
  // accumulates ghost sessions in the Dynamic Island.
  const fingerprint = `${meta.ppid}|${meta.tty}`;
  const hash = crypto.createHash('sha1').update(fingerprint).digest('hex').slice(0, 12);
  return `external-${hash}`;
}

function safeParseJson(raw) {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw.slice(0, 2048) };
  }
}

function extractAgentSessionId(payload) {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const candidate = payload.session_id || payload.sessionId || payload.thread_id || payload.threadId;
  return typeof candidate === 'string' ? candidate : undefined;
}

function postHook({ endpoint, route, body, timeoutMs }) {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: endpoint.port,
        path: route,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${endpoint.token}`,
          'Content-Length': Buffer.byteLength(bodyStr),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({ ok: true, body: Buffer.concat(chunks).toString('utf8') });
        });
        res.on('error', () => resolve({ ok: false, body: '' }));
      }
    );
    req.on('error', () => resolve({ ok: false, body: '' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, body: '' });
    });
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const { agent, event } = parseArgs(process.argv.slice(2));
  const stdinRaw = await readStdin();
  const payload = safeParseJson(stdinRaw);

  const endpoint = resolveEndpoint();
  if (!endpoint) {
    emptyOkAndExit();
    return;
  }

  const meta = collectMeta();
  const sessionId = resolveSessionId(meta);
  const agentSessionId = extractAgentSessionId(payload);

  const body = {
    event,
    sessionId,
    agent,
    timestamp: new Date().toISOString(),
    payload,
    meta,
  };
  if (agentSessionId) {
    body.agentSessionId = agentSessionId;
  }

  // Two blocking routes exist — permission approval and AskUserQuestion
  // picker. Everything else is fire-and-forget monitoring.
  const BLOCKING_ROUTES = {
    'permission-request': '/hook/permission',
    'ask-user-question': '/hook/ask-user-question',
  };
  const route = BLOCKING_ROUTES[event] || '/hook';
  const isBlocking = route !== '/hook';
  const timeoutMs = isBlocking ? PERMISSION_TIMEOUT_MS : FIRE_FORGET_TIMEOUT_MS;

  const result = await postHook({ endpoint, route, body, timeoutMs });

  if (isBlocking && result.ok && result.body) {
    try {
      process.stdout.write(result.body);
    } catch {
      // ignore
    }
    process.exit(0);
    return;
  }
  emptyOkAndExit();
}

main().catch(() => {
  emptyOkAndExit();
});
