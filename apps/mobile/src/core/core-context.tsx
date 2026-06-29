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
import { IMobileChatService, IMobileProviderService, IMobileSessionService } from '@termlnk/agent-mobile';
import { AuthState, IAuthService as IAuthServiceId } from '@termlnk/auth';
import { IBiometricService } from '@termlnk/auth-mobile';
import { Quantity } from '@termlnk/core';
import { IMobileHostRepository, IMobileIdentityRepository, IMobileKnownHostRepository, IMobilePreferencesService, IMobileSnippetRepository, IMobileSshKeyRepository, IRecentSessionsRepository } from '@termlnk/database-mobile';
import { IMobilePortForwardingService } from '@termlnk/port-forwarding-mobile';
import { IMobileSftpClientFactory } from '@termlnk/sftp-mobile';
import { IMobileSyncService } from '@termlnk/sync-mobile';
import { IMobileConnectionService, IMobileSshClientService } from '@termlnk/terminal-mobile';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createMobileCore } from './create-mobile-core';

interface ICoreContextValue {
  core: Core;
  authService: IAuthService | null;
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
      getSyncService: () => core.getInjector().get(IMobileSyncService),
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
  // Restoring is the pre-subscription default: the service starts there too, so the first
  // render never assumes signed-out while the persisted session is still being rehydrated.
  return useObservableValue(auth?.authState$, AuthState.Restoring);
}

export function useCurrentUser(): IUserAccount | null {
  const auth = useAuthService();
  return useObservableValue(auth?.currentUser$, null);
}
// Resolves the singleton RecentSessionsRepository; `.ready()` is the caller's
// responsibility (the Recent tab calls it on mount; other screens implicitly open the
// DB via touch()).
export function useRecentSessionsRepository(): IRecentSessionsRepository {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IRecentSessionsRepository), [core]);
}

export function useHostRepository(): IMobileHostRepository {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobileHostRepository), [core]);
}

export function useIdentityRepository(): IMobileIdentityRepository {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobileIdentityRepository), [core]);
}

export function useSshKeyRepository(): IMobileSshKeyRepository {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobileSshKeyRepository), [core]);
}

export function useKnownHostRepository(): IMobileKnownHostRepository {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobileKnownHostRepository), [core]);
}

export function usePreferencesService(): IMobilePreferencesService {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobilePreferencesService), [core]);
}

export function useProviderService(): IMobileProviderService {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobileProviderService), [core]);
}

export function useChatService(): IMobileChatService {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobileChatService), [core]);
}

export function useSessionService(): IMobileSessionService {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobileSessionService), [core]);
}

export function useSshClientService(): IMobileSshClientService {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobileSshClientService), [core]);
}

export function useConnectionService(): IMobileConnectionService {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobileConnectionService), [core]);
}

export function useSftpClientFactory(): IMobileSftpClientFactory {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobileSftpClientFactory), [core]);
}

export function useBiometricService(): IBiometricService {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IBiometricService), [core]);
}

export function usePortForwardingService(): IMobilePortForwardingService {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobilePortForwardingService), [core]);
}

export function useSnippetRepository(): IMobileSnippetRepository {
  const { core } = useCoreContext();
  return useMemo(() => core.getInjector().get(IMobileSnippetRepository), [core]);
}

export function useObservable<T, TInitial extends T = T>(observable$: Observable<T> | undefined, initial: TInitial): T {
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
