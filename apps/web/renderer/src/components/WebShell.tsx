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
import { cn, LogoIcon } from '@termlnk/design';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createCore } from './core';

type ShellState =
  | { kind: 'loading' }
  | { kind: 'holder_error'; message: string }
  | { kind: 'login_required' }
  | { kind: 'authenticated'; demo: boolean };

interface IStatusResponse {
  holderStatus: 'pending' | 'unlocked' | 'error';
  holderError: string | null;
  authenticated: boolean;
  demo?: boolean;
}

const STATUS_PATH = '/__termlnk-web/status';
const LOGIN_PATH = '/__termlnk-web/login';
const LOGOUT_PATH = '/__termlnk-web/logout';

const BG_SHELL
  = 'tm:bg-[radial-gradient(ellipse_120%_100%_at_50%_50%,#0e0c14_0%,#07060a_55%,#050407_100%)]';
const BG_AURORA
  = 'tm:[background-image:radial-gradient(circle_at_18%_22%,rgba(255,107,157,0.28)_0%,transparent_35%),radial-gradient(circle_at_82%_18%,rgba(96,165,250,0.26)_0%,transparent_35%),radial-gradient(circle_at_80%_85%,rgba(56,189,248,0.22)_0%,transparent_35%),radial-gradient(circle_at_20%_88%,rgba(192,132,252,0.22)_0%,transparent_35%)]';
const BG_SPOTLIGHT
  = 'tm:bg-[radial-gradient(ellipse,rgba(192,132,252,0.16)_0%,rgba(96,165,250,0.08)_35%,transparent_70%)]';
const BG_GRID
  = 'tm:[background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] tm:bg-[length:44px_44px] tm:[mask-image:radial-gradient(ellipse_80%_70%_at_50%_50%,black_25%,transparent_80%)]';
const BG_CARD
  = 'tm:bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0.015)_100%)]';
const BG_BUTTON
  = 'tm:bg-[linear-gradient(135deg,#ff6b9d_0%,#c084fc_35%,#60a5fa_65%,#38bdf8_100%)]';
const BG_FOOTER_DIVIDER
  = 'tm:before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.07)_50%,transparent)]';

// SVG fractalNoise injected via inline style — wrapping the data URI in an
// arbitrary Tailwind value would require escaping `<`, `>`, `'`, `%` and would
// be unreadable. This single inline style is the smallest pragmatic escape
// hatch; everything else flows through Tailwind utility classes.
const NOISE_BG_IMAGE = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 256 256\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/></filter><rect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.45\'/></svg>")';

// Entrance animation — uses tw-animate-css which is already imported via the
// renderer's index.css. Card slides up + fades in once on mount.
const CARD_ENTRANCE = 'tm:animate-in tm:fade-in tm:slide-in-from-bottom-1 tm:duration-300 tm:ease-out';

// Glass card chrome shared by every gate view.
const CARD_CHROME = `
  tm:relative tm:flex tm:flex-col tm:rounded-2xl
  tm:border tm:border-[rgba(255,255,255,0.07)]
  tm:backdrop-blur-xl
  tm:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.65),inset_0_0_0_1px_rgba(255,255,255,0.03)]
`;

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
  return body.authenticated
    ? { kind: 'authenticated', demo: body.demo ?? false }
    : { kind: 'login_required' };
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
    setState({ kind: 'authenticated', demo: false });
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
    return <LoadingView />;
  }
  if (state.kind === 'holder_error') {
    return <DeployErrorView message={state.message} />;
  }
  if (state.kind === 'login_required') {
    return <LoginView onSuccess={handleLoggedIn} />;
  }
  return <Workbench onLogout={handleLogout} demo={state.demo} />;
}

function GateShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(`
        tm:fixed tm:inset-0 tm:flex tm:items-center tm:justify-center tm:overflow-hidden tm:font-sans tm:text-[#fff]
        tm:antialiased
      `, BG_SHELL)}
    >
      <div className={cn('tm:pointer-events-none tm:absolute tm:inset-[-5%] tm:blur-[60px] tm:saturate-150', BG_AURORA)} />
      <div
        className={cn(`
          tm:pointer-events-none tm:absolute tm:top-1/2 tm:left-1/2 tm:h-[min(720px,86vh)] tm:w-[min(960px,86vw)]
          tm:-translate-1/2 tm:blur-[20px]
        `, BG_SPOTLIGHT)}
      />
      <div className={cn('tm:pointer-events-none tm:absolute tm:inset-0', BG_GRID)} />
      <div
        className="tm:pointer-events-none tm:absolute tm:inset-0 tm:opacity-50 tm:mix-blend-overlay"
        style={{ backgroundImage: NOISE_BG_IMAGE }}
      />
      <div className="tm:relative tm:z-1 tm:w-full tm:max-w-md tm:p-6">
        {children}
      </div>
    </div>
  );
}

