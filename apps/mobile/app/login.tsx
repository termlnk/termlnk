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
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Eye, EyeOff, Fingerprint, LockKeyhole, Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthService, useBiometricService, useSyncService } from '../src/core/core-context';
import { useThemeColors } from '../src/theme/theme-provider';
import { cn } from '../src/ui/cn';
import { PrimaryButton } from '../src/ui/form';
const appIcon = require('../assets/icon.png');

interface ILoginFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly icon: LucideIcon;
  readonly editable: boolean;
  readonly secureTextEntry?: boolean;
  readonly trailing?: ReactNode;
  readonly keyboardType?: 'default' | 'email-address';
  readonly textContentType?: 'emailAddress' | 'password';
}

export default function Login() {
  const auth = useAuthService();
  const router = useRouter();
  const bio = useBiometricService();
  const syncService = useSyncService();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      void syncService.pull().catch(() => {});
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
      className="flex-1 bg-surface"
    >
      <Stack.Screen options={{ title: 'Sign in' }} />
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
              Welcome back
            </Text>
            <Text className="mt-2 text-center text-[15px] leading-5 text-content-secondary">
              Sign in to continue.
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
            <LoginField
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
              <LoginField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="password"
                editable={!busy}
                placeholder="Password"
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

            {error != null && (
              <View className="mt-4 rounded-2xl bg-surface-sunken px-4 py-3">
                <Text className="text-[13px] leading-[18px] text-danger">{error}</Text>
              </View>
            )}

            {biometric?.capability === 'available' && (
              <View className="mt-4 flex-row items-center rounded-2xl bg-surface-sunken px-4 py-3">
                <Fingerprint size={17} color={colors.accent} />
                <Text className="ml-2 flex-1 text-[12px] leading-[17px] text-content-secondary">
                  {biometric.displayName}
                  {' '}
                  unlock will be available after sign-in.
                </Text>
              </View>
            )}

            <View className="mt-5">
              <PrimaryButton title="Sign in" onPress={onSubmit} disabled={submitDisabled} busy={busy} />
            </View>

            <Pressable
              onPress={() => router.push('/register')}
              disabled={busy}
              className={cn('mt-4 items-center py-2 active:opacity-60', { 'opacity-40': busy })}
            >
              <Text className="text-[14px] font-semibold text-accent">
                Don&apos;t have an account? Create one
              </Text>
            </Pressable>
          </View>

          <Text className="mt-5 text-center text-[12px] leading-[18px] text-content-tertiary">
            Your encrypted vault stays protected on this device.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LoginField(props: ILoginFieldProps) {
  const colors = useThemeColors();
  const Icon = props.icon;
  return (
    <View className="rounded-2xl border border-divider bg-field px-4 py-3.5">
      <View className="mb-2 flex-row items-center">
        <Icon size={17} color={colors.contentSecondary} />
        <Text className="ml-2 text-[13px] font-semibold text-content-secondary">
          {props.label}
        </Text>
      </View>
      <View className="flex-row items-center">
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={props.keyboardType}
          textContentType={props.textContentType}
          editable={props.editable}
          secureTextEntry={props.secureTextEntry}
          placeholder={props.placeholder}
          placeholderTextColor={colors.contentTertiary}
          className="min-h-[28px] flex-1 p-0 text-[17px] font-medium text-content"
        />
        {props.trailing != null && <View className="ml-2">{props.trailing}</View>}
      </View>
    </View>
  );
}
