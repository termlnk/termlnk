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
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuthService, useAuthState } from '../src/core/core-context';

export default function Index() {
  const authService = useAuthService();
  const state = useAuthState();

  if (!authService) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Termlnk' }} />
        <Text style={styles.title}>Termlnk</Text>
        <Text style={styles.message}>
          Cloud sync is not configured. Set EXPO_PUBLIC_CLOUD_BASE_URL or app.json
          `extra.cloudBaseUrl` to point at a termlnk-server deployment.
        </Text>
      </View>
    );
  }

  if (state === AuthState.Authenticated) {
    return <Redirect href="/hosts" />;
  }

  if (state === AuthState.Authenticating) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3b82f6" />
        <Text style={styles.message}>Signing in…</Text>
      </View>
    );
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0a0a0a' },
  title: { color: '#e5e7eb', fontSize: 28, fontWeight: '600', marginBottom: 12 },
  message: { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginTop: 12 },
});