function LoadingView() {
  return (
    <GateShell>
      <div className={cn(CARD_CHROME, BG_CARD, CARD_ENTRANCE, 'tm:gap-0 tm:px-6 tm:py-5')}>
        <div className="tm:flex tm:items-center tm:gap-2.5 tm:text-sm tm:text-[rgba(255,255,255,0.7)]">
          <SpinnerIcon size={16} />
          <span>Connecting to the server…</span>
        </div>
      </div>
    </GateShell>
  );
}

function DeployErrorView({ message }: { message: string }) {
  return (
    <GateShell>
      <div className={cn(CARD_CHROME, BG_CARD, CARD_ENTRANCE, 'tm:gap-6 tm:p-7')}>
        <div className="tm:flex tm:flex-col tm:gap-3.5">
          <div className="tm:flex tm:items-center tm:gap-2.5 tm:text-[#fca5a5]">
            <AlertIcon size={18} />
            <span className="tm:text-[15px] tm:font-semibold">Termlnk Web is not ready</span>
          </div>
          <p className="tm:m-0 tm:text-[13.5px] tm:leading-[1.55] tm:text-[rgba(255,255,255,0.55)]">
            The server reported a startup error. Fix the configuration on the host and reload this page.
          </p>
        </div>
        <pre
          className={cn(`
            tm:m-0 tm:max-h-64 tm:overflow-auto tm:rounded-[10px] tm:border tm:border-[rgba(239,68,68,0.2)]
            tm:bg-[rgba(0,0,0,0.45)] tm:px-3.5 tm:py-3 tm:font-mono tm:text-xs/normal tm:wrap-break-word
            tm:whitespace-pre-wrap tm:text-[rgba(255,255,255,0.85)]
          `)}
        >
          {message}
        </pre>
      </div>
    </GateShell>
  );
}

interface ILoginViewProps {
  onSuccess: () => void;
}

