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

import { LocaleService, Quantity } from '@termlnk/core';
import { cn, useDependency, useObservable } from '@termlnk/design';
import { IRemoteSessionService } from '@termlnk/shared-terminal';
import { CheckIcon, KeyboardIcon, UserIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EMPTY } from 'rxjs';

const OVERLAY_TTL_MS = 3000;

type ToastKind = 'self-acquired' | 'released' | 'taken-by-other';

interface IToastSpec {
  readonly kind: ToastKind;
  readonly key: number;
}

export interface IDriverChangeOverlayProps {
  readonly sessionId: string;
}

/**
 * Transient floating notice that surfaces driver-change events to the joiner.
 *
 * Sits inside the xterm container as an absolute-positioned card. Stays out of
 * sight until `driverId$` actually transitions; then renders for `OVERLAY_TTL_MS`
 * (or until the user presses any key — handled by the parent view, not us).
 * Three flavours:
 *   - self-acquired   → "you've got remote control"
 *   - released        → "keyboard is free"
 *   - taken-by-other  → "someone else is driving"
 *
 * Owner-side tabs do not host this overlay (RemoteTerminalView is joiner-only);
 * owners watch the tab status-dot on `MultiplayerControl` instead.
 */
export function DriverChangeOverlay({ sessionId }: IDriverChangeOverlayProps): React.JSX.Element | null {
  const localeService = useDependency(LocaleService);
  const remote = useDependency(IRemoteSessionService, Quantity.OPTIONAL);

  const driverObservable = useMemo(
    () => remote?.driverId$(sessionId) ?? EMPTY,
    [remote, sessionId]
  );
  const connectionObservable = useMemo(
    () => remote?.connectionId$(sessionId) ?? EMPTY,
    [remote, sessionId]
  );
  const driverId = useObservable<string | null>(driverObservable, null);
  const myClientId = useObservable<string | null>(connectionObservable, null);

  // Strictly monotonic key for the rendered toast — guarantees React re-mounts
  // the card on every transition (so the slide-in/fade-in animations replay).
  // Date.now() collides when two transitions land in the same millisecond.
  const toastKeyRef = useRef(0);
  // Tracks the last driver value we *processed*. Separate from `seenFirstRef`
  // because we still need to know what the previous driver was to decide
  // which toast kind to render.
  const previousDriverRef = useRef<string | null>(null);
  // Skips the very first effect invocation — `useObservable` seeds with null
  // before any real handover lands, so a card on first paint would be noise.
  const seenFirstRef = useRef(false);
  const [toast, setToast] = useState<IToastSpec | null>(null);

  useEffect(() => {
    if (!seenFirstRef.current) {
      seenFirstRef.current = true;
      previousDriverRef.current = driverId;
      return;
    }
    const previous = previousDriverRef.current;
    previousDriverRef.current = driverId;
    if (previous === driverId) {
      return;
    }
    let kind: ToastKind;
    if (driverId !== null && driverId === myClientId) {
      kind = 'self-acquired';
    } else if (driverId === null) {
      kind = 'released';
    } else {
      // Only surface 'taken-by-other' to the participant who *lost* the
      // keyboard. Without this guard every joiner sees the same toast on
      // every null → X first claim and every A → B intra-joiner handover,
      // which is just noise to everyone except the previous driver.
      if (previous !== myClientId) {
        return;
      }
      kind = 'taken-by-other';
    }
    toastKeyRef.current += 1;
    setToast({ kind, key: toastKeyRef.current });
  }, [driverId, myClientId]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = setTimeout(() => setToast(null), OVERLAY_TTL_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) {
    return null;
  }

  const meta = renderMeta(toast.kind, localeService);
  return (
    <div
      key={toast.key}
      className={cn(`
        tm:pointer-events-none tm:absolute tm:bottom-4 tm:left-4 tm:z-40 tm:flex tm:animate-in tm:items-center tm:gap-2
        tm:rounded-lg tm:border tm:border-line tm:bg-one-bg tm:px-3 tm:py-2 tm:shadow-lg tm:fade-in
        tm:slide-in-from-bottom-2
      `)}
    >
      <span className={cn('tm:flex tm:size-5 tm:items-center tm:justify-center', meta.iconClass)}>
        {meta.icon}
      </span>
      <span className={cn('tm:text-xs tm:font-medium tm:text-light-grey')}>
        {meta.label}
      </span>
    </div>
  );
}

interface IToastMeta {
  readonly icon: React.ReactNode;
  readonly iconClass: string;
  readonly label: string;
}

function renderMeta(kind: ToastKind, locale: LocaleService): IToastMeta {
  switch (kind) {
    case 'self-acquired':
      return {
        icon: <CheckIcon className={cn('tm:size-3.5')} />,
        iconClass: 'tm:text-green',
        label: locale.t('shared-terminal-ui.remote.toast.self-acquired'),
      };
    case 'released':
      return {
        icon: <KeyboardIcon className={cn('tm:size-3.5')} />,
        iconClass: 'tm:text-grey-fg',
        label: locale.t('shared-terminal-ui.remote.toast.released'),
      };
    case 'taken-by-other':
    default:
      return {
        icon: <UserIcon className={cn('tm:size-3.5')} />,
        iconClass: 'tm:text-yellow',
        label: locale.t('shared-terminal-ui.remote.toast.taken-by-other'),
      };
  }
}
