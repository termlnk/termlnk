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

import type { IAuthService, IUserAccount } from '@termlnk/auth';
import type { Core } from '@termlnk/core';
import type { ReactNode } from 'react';
import type { Observable } from 'rxjs';
import type { IMobileSyncService } from '../sync/mobile-sync.service';
import { AuthState, IAuthService as IAuthServiceId } from '@termlnk/auth';
import { Quantity } from '@termlnk/core';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { IRecentSessionsRepository } from '../sessions/recent-sessions-repository';
import { IMobileSyncService as IMobileSyncServiceId } from '../sync/mobile-sync.service';
import { createMobileCore } from './create-mobile-core';

interface ICoreContextValue {
  core: Core;
  authService: IAuthService | null;
  // The engine-backed sync facade (registered by MobileSyncPlugin). Singleton for the app
  // lifetime; screens read `.hosts$` and call `.pull()`.
  getSyncService: () => IMobileSyncService;
}

const CoreContext = createContext<ICoreContextValue | null>(null);

// Single Core for the app lifetime; stashed in module scope so StrictMode's double-mount
// in dev does not re-create it.
let _moduleCore: Core | null = null;

export function CoreProvider({ children }: { children: ReactNode }): ReactNode {
  const core = useMemo(() => {
    if (!_moduleCore) {
      _moduleCore = createMobileCore();
    }
    return _moduleCore;
  }, []);

  const authService = useMemo(() => {
    return core.getInjector().get(IAuthServiceId, Quantity.OPTIONAL) ?? null;
  }, [core]);

  const value = useMemo<ICoreContextValue>(() => {
    return {
      core,
      authService,
      getSyncService: () => core.getInjector().get(IMobileSyncServiceId),
    };
  }, [core, authService]);
  return <CoreContext.Provider value={value}>{children}</CoreContext.Provider>;
}

export function useSyncService(): IMobileSyncService {
  return useCoreContext().getSyncService();
}

export function useCoreContext(): ICoreContextValue {
  const value = useContext(CoreContext);
  if (!value) {
    throw new Error('useCoreContext must be used inside CoreProvider');
  }
  return value;
}

export function useAuthService(): IAuthService | null {
  return useCoreContext().authService;
}

function useObservableValue<T>(observable$: Observable<T> | undefined, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    if (!observable$) {
      return;
    }
    const sub = observable$.subscribe((v) => setValue(v));
    return () => sub.unsubscribe();
  }, [observable$]);
  return value;
}

export function useAuthState(): AuthState {
  const auth = useAuthService();
  return useObservableValue(auth?.authState$, AuthState.Unauthenticated);
}

export function useCurrentUser(): IUserAccount | null {
  const auth = useAuthService();
  return useObservableValue(auth?.currentUser$, null);
}

// Resolves the singleton RecentSessionsRepository; `.ready()` is the caller's
// responsibility (the Recent tab calls it on mount; other screens implicitly open the
// DB via touch()).
export function useRecentSessionsRepository() {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IRecentSessionsRepository), [core]);
}
