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
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuthService, useAuthState } from '../src/core/core-context';

export default function Index() {
  const authService = useAuthService();
  const state = useAuthState();

  if (!authService) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-6">
        <Stack.Screen options={{ title: 'Termlnk' }} />
        <Text className="mb-3 text-[28px] font-semibold text-light-grey">
          Termlnk
        </Text>
        <Text className="mt-2 text-center text-[14px] leading-5 text-grey-fg">
          Cloud sync is not configured. Set EXPO_PUBLIC_CLOUD_BASE_URL or
          app.json `extra.cloudBaseUrl` to point at a termlnk-server deployment.
        </Text>
      </View>
    );
  }

  if (state === AuthState.Authenticated) {
    return <Redirect href="/(tabs)/hosts" />;
  }

  if (state === AuthState.Authenticating) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#61afef" />
        <Text className="mt-3 text-[14px] text-grey-fg">Signing in…</Text>
      </View>
    );
  }

  return <Redirect href="/login" />;
}
