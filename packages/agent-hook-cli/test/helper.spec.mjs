import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const HELPER = new URL('../src/helper.js', import.meta.url).pathname;

function startMockServer() {
  return new Promise((resolve) => {
    const events = [];
    let nextPermissionResponse = '{}';
    const server = createServer((req, res) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        events.push({
          url: req.url,
          headers: {
            authorization: req.headers.authorization,
          },
          body: JSON.parse(body),
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (req.url === '/hook/permission') {
          res.end(nextPermissionResponse);
        } else {
          res.end('{}');
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        port: addr.port,
        events,
        setPermissionResponse: (body) => { nextPermissionResponse = body; },
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function runHelper({ args, stdinPayload, env, timeoutMs = 3000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [HELPER, ...args], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const outChunks = [];
    const errChunks = [];
    child.stdout.on('data', (d) => outChunks.push(d));
    child.stderr.on('data', (d) => errChunks.push(d));
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('helper timed out'));
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: Buffer.concat(outChunks).toString('utf8'),
        stderr: Buffer.concat(errChunks).toString('utf8'),
      });
    });
    child.stdin.write(stdinPayload);
    child.stdin.end();
  });
}

describe('hook-helper', () => {
  let server;
  let tmpHome;

  beforeAll(async () => {
    server = await startMockServer();
    tmpHome = mkdtempSync(join(tmpdir(), 'termlnk-hookcli-'));
  });

  afterAll(async () => {
    await server.close();
    rmSync(tmpHome, { recursive: true, force: true });
  });

  it('forwards a fire-and-forget event via env vars and returns {}', async () => {
    const result = await runHelper({
      args: ['--agent', 'claude-code', '--event', 'post-tool-use'],
      stdinPayload: JSON.stringify({ tool_name: 'Bash', session_id: 'agent-sid-xyz' }),
      env: {
        TERMLNK_HOOK_PORT: String(server.port),
        TERMLNK_HOOK_TOKEN: 'env-token',
        TERMLNK_SESSION_ID: 'pty-sid-1',
        HOME: tmpHome,
      },
    });
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('{}');
    const lastEvent = server.events[server.events.length - 1];
    expect(lastEvent.url).toBe('/hook');
    expect(lastEvent.headers.authorization).toBe('Bearer env-token');
    expect(lastEvent.body.event).toBe('post-tool-use');
    expect(lastEvent.body.agent).toBe('claude-code');
    expect(lastEvent.body.sessionId).toBe('pty-sid-1');
    expect(lastEvent.body.agentSessionId).toBe('agent-sid-xyz');
    expect(lastEvent.body.payload).toEqual({ tool_name: 'Bash', session_id: 'agent-sid-xyz' });
    expect(lastEvent.body.meta).toBeTypeOf('object');
    expect(typeof lastEvent.body.meta.ppid).toBe('number');
  });

  it('falls back to runtime.json when env vars missing and synthesizes external session id', async () => {
    const runtimeFile = join(tmpHome, 'runtime.json');
    mkdirSync(tmpHome, { recursive: true });
    writeFileSync(
      runtimeFile,
      JSON.stringify({ port: server.port, token: 'file-token', pid: 42, schemaVersion: 1 }, null, 2),
      { mode: 0o600 }
    );
    const envWithoutHookVars = {
      HOME: tmpHome,
      TERMLNK_RUNTIME_FILE: runtimeFile,
      // Clear any parent-inherited hook env vars
      TERMLNK_HOOK_PORT: '',
      TERMLNK_HOOK_TOKEN: '',
      TERMLNK_SESSION_ID: '',
    };

    const before = server.events.length;
    const result = await runHelper({
      args: ['--agent', 'codex', '--event', 'session-start'],
      stdinPayload: '{}',
      env: envWithoutHookVars,
    });
    expect(result.code).toBe(0);
    const newEvent = server.events[before];
    expect(newEvent.url).toBe('/hook');
    expect(newEvent.headers.authorization).toBe('Bearer file-token');
    expect(newEvent.body.sessionId).toMatch(/^external-[a-f0-9]{12}$/);
  });

  it('exits cleanly with {} when no endpoint is discoverable', async () => {
    const blankHome = mkdtempSync(join(tmpdir(), 'termlnk-hookcli-blank-'));
    try {
      const result = await runHelper({
        args: ['--agent', 'claude-code', '--event', 'post-tool-use'],
        stdinPayload: '{}',
        env: {
          HOME: blankHome,
          TERMLNK_RUNTIME_FILE: join(blankHome, 'nonexistent-runtime.json'),
          TERMLNK_HOOK_PORT: '',
          TERMLNK_HOOK_TOKEN: '',
          TERMLNK_SESSION_ID: '',
        },
      });
      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toBe('{}');
    } finally {
      rmSync(blankHome, { recursive: true, force: true });
    }
  });

  it('returns the server body verbatim for permission-request', async () => {
    server.setPermissionResponse('{"decision":"block","reason":"nope"}');
    try {
      const result = await runHelper({
        args: ['--agent', 'claude-code', '--event', 'permission-request'],
        stdinPayload: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }),
        env: {
          TERMLNK_HOOK_PORT: String(server.port),
          TERMLNK_HOOK_TOKEN: 'env-token',
          TERMLNK_SESSION_ID: 'pty-sid-perm',
          HOME: tmpHome,
        },
      });
      expect(result.code).toBe(0);
      expect(result.stdout).toBe('{"decision":"block","reason":"nope"}');
    } finally {
      server.setPermissionResponse('{}');
    }
  });
});
