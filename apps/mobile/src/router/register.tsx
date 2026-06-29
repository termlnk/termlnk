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
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthField } from '../components/auth/auth-field';
import { PrimaryButton } from '../components/ui/form';
import { MessageCard } from '../components/ui/message-card';
import { useAuthService } from '../core/core-context';
import { cn } from '../lib/cn';
import { useThemeColors } from '../theme/theme-provider';

const appIcon = require('../../assets/icon.png');

const MIN_PASSWORD_LENGTH = 8;

type PasswordHint = 'ok' | 'short' | 'mismatch';

export default function Register() {
  const auth = useAuthService();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-surface"
    >
      <Stack.Screen options={{ title: 'Sign up' }} />
      <ScrollView
        contentContainerClassName="grow"
        contentContainerStyle={{
          paddingTop: 10,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center py-6">
          <View className="mb-7 items-center">
            <Image source={appIcon} className="h-[76px] w-[76px] rounded-2xl" />
            <Text className="mt-5 text-center text-[30px] font-bold leading-[34px] text-content">
              Create account
            </Text>
            <Text className="mt-2 text-center text-[15px] leading-5 text-content-secondary">
              Protect your local vault.
            </Text>
          </View>

          <View
            className="rounded-[24px] bg-surface-raised p-5"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 3,
            }}
          >
            <AuthField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!busy}
              placeholder="you@example.com"
              icon={Mail}
            />

            <View className="mt-3">
              <AuthField
                label="Display name"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                textContentType="name"
                editable={!busy}
                placeholder="Optional"
                icon={UserRound}
              />
            </View>

            <View className="mt-3">
              <AuthField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                editable={!busy}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                icon={LockKeyhole}
                trailing={(
                  <Pressable
                    onPress={() => setShowPassword((next) => !next)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    hitSlop={10}
                    className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-sunken"
                  >
                    {showPassword
                      ? <EyeOff size={19} color={colors.contentSecondary} />
                      : <Eye size={19} color={colors.contentSecondary} />}
                  </Pressable>
                )}
              />
            </View>

            <View className="mt-3">
              <AuthField
                label="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                textContentType="newPassword"
                editable={!busy}
                placeholder="Re-enter your password"
                icon={LockKeyhole}
                trailing={(
                  <Pressable
                    onPress={() => setShowConfirm((next) => !next)}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                    hitSlop={10}
                    className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-sunken"
                  >
                    {showConfirm
                      ? <EyeOff size={19} color={colors.contentSecondary} />
                      : <Eye size={19} color={colors.contentSecondary} />}
                  </Pressable>
                )}
              />
            </View>

            {hint !== 'ok' && (
              <MessageCard
                message={hint === 'short'
                  ? `Use at least ${MIN_PASSWORD_LENGTH} characters. A passphrase of 4+ words works best.`
                  : 'Passwords do not match yet.'}
                tone="error"
                className="mt-4 bg-surface-sunken"
              />
            )}
            {error != null && (
              <MessageCard message={error} tone="error" className="mt-4 bg-surface-sunken" />
            )}

            <View className="mt-5">
              <PrimaryButton title="Sign up" onPress={onSubmit} disabled={!canSubmit} busy={busy} />
            </View>

            <Pressable
              onPress={() => router.replace('/login')}
              disabled={busy}
              className={cn('mt-4 items-center py-2 active:opacity-60', { 'opacity-40': busy })}
            >
              <Text className="text-[14px] font-semibold text-accent">
                Already have an account? Sign in
              </Text>
            </Pressable>
          </View>

          <Text className="mt-5 text-center text-[12px] leading-[18px] text-content-tertiary">
            Your master password cannot be recovered if it is lost.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
