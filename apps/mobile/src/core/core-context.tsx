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
import { AuthState, IAuthService as IAuthServiceId, IMasterKeyService as IMasterKeyServiceId, ITokenStorageService as ITokenStorageServiceId } from '@termlnk/auth';
import { ILogService as ILogServiceId, Quantity } from '@termlnk/core';
import Constants from 'expo-constants';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { IMobileHostRepository } from '../storage/mobile-host-repository';
import { MobileSyncPullService } from '../sync/mobile-sync-pull.service';
import { createMobileCore } from './create-mobile-core';

interface ICoreContextValue {
  core: Core;
  authService: IAuthService | null;
  // Lazy singleton — instantiated on first access from a screen that wants to render
  // the synced vault. Holds the master key reference and cursor, so callers must NOT
  // re-create it per screen.
  getSyncPullService: () => MobileSyncPullService;
}

const CLIENT_ID = 'mobile-app';

const CoreContext = createContext<ICoreContextValue | null>(null);

// Single Core for the app lifetime. React StrictMode mounts effects twice in dev — we
// gate against re-creation by stashing the instance in module scope, then dispose on
// the genuine unmount. Expo Router never unmounts the root layout outside hot reload.
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

  // Lazy: only built when a screen actually wants the synced hosts. Stored on the
  // CoreProvider closure so it survives across screens.
  const value = useMemo<ICoreContextValue>(() => {
    let syncPull: MobileSyncPullService | null = null;
    return {
      core,
      authService,
      getSyncPullService: () => {
        if (!syncPull) {
          const injector = core.getInjector();
          const masterKey = injector.get(IMasterKeyServiceId);
          const tokenStorage = injector.get(ITokenStorageServiceId);
          const logService = injector.get(ILogServiceId);
          const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
          const fromExtra = typeof extra.cloudBaseUrl === 'string' ? extra.cloudBaseUrl : undefined;
          const cloudBaseUrl = fromExtra ?? process.env.EXPO_PUBLIC_CLOUD_BASE_URL;
          const hostRepo = injector.get(IMobileHostRepository);
          syncPull = new MobileSyncPullService(
            { cloudBaseUrl, clientId: CLIENT_ID },
            masterKey,
            tokenStorage,
            logService,
            hostRepo
          );
        }
        return syncPull;
      },
    };
  }, [core, authService]);
  return <CoreContext.Provider value={value}>{children}</CoreContext.Provider>;
}

export function useSyncPullService(): MobileSyncPullService {
  return useCoreContext().getSyncPullService();
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

// Subscribes once on mount; emits the latest value through useState. The observable is
// stable because the Core / auth service singleton never re-creates per render.
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
