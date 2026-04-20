/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { IProxy } from '@termlnk/terminal';
import type { Socket } from 'node:net';
import type { TLSSocket } from 'node:tls';
import { Buffer } from 'node:buffer';
import * as tls from 'node:tls';
import { isValidIP as isLikelyIPAddress } from '@termlnk/core';
import { z } from 'zod';
import { connectHttpProxy, connectSocks5Proxy } from '../../services/proxy/proxy-socket';
import { publicProcedure, router } from '../trpc';

const DEFAULT_PROXY_TEST_TIMEOUT = 10_000;
const PROXY_TEST_REQUEST_HEADERS = {
  Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  'Accept-Encoding': 'identity',
  Connection: 'close',
  'User-Agent': 'termlnk-proxy-test/1.0',
};

interface IProxyTestTarget {
  name: string;
  host: string;
  port: number;
  path: string;
  secure: boolean;
}

const PROXY_TEST_TARGETS: readonly IProxyTestTarget[] = [
  {
    name: 'ipinfo',
    host: 'ipinfo.io',
    port: 443,
    path: '/json',
    secure: true,
  },
  {
    name: 'ipify',
    host: 'api.ipify.org',
    port: 443,
    path: '/?format=json',
    secure: true,
  },
  {
    name: 'ifconfig-me',
    host: 'ifconfig.me',
    port: 443,
    path: '/ip',
    secure: true,
  },
  {
    name: 'icanhazip',
    host: 'ipv4.icanhazip.com',
    port: 443,
    path: '/',
    secure: true,
  },
  {
    name: 'checkip-amazonaws',
    host: 'checkip.amazonaws.com',
    port: 443,
    path: '/',
    secure: true,
  },
  {
    name: 'ip-api',
    host: 'ip-api.com',
    port: 80,
    path: '/json/?fields=status,query,message',
    secure: false,
  },
];

const proxyTestSchema = z.object({
  type: z.enum(['socks5', 'http']),
  host: z.string().trim().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().optional(),
  password: z.string().optional(),
  timeout: z.number().int().min(1_000).max(20_000).optional(),
});

export type ProxyRouter = typeof proxyRouter;

export const proxyRouter = router({
  test: publicProcedure.input(proxyTestSchema).mutation(async ({ input }) => {
    const startedAt = Date.now();
    const timeout = input.timeout ?? DEFAULT_PROXY_TEST_TIMEOUT;
    const proxy: IProxy = {
      enabled: true,
      type: input.type,
      host: input.host,
      port: input.port,
      username: normalizeOptionalText(input.username),
      password: normalizeOptionalText(input.password),
    };

    try {
      const ip = await requestPublicIPThroughProxy(proxy, timeout);
      return {
        ok: true,
        latency: Date.now() - startedAt,
        ip,
      };
    } catch (err) {
      return {
        ok: false,
        latency: Date.now() - startedAt,
        message: getErrorMessage(err),
      };
    }
  }),
});

async function requestPublicIPThroughProxy(proxy: IProxy, timeout: number): Promise<string> {
  const errors: string[] = [];

  for (const target of PROXY_TEST_TARGETS) {
    let socket: Socket | null = null;
    try {
      socket = proxy.type === 'socks5'
        ? await connectSocks5Proxy({
          proxy,
          destination: {
            host: target.host,
            port: target.port,
          },
          timeout,
        })
        : await connectHttpProxy({
          proxy,
          destination: {
            host: target.host,
            port: target.port,
          },
          timeout,
        });
      return await requestPublicIP(socket, target, timeout);
    } catch (err) {
      errors.push(`${target.name}: ${getErrorMessage(err)}`);
    } finally {
      if (socket && !socket.destroyed) {
        socket.destroy();
      }
    }
  }

  throw new Error(`All proxy test targets failed. ${errors.join(' | ')}`);
}

function requestPublicIP(socket: Socket, target: IProxyTestTarget, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const transport: Socket | TLSSocket = target.secure
      ? createSecureConnection(socket, target.host, timeout)
      : socket;
    const chunks: Buffer[] = [];

    const cleanup = () => {
      transport.removeListener('data', onData);
      transport.removeListener('error', onError);
      transport.removeListener('end', onEnd);
      transport.removeListener('close', onClose);
      transport.removeListener('timeout', onTimeout);
      if (transport instanceof tls.TLSSocket) {
        transport.removeListener('secureConnect', onReady);
      }
    };

    const finalizeReject = (err: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(err);
    };

    const finalizeResolve = (ip: string) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(ip);
    };

    const onData = (chunk: string | Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    };

    const onError = (err: Error) => {
      finalizeReject(err);
    };

    const onEnd = () => {
      try {
        const { statusCode, body } = parseHttpResponse(Buffer.concat(chunks));
        if (statusCode < 200 || statusCode >= 300) {
          finalizeReject(new Error(`Proxy target returned status ${statusCode}`));
          return;
        }

        const parsed = parseProxyIPResponse(body);
        if (!parsed.ip) {
          finalizeReject(new Error(parsed.message ?? 'Unable to parse proxy public IP'));
          return;
        }

        finalizeResolve(parsed.ip);
      } catch (err) {
        finalizeReject(err instanceof Error ? err : new Error('Unable to parse proxy test response'));
      }
    };

    const onClose = () => {
      if (!settled) {
        onEnd();
      }
    };

    const onTimeout = () => {
      transport.destroy(new Error('Proxy test timed out'));
    };

    const onReady = () => {
      const requestText = buildProxyTestRequest(target);
      transport.write(requestText);
    };

    transport.on('data', onData);
    transport.on('error', onError);
    transport.on('end', onEnd);
    transport.on('close', onClose);
    transport.setTimeout(timeout);
    transport.on('timeout', onTimeout);

    if (transport instanceof tls.TLSSocket) {
      if (transport.connecting) {
        transport.once('secureConnect', onReady);
      } else {
        onReady();
      }
      return;
    }

    onReady();
  });
}

