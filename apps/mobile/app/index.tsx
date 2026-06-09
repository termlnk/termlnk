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

import { AuthState } from '@termlnk/auth';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuthService, useAuthState } from '../src/core/core-context';
import { useThemeColors } from '../src/theme/theme-provider';

export default function Index() {
  const authService = useAuthService();
  const state = useAuthState();
  const colors = useThemeColors();

  if (!authService) {
    return (
      <View className="flex-1 items-center justify-center bg-surface px-6">
        <Text className="mb-3 text-[28px] font-semibold text-content">
          Termlnk
        </Text>
        <Text className="mt-2 text-center text-[14px] leading-5 text-content-secondary">
          Cloud sync is not configured. Set EXPO_PUBLIC_CLOUD_BASE_URL or
          app.json `extra.cloudBaseUrl` to point at a termlnk-server deployment.
        </Text>
      </View>
    );
  }

  if (state === AuthState.Authenticated) {
    return <Redirect href="/(tabs)/vaults" />;
  }

  // Restoring: the persisted session is still being rehydrated (token refresh + /auth/me),
  // so it is not yet known whether the user is signed in. Show a splash instead of bouncing
  // to /login — otherwise a valid session flashes the login screen on every cold start and
  // restore()'s later Authenticated emission lands after we've already left this route.
  if (state === AuthState.Restoring || state === AuthState.Authenticating) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={colors.accent} />
        {state === AuthState.Authenticating && (
          <Text className="mt-3 text-[14px] text-content-secondary">Signing in…</Text>
        )}
      </View>
    );
  }

  return <Redirect href="/login" />;
}
