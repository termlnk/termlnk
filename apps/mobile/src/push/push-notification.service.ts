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

import type { IAuthService } from '@termlnk/auth';
import { HttpRequestError } from '@termlnk/auth';
import { addNotificationReceivedListener, addNotificationResponseReceivedListener, getExpoPushTokenAsync, getPermissionsAsync, requestPermissionsAsync, setNotificationHandler } from 'expo-notifications';
import { Platform } from 'react-native';

// Wraps Expo Push: permission + token lookup + POST /push/register. The Expo token works
// on iOS and Android, and expo-notifications already brokers the OS permission prompt +
// token rotation, so the server fan-out can stay platform-agnostic. Called on login and
// again on OS token refresh; logout deregisters so the server stops fanning invites.

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface IPushRegistrationResult {
  readonly registered: boolean;
  readonly token: string | null;
  readonly status: PushPermissionStatus;
}

export class PushNotificationService {
  private _registeredToken: string | null = null;
  private readonly _listeners: Array<{ remove: () => void }> = [];

  constructor(
    private readonly _authService: IAuthService,
    private readonly _cloudBaseUrl: string | undefined
  ) {
    // Foreground-delivered notifications go to the system tray with sound; tapping
    // them invokes the response listener below. Same behaviour app-wide so the user
    // sees consistent affordances regardless of where in the navigation stack they are.
    setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    this._listeners.push(
      addNotificationReceivedListener((notif) => {
        // The deep-link router on iOS / Android opens the invite screen when the user
        // taps the banner — see addNotificationResponseReceivedListener below. Receiving
        // a notification while the app is foreground is a no-op except for telemetry.
        void notif;
      })
    );
    this._listeners.push(
      addNotificationResponseReceivedListener((response) => {
        // The payload schema is intentionally flat: `{ type: 'collab-invite', url: '...' }`.
        // Anything else is treated as a generic notification and ignored.
        const payload = response.notification.request.content.data as Record<string, unknown> | null;
        const url = payload && typeof payload === 'object' && typeof payload.url === 'string'
          ? payload.url
          : null;
        if (url) {
          // Linking is implemented by the caller (root layout has access to expo-router);
          // we surface the URL on the global queue. The next consumer reading
          // `PushNotificationService.pendingDeepLinks` after login picks it up.
          this._pendingDeepLinks.push(url);
        }
      })
    );
  }

  // Pending deep-link queue — populated by notification taps, drained by the layout
  // shortly after login. Kept on the service instance so cold-start taps (where the
  // notification is the launch reason) end up here once the auth chain finishes too.
  private readonly _pendingDeepLinks: string[] = [];

  drainDeepLinks(): readonly string[] {
    const out = [...this._pendingDeepLinks];
    this._pendingDeepLinks.length = 0;
    return out;
  }

  dispose(): void {
    for (const listener of this._listeners) {
      listener.remove();
    }
    this._listeners.length = 0;
  }

  async registerForCurrentUser(userAgent?: string): Promise<IPushRegistrationResult> {
    if (!this._cloudBaseUrl) {
      return { registered: false, token: null, status: 'undetermined' };
    }
    const status = await this._ensurePermission();
    if (status !== 'granted') {
      return { registered: false, token: null, status };
    }

    const tokenResult = await getExpoPushTokenAsync();
    const token = tokenResult.data;
    if (!token) {
      return { registered: false, token: null, status: 'granted' };
    }

    const accessToken = await this._authService.getAccessToken();
    if (!accessToken) {
      return { registered: false, token, status: 'granted' };
    }

    const url = this._joinUrl(this._cloudBaseUrl, 'push/register');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        deviceToken: token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        userAgent,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new HttpRequestError(`POST ${url}`, response.status, response.statusText, text);
    }

    this._registeredToken = token;
    return { registered: true, token, status: 'granted' };
  }

  async deregister(): Promise<void> {
    if (!this._cloudBaseUrl || !this._registeredToken) {
      return;
    }
    const accessToken = await this._authService.getAccessToken();
    if (!accessToken) {
      return;
    }

    const url = this._joinUrl(this._cloudBaseUrl, 'push/register');
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ deviceToken: this._registeredToken }),
    });
    if (!response.ok) {
      // Surface failures so the caller can retry — silent failure would keep the server
      // fanning invites to a phone that thought it logged out.
      const text = await response.text().catch(() => '');
      throw new HttpRequestError(`DELETE ${url}`, response.status, response.statusText, text);
    }
    this._registeredToken = null;
  }

  private async _ensurePermission(): Promise<PushPermissionStatus> {
    const existing = await getPermissionsAsync();
    if (existing.status === 'granted') {
      return 'granted';
    }
    // Only prompt when iOS / Android has not yet been asked; re-prompts on 'denied'
    // would be a UX anti-pattern (iOS shows nothing on the second call anyway).
    if (existing.status === 'denied') {
      return 'denied';
    }
    const requested = await requestPermissionsAsync();
    if (requested.status === 'granted') {
      return 'granted';
    }
    if (requested.status === 'denied') {
      return 'denied';
    }
    return 'undetermined';
  }

  private _joinUrl(base: string, path: string): string {
    const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
    return `${trimmedBase}/${trimmedPath}`;
  }
}