function createSecureConnection(socket: Socket, host: string, timeout: number): TLSSocket {
  const tlsSocket = tls.connect({
    socket,
    servername: host,
  });
  tlsSocket.setTimeout(timeout);
  tlsSocket.on('timeout', () => {
    tlsSocket.destroy(new Error('Proxy TLS handshake timed out'));
  });
  return tlsSocket;
}

function buildProxyTestRequest(target: IProxyTestTarget): string {
  const headers = Object.entries(PROXY_TEST_REQUEST_HEADERS)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\r\n');

  return `GET ${target.path} HTTP/1.1\r\nHost: ${target.host}\r\n${headers}\r\n\r\n`;
}

function parseHttpResponse(input: Buffer): { statusCode: number; body: string } {
  const headerEnd = input.indexOf(Buffer.from('\r\n\r\n'));
  if (headerEnd < 0) {
    throw new Error('Malformed HTTP response');
  }

  const headerText = input.subarray(0, headerEnd).toString('utf8');
  const lines = headerText.split('\r\n');
  const statusLine = lines[0] ?? '';
  const statusMatch = statusLine.match(/^HTTP\/\d\.\d\s+(\d{3})/);
  if (!statusMatch) {
    throw new Error('Malformed HTTP status line');
  }

  const statusCode = Number.parseInt(statusMatch[1], 10);
  const headers = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const index = line.indexOf(':');
    if (index <= 0) {
      continue;
    }
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    headers.set(key, value);
  }

  const rawBody = input.subarray(headerEnd + 4);
  const transferEncoding = headers.get('transfer-encoding')?.toLowerCase() ?? '';
  const decodedBody = transferEncoding.includes('chunked')
    ? decodeChunkedBody(rawBody)
    : rawBody;

  return {
    statusCode,
    body: decodedBody.toString('utf8'),
  };
}

function decodeChunkedBody(input: Buffer): Buffer {
  let offset = 0;
  const chunks: Buffer[] = [];

  while (offset < input.length) {
    const sizeLineEnd = input.indexOf(Buffer.from('\r\n'), offset);
    if (sizeLineEnd < 0) {
      throw new Error('Malformed chunked response');
    }

    const sizeHex = input.subarray(offset, sizeLineEnd).toString('utf8').split(';')[0].trim();
    const size = Number.parseInt(sizeHex, 16);
    if (!Number.isFinite(size) || size < 0) {
      throw new Error('Invalid chunk size');
    }

    offset = sizeLineEnd + 2;
    if (size === 0) {
      return Buffer.concat(chunks);
    }

    const chunkEnd = offset + size;
    if (chunkEnd > input.length) {
      throw new Error('Incomplete chunk body');
    }
    chunks.push(input.subarray(offset, chunkEnd));
    offset = chunkEnd;

    if (input.subarray(offset, offset + 2).toString('utf8') !== '\r\n') {
      throw new Error('Malformed chunk delimiter');
    }
    offset += 2;
  }

  throw new Error('Incomplete chunked response');
}

function parseProxyIPResponse(input: string): { ip: string | null; message?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ip: null };
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      ip?: unknown;
      query?: unknown;
      status?: unknown;
      message?: unknown;
    };

    if (parsed.status === 'fail' && typeof parsed.message === 'string') {
      return {
        ip: null,
        message: parsed.message,
      };
    }

    const ip = typeof parsed.query === 'string'
      ? parsed.query
      : typeof parsed.ip === 'string'
        ? parsed.ip
        : null;

    if (ip && isLikelyIPAddress(ip, { allowCompressedIPv6: true })) {
      return { ip };
    }
  } catch {
    // fall through to regex parsing
  }

  const matched = trimmed.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3}|(?:[a-fA-F0-9]{0,4}:){2,}[a-fA-F0-9]{0,4})/);
  return {
    ip: matched ? matched[1] : null,
  };
}

function normalizeOptionalText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return 'Unknown proxy test error';
}
