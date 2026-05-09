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

import type { Core } from '@termlnk/core';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@termlnk/design';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createCore } from './core';

/**
 * WebShell — login gate for the termlnk-web SPA.
 *
 * The browser never holds a master password (architecture decision Δ30).
 * Instead the deployer injects the master password into the termlnk-web
 * server process via env / docker secrets; the browser presents a single
 * "access password" form that maps to the server's Argon2id verifier.
 * After /__termlnk-web/login succeeds, the server hands back an HttpOnly
 * session cookie and we mount the full Workbench (createCore + every UI
 * plugin), unchanged from the desktop renderer.
 *
 * State machine:
 *   loading       → first /__termlnk-web/status is in flight
 *   holder_error  → server has no master password configured / Argon2id
 *                   failed; deployer must fix env / secrets
 *   login_required→ holder unlocked, no valid session cookie yet
 *   authenticated → cookie valid; render Workbench
 *
 * The two transition events are (a) login success, which flips us straight
 * to authenticated; (b) Workbench teardown / explicit logout, which calls
 * /__termlnk-web/logout and flips us back to login_required.
 */

type ShellState =
  | { kind: 'loading' }
  | { kind: 'holder_error'; message: string }
  | { kind: 'login_required' }
  | { kind: 'authenticated' };

interface IStatusResponse {
  holderStatus: 'pending' | 'unlocked' | 'error';
  holderError: string | null;
  authenticated: boolean;
}

const STATUS_PATH = '/__termlnk-web/status';
const LOGIN_PATH = '/__termlnk-web/login';
const LOGOUT_PATH = '/__termlnk-web/logout';

async function fetchStatus(): Promise<ShellState> {
  const resp = await fetch(STATUS_PATH, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
  if (!resp.ok) {
    return { kind: 'holder_error', message: `Server returned HTTP ${resp.status}` };
  }
  const body = await resp.json() as IStatusResponse;
  if (body.holderStatus !== 'unlocked') {
    return {
      kind: 'holder_error',
      message: body.holderError ?? `Master key holder is in "${body.holderStatus}" state. Check server-side configuration.`,
    };
  }
  return body.authenticated ? { kind: 'authenticated' } : { kind: 'login_required' };
}

export function WebShell() {
  const [state, setState] = useState<ShellState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchStatus()
      .then((next) => {
        if (!cancelled) {
          setState(next);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ kind: 'holder_error', message: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoggedIn = useCallback(() => {
    setState({ kind: 'authenticated' });
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch(LOGOUT_PATH, { method: 'POST', credentials: 'same-origin' });
    } catch {
      // Best effort — even if the request fails the client should still drop
      // back to the login screen so the operator can re-auth.
    }
    setState({ kind: 'login_required' });
  }, []);

  if (state.kind === 'loading') {
    return <CenteredMessage title="Termlnk Web" body="Connecting to the server..." />;
  }
  if (state.kind === 'holder_error') {
    return <DeployErrorView message={state.message} />;
  }
  if (state.kind === 'login_required') {
    return <LoginView onSuccess={handleLoggedIn} />;
  }
  return <Workbench onLogout={handleLogout} />;
}

function CenteredMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="tm:flex tm:size-full tm:items-center tm:justify-center tm:bg-black tm:text-light-grey">
      <div className="tm:flex tm:flex-col tm:items-center tm:gap-2">
        <h1 className="tm:text-xl tm:font-semibold tm:text-white">{title}</h1>
        <p className="tm:text-sm tm:text-grey-fg">{body}</p>
      </div>
    </div>
  );
}

function DeployErrorView({ message }: { message: string }) {
  return (
    <div className="tm:flex tm:size-full tm:items-center tm:justify-center tm:bg-black">
      <Card className="tm:w-full tm:max-w-md tm:border-red tm:bg-one-bg">
        <CardHeader>
          <CardTitle className="tm:text-red">Termlnk Web is not ready</CardTitle>
          <CardDescription className="tm:text-grey-fg">
            The server reported a startup error. Fix the configuration on the host and reload this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="tm:max-h-64 tm:overflow-auto tm:rounded-md tm:bg-black tm:p-3 tm:text-xs tm:text-light-grey">
            {message}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

interface ILoginViewProps {
  onSuccess: () => void;
}

function LoginView({ onSuccess }: ILoginViewProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || password.length === 0) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch(LOGIN_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (resp.ok) {
        setPassword('');
        onSuccess();
        return;
      }
      if (resp.status === 401) {
        setError('Invalid password.');
      } else if (resp.status === 503) {
        setError('Server is not ready (master password not configured).');
      } else {
        setError(`Login failed (HTTP ${resp.status}).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [password, submitting, onSuccess]);

  return (
    <div className="tm:flex tm:size-full tm:items-center tm:justify-center tm:bg-black">
      <Card className="tm:w-full tm:max-w-md tm:bg-one-bg">
        <CardHeader>
          <CardTitle className="tm:text-white">Termlnk Web</CardTitle>
          <CardDescription className="tm:text-grey-fg">
            Enter the access password configured by your deployer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="tm:flex tm:flex-col tm:gap-4">
            <div className="tm:flex tm:flex-col tm:gap-2">
              <Label htmlFor="termlnk-web-password" className="tm:text-light-grey">
                Access password
              </Label>
              <Input
                id="termlnk-web-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                disabled={submitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error
              ? (
                  <div className="tm:rounded-md tm:border tm:border-red tm:bg-black tm:px-3 tm:py-2 tm:text-sm tm:text-red">
                    {error}
                  </div>
                )
              : null}
            <Button type="submit" disabled={submitting || password.length === 0}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

interface IWorkbenchProps {
  onLogout: () => void;
}

function Workbench({ onLogout }: IWorkbenchProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    coreRef.current = createCore(containerRef.current);
    return () => {
      if (coreRef.current) {
        coreRef.current.dispose();
        coreRef.current = null;
      }
    };
  }, []);

  // Expose logout to a global hook so the UI plugins can wire a menu item
  // in P7.8 without needing a fresh DI service. Cheap and reversible.
  useEffect(() => {
    (window as unknown as { __termlnkWebLogout?: () => void }).__termlnkWebLogout = onLogout;
    return () => {
      delete (window as unknown as { __termlnkWebLogout?: () => void }).__termlnkWebLogout;
    };
  }, [onLogout]);

  return <div ref={containerRef} className="tm:size-full" />;
}
