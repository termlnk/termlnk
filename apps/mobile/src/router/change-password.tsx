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

import { useRouter } from 'expo-router';
import { Eye, EyeOff, LockKeyhole, ShieldAlert } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthField } from '../components/auth/auth-field';
import { PrimaryButton } from '../components/ui/form';
import { MessageCard } from '../components/ui/message-card';
import { ScreenContainer } from '../components/ui/screen-container';
import { ScreenHeader } from '../components/ui/screen-header';
import { useAuthService } from '../core/core-context';
import { useThemeColors } from '../theme/theme-provider';

const MIN_PASSWORD_LENGTH = 8;

type PasswordHint = 'ok' | 'short' | 'mismatch';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const auth = useAuthService();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hint: PasswordHint = useMemo(() => {
    if (newPassword.length === 0) {
      return 'ok';
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return 'short';
    }
    if (confirm.length > 0 && newPassword !== confirm) {
      return 'mismatch';
    }
    return 'ok';
  }, [newPassword, confirm]);

  const canSubmit = currentPassword.length > 0
    && newPassword.length >= MIN_PASSWORD_LENGTH
    && newPassword === confirm
    && !busy;

  const onSubmit = async () => {
    if (!auth || !canSubmit) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await auth.changePassword(currentPassword, newPassword);
      Alert.alert(
        'Password Changed',
        'Your password has been updated. Other devices have been signed out.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <ScreenHeader variant="nav" title="Change Password" onBack={() => router.back()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: insets.bottom + 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrent}
              textContentType="password"
              editable={!busy}
              placeholder="Enter current password"
              icon={LockKeyhole}
              trailing={(
                <Pressable
                  onPress={() => setShowCurrent((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={showCurrent ? 'Hide current password' : 'Show current password'}
                  hitSlop={10}
                  className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-sunken"
                >
                  {showCurrent
                    ? <EyeOff size={19} color={colors.contentSecondary} />
                    : <Eye size={19} color={colors.contentSecondary} />}
                </Pressable>
              )}
            />

            <View className="mt-3">
              <AuthField
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                textContentType="newPassword"
                editable={!busy}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                icon={LockKeyhole}
                trailing={(
                  <Pressable
                    onPress={() => setShowNew((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={showNew ? 'Hide new password' : 'Show new password'}
                    hitSlop={10}
                    className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-sunken"
                  >
                    {showNew
                      ? <EyeOff size={19} color={colors.contentSecondary} />
                      : <Eye size={19} color={colors.contentSecondary} />}
                  </Pressable>
                )}
              />
            </View>

            <View className="mt-3">
              <AuthField
                label="Confirm new password"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                textContentType="newPassword"
                editable={!busy}
                placeholder="Re-enter new password"
                icon={LockKeyhole}
                trailing={(
                  <Pressable
                    onPress={() => setShowConfirm((prev) => !prev)}
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
              <PrimaryButton title="Change Password" onPress={onSubmit} disabled={!canSubmit} busy={busy} />
            </View>
          </View>

          <View className="mt-4 flex-row items-center rounded-2xl bg-surface-raised px-4 py-3">
            <ShieldAlert size={17} color={colors.contentSecondary} />
            <Text className="ml-2 flex-1 text-[12px] leading-[17px] text-content-secondary">
              Changing your password will sign out all other devices.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
