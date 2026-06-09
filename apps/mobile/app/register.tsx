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

import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useAuthService } from '../src/core/core-context';
import { useThemeColors } from '../src/theme/theme-provider';
import { PrimaryButton } from '../src/ui/form';

const MIN_PASSWORD_LENGTH = 8;

type PasswordHint = 'ok' | 'short' | 'mismatch';

export default function Register() {
  const auth = useAuthService();
  const router = useRouter();
  const colors = useThemeColors();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hint: PasswordHint = useMemo(() => {
    if (password.length === 0) {
      return 'ok';
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return 'short';
    }
    if (confirm.length > 0 && password !== confirm) {
      return 'mismatch';
    }
    return 'ok';
  }, [password, confirm]);

  const canSubmit = email.trim().length > 0
    && password.length >= MIN_PASSWORD_LENGTH
    && password === confirm
    && !busy;

  const onSubmit = async () => {
    if (!auth || !canSubmit) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const trimmedDisplayName = displayName.trim();
      await auth.register({
        email: email.trim(),
        password,
        displayName: trimmedDisplayName.length > 0 ? trimmedDisplayName : undefined,
      });
      router.replace('/(tabs)/vaults');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'rounded-xl border border-divider bg-field px-3 py-3 text-[16px] text-content';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-surface"
    >
      <Stack.Screen options={{ title: 'Sign up' }} />
      <ScrollView
        contentContainerClassName="grow justify-center p-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="rounded-2xl bg-surface-raised p-6">
          <Text className="mb-2 text-[22px] font-semibold text-content">
            Create your Termlnk account
          </Text>
          <Text className="mb-5 text-[13px] leading-[18px] text-content-secondary">
            Your master password locks the local vault. It is never sent in plaintext
            and cannot be recovered — losing it means losing your data.
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
            className={inputClass}
          />

          <Text className="mb-1.5 mt-3 text-[12px] text-content-secondary">
            Display name (optional)
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!busy}
            placeholder="How should we address you?"
            placeholderTextColor={colors.contentTertiary}
            className={inputClass}
          />

          <Text className="mb-1.5 mt-3 text-[12px] text-content-secondary">Master password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            editable={!busy}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            placeholderTextColor={colors.contentTertiary}
            className={inputClass}
          />

          <Text className="mb-1.5 mt-3 text-[12px] text-content-secondary">
            Confirm master password
          </Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            editable={!busy}
            placeholder="Re-enter your master password"
            placeholderTextColor={colors.contentTertiary}
            className={inputClass}
          />

          {hint === 'short' && (
            <Text className="mt-2.5 text-[12px] text-danger">
              Use at least
              {' '}
              {MIN_PASSWORD_LENGTH}
              {' '}
              characters. A passphrase of 4+ words works best.
            </Text>
          )}
          {hint === 'mismatch' && (
            <Text className="mt-2.5 text-[12px] text-danger">
              Passwords do not match yet.
            </Text>
          )}
          {error != null && (
            <Text className="mt-3 text-[13px] text-danger">{error}</Text>
          )}

          <View className="mt-5">
            <PrimaryButton title="Sign up" onPress={onSubmit} disabled={!canSubmit} busy={busy} />
          </View>

          <Pressable
            onPress={() => router.replace('/login')}
            disabled={busy}
            className="mt-4 items-center"
          >
            <Text className="text-[13px] text-accent">
              Already have an account? Sign in
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
