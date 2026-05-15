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

import type { IBiometricAvailability } from '../src/platform/biometric.service';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useAuthService } from '../src/core/core-context';
import { BiometricService } from '../src/platform/biometric.service';

export default function Login() {
  const auth = useAuthService();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometric, setBiometric] = useState<IBiometricAvailability | null>(null);

  useEffect(() => {
    const service = new BiometricService();
    service.getAvailability().then(setBiometric).catch(() => setBiometric(null));
  }, []);

  const onSubmit = async () => {
    if (!auth || busy) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await auth.login({ email: email.trim(), password });
      router.replace('/(tabs)/hosts');
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
      className="flex-1 justify-center bg-black px-6"
    >
      <Stack.Screen options={{ title: 'Sign in' }} />
      <View className="rounded-2xl bg-one-bg p-6">
        <Text className="mb-2 text-[22px] font-semibold text-light-grey">
          Sign in to Termlnk
        </Text>
        <Text className="mb-5 text-[13px] leading-5 text-grey-fg">
          Your master password unlocks the local vault and is never sent in plaintext.
        </Text>

        <Text className="mb-1.5 mt-3 text-[12px] text-grey-fg">Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!busy}
          placeholder="you@example.com"
          placeholderTextColor="#42464e"
          className="rounded-lg bg-one-bg2 px-3 py-2.5 text-[15px] text-light-grey"
        />

        <Text className="mb-1.5 mt-3 text-[12px] text-grey-fg">Master password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          editable={!busy}
          placeholder="••••••••"
          placeholderTextColor="#42464e"
          className="rounded-lg bg-one-bg2 px-3 py-2.5 text-[15px] text-light-grey"
        />

        {error != null && (
          <Text className="mt-3 text-[13px] text-red">{error}</Text>
        )}

        {biometric?.capability === 'available' && (
          <Text className="mt-3 text-[12px] text-blue">
            {biometric.displayName}
            {' '}
            unlock will be available after first sign-in. (v1.1)
          </Text>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={submitDisabled}
          className={`mt-5 items-center rounded-lg py-3 active:opacity-80 ${submitDisabled ? 'bg-one-bg3 opacity-50' : 'bg-blue'}`}
        >
          {busy
            ? <ActivityIndicator color="#1e222a" />
            : <Text className="text-[15px] font-semibold text-black">Sign in</Text>}
        </Pressable>

        <Pressable
          onPress={() => router.push('/register')}
          disabled={busy}
          className="mt-4 items-center"
        >
          <Text className="text-[13px] text-blue">
            Don&apos;t have an account? Create one
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
