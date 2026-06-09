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

import type { IBiometricAvailability } from '@termlnk/auth-mobile';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useAuthService, useBiometricService } from '../src/core/core-context';
import { useThemeColors } from '../src/theme/theme-provider';
import { PrimaryButton } from '../src/ui/form';

export default function Login() {
  const auth = useAuthService();
  const router = useRouter();
  const bio = useBiometricService();
  const colors = useThemeColors();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometric, setBiometric] = useState<IBiometricAvailability | null>(null);

  useEffect(() => {
    bio.getAvailability().then(setBiometric).catch(() => setBiometric(null));
  }, [bio]);

  const onSubmit = async () => {
    if (!auth || busy) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await auth.login({ email: email.trim(), password });
      router.replace('/(tabs)/vaults');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const submitDisabled = busy || email.length === 0 || password.length === 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 justify-center bg-surface px-6"
    >
      <Stack.Screen options={{ title: 'Sign in' }} />
      <View className="rounded-2xl bg-surface-raised p-6">
        <Text className="mb-2 text-[22px] font-semibold text-content">
          Sign in to Termlnk
        </Text>
        <Text className="mb-5 text-[13px] leading-5 text-content-secondary">
          Your master password unlocks the local vault and is never sent in plaintext.
        </Text>

        <Text className="mb-1.5 mt-3 text-[12px] text-content-secondary">Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!busy}
          placeholder="you@example.com"
          placeholderTextColor={colors.contentTertiary}
          className="rounded-xl border border-divider bg-field px-3 py-3 text-[16px] text-content"
        />

        <Text className="mb-1.5 mt-3 text-[12px] text-content-secondary">Master password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          editable={!busy}
          placeholder="••••••••"
          placeholderTextColor={colors.contentTertiary}
          className="rounded-xl border border-divider bg-field px-3 py-3 text-[16px] text-content"
        />

        {error != null && (
          <Text className="mt-3 text-[13px] text-danger">{error}</Text>
        )}

        {biometric?.capability === 'available' && (
          <Text className="mt-3 text-[12px] text-accent">
            {biometric.displayName}
            {' '}
            unlock will be available after first sign-in.
          </Text>
        )}

        <View className="mt-5">
          <PrimaryButton title="Sign in" onPress={onSubmit} disabled={submitDisabled} busy={busy} />
        </View>

        <Pressable
          onPress={() => router.push('/register')}
          disabled={busy}
          className="mt-4 items-center"
        >
          <Text className="text-[13px] text-accent">
            Don&apos;t have an account? Create one
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
