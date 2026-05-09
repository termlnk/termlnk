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

import type { Observable } from 'rxjs';
import type { IDevice } from '../models/device';
import type { AuthState, IAuthError } from '../models/session';
import type { ILoginInput, IRegisterInput, IUserAccount } from '../models/user';
import { createIdentifier } from '@termlnk/core';

// Renderer-side facade. Mirrors IAuthService for triggering actions and observing state,
// but the renderer never holds the master key or any token. The password transits inside
// the register/login tRPC call stack only.
export interface IAuthClientService {
  readonly currentUser$: Observable<IUserAccount | null>;
  readonly authState$: Observable<AuthState>;
  readonly lastError$: Observable<IAuthError | null>;

  register(input: IRegisterInput): Promise<void>;
  login(input: ILoginInput): Promise<void>;
  logout(): Promise<void>;

  listDevices(): Promise<readonly IDevice[]>;
  revokeDevice(deviceId: string): Promise<void>;
}

export const IAuthClientService = createIdentifier<IAuthClientService>('auth.auth-client-service');