function LoginView({ onSuccess }: ILoginViewProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

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

  const submitDisabled = submitting || password.length === 0;

  return (
    <GateShell>
      <div className={cn(CARD_CHROME, BG_CARD, CARD_ENTRANCE, 'tm:gap-6 tm:p-7')}>
        {/* Header: logo + title on one row, both centered. */}
        <div className="tm:flex tm:flex-col tm:items-center tm:gap-3.5 tm:text-center">
          <div className="tm:flex tm:items-center tm:gap-3">
            <LogoIcon className="tm:size-9 tm:filter-[drop-shadow(0_6px_20px_rgba(192,132,252,0.35))]" />
            <h1 className="tm:m-0 tm:text-[22px] tm:leading-[1.2] tm:font-semibold tm:tracking-[-0.02em] tm:text-[#fff]">
              Termlnk Web
            </h1>
          </div>
          <p className="tm:m-0 tm:text-[13.5px] tm:leading-[1.55] tm:text-[rgba(255,255,255,0.55)]">
            A modern, AI-augmented terminal that links every server you run.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="tm:flex tm:flex-col tm:gap-4" noValidate>
          <div className="tm:flex tm:flex-col tm:gap-2">
            <label
              htmlFor="termlnk-web-password"
              className="
                tm:m-0 tm:text-[11px] tm:font-semibold tm:tracking-[0.08em] tm:text-[rgba(255,255,255,0.55)]
                tm:uppercase
              "
            >
              Access password
            </label>
            <div className="tm:relative tm:w-full">
              <input
                id="termlnk-web-password"
                className={cn(`
                  tm:block tm:h-11 tm:w-full tm:appearance-none tm:rounded-[10px] tm:border
                  tm:border-[rgba(255,255,255,0.1)] tm:bg-[rgba(0,0,0,0.35)] tm:py-0 tm:pr-11 tm:pl-3.5 tm:text-sm
                  tm:leading-none tm:text-[#fff] tm:transition-[border-color,box-shadow,background-color]
                  tm:duration-200 tm:outline-none
                  tm:placeholder:text-[rgba(255,255,255,0.3)]
                  tm:hover:border-[rgba(255,255,255,0.18)]
                  tm:focus:border-[rgba(96,165,250,0.55)] tm:focus:bg-[rgba(0,0,0,0.45)]
                  tm:focus:shadow-[0_0_0_3px_rgba(96,165,250,0.18)]
                  tm:focus-visible:border-[rgba(96,165,250,0.55)] tm:focus-visible:bg-[rgba(0,0,0,0.45)]
                  tm:focus-visible:shadow-[0_0_0_3px_rgba(96,165,250,0.18)]
                  tm:disabled:cursor-not-allowed tm:disabled:opacity-[0.55]
                `)}
                type={passwordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus
                disabled={submitting}
                value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className={cn(`
                  tm:absolute tm:top-1/2 tm:right-2 tm:inline-flex tm:size-7 tm:-translate-y-1/2 tm:cursor-pointer
                  tm:items-center tm:justify-center tm:rounded-md tm:border-0 tm:bg-transparent
                  tm:text-[rgba(255,255,255,0.55)] tm:transition-[background-color,color] tm:duration-150
                  tm:focus-visible:outline-2 tm:focus-visible:outline-offset-1
                  tm:focus-visible:outline-[rgba(96,165,250,0.6)]
                  tm:enabled:hover:bg-[rgba(255,255,255,0.06)] tm:enabled:hover:text-[#fff]
                  tm:disabled:cursor-not-allowed tm:disabled:opacity-40
                `)}
                onClick={() => setPasswordVisible((v) => !v)}
                disabled={submitting}
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
              >
                {passwordVisible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error
            ? (
              <div
                className={cn(`
                  tm:flex tm:items-start tm:gap-2 tm:rounded-lg tm:border tm:border-[rgba(239,68,68,0.28)]
                  tm:bg-[rgba(239,68,68,0.08)] tm:px-3 tm:py-2.5 tm:text-[13px] tm:leading-[1.45] tm:text-[#fca5a5]
                `)}
                role="alert"
              >
                <AlertIcon size={16} className="tm:mt-px tm:shrink-0" />
                <span>{error}</span>
              </div>
            )
            : null}

          {/* Submit button */}
          <button
            type="submit"
            className={cn(`
              tm:relative tm:inline-flex tm:h-11 tm:w-full tm:cursor-pointer tm:items-center tm:justify-center tm:gap-2
              tm:overflow-hidden tm:rounded-[10px] tm:border-0 tm:px-4 tm:text-sm tm:font-medium tm:tracking-[0.01em]
              tm:text-[#fff] tm:shadow-[0_10px_28px_-10px_rgba(192,132,252,0.55)]
              tm:transition-[transform,box-shadow,filter] tm:duration-200
              tm:after:pointer-events-none tm:after:absolute tm:after:inset-0
              tm:after:[background:linear-gradient(180deg,rgba(255,255,255,0.12),transparent_50%)]
              tm:focus-visible:outline-2 tm:focus-visible:outline-offset-2
              tm:focus-visible:outline-[rgba(255,255,255,0.7)]
              tm:enabled:hover:-translate-y-px tm:enabled:hover:shadow-[0_14px_34px_-10px_rgba(192,132,252,0.65)]
              tm:enabled:hover:brightness-105
              tm:enabled:active:translate-y-0 tm:enabled:active:brightness-95
              tm:disabled:cursor-not-allowed tm:disabled:opacity-40 tm:disabled:shadow-none
            `, BG_BUTTON)}
            disabled={submitDisabled}
          >
            {submitting
              ? (
                <>
                  <SpinnerIcon size={16} />
                  <span>Signing in…</span>
                </>
              )
              : (
                <span>Sign in</span>
              )}
          </button>
        </form>

        {/* Footer: copyright only, with a soft hairline divider above it. */}
        <div
          className={cn(`
            tm:relative tm:pt-3.5 tm:text-center
            tm:before:absolute tm:before:inset-x-[15%] tm:before:top-0 tm:before:h-px tm:before:content-['']
          `, BG_FOOTER_DIVIDER)}
        >
          <p className="tm:m-0 tm:text-[10.5px] tm:tracking-[0.04em] tm:text-[rgba(255,255,255,0.32)]">
            ©
            {' '}
            2026
            {' '}
            <a
              href="https://www.termlnk.com"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(`
                tm:text-inherit tm:transition-colors tm:duration-150
                tm:hover:text-[rgba(192,132,252,0.9)] tm:hover:underline tm:hover:underline-offset-2
              `)}
            >
              Termlnk
            </a>
            {' · All rights reserved'}
          </p>
        </div>
      </div>
    </GateShell>
  );
}

interface IWorkbenchProps {
  onLogout: () => void;
  demo: boolean;
}

function Workbench({ onLogout, demo }: IWorkbenchProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<Core | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    let cancelled = false;

    (async () => {
      const core = await createCore(containerRef.current!);
      if (cancelled) {
        core.dispose();
        return;
      }
      coreRef.current = core;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (coreRef.current) {
        coreRef.current.dispose();
        coreRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    (window as unknown as { __termlnkWebLogout?: () => void }).__termlnkWebLogout = demo ? undefined : onLogout;
    (window as unknown as { __TERMLNK_DEMO?: boolean }).__TERMLNK_DEMO = demo;
    return () => {
      delete (window as unknown as { __termlnkWebLogout?: () => void }).__termlnkWebLogout;
      delete (window as unknown as { __TERMLNK_DEMO?: boolean }).__TERMLNK_DEMO;
    };
  }, [onLogout, demo]);

  // tm:size-full only sets width/height (no color vars), so it is safe even
  // before ThemeService has injected the Base46 palette. Inline black
  // background covers the async gap between mount and Core init.
  return (
    <div
      ref={containerRef}
      className="tm:size-full"
      style={ready ? undefined : { backgroundColor: '#000' }}
    />
  );
}

interface IIconProps {
  size?: number;
  className?: string;
}

function EyeIcon({ size = 16, className }: IIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ size = 16, className }: IIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function SpinnerIcon({ size = 16, className }: IIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={cn('tm:animate-spin', className)}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function AlertIcon({ size = 16, className }: IIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
