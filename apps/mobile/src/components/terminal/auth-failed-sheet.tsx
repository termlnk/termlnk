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

import type { IMobileAuthFailedEvent } from '@termlnk/terminal-mobile';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../theme/theme-provider';

interface IAuthFailedSheetProps {
  readonly event: IMobileAuthFailedEvent | null;
  readonly hostLabel?: string;
  readonly onDismiss?: () => void;
}

export function AuthFailedSheet({ event, hostLabel, onDismiss }: IAuthFailedSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [password, setPassword] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  /* eslint-disable react/set-state-in-effect -- reset on new event prop, not a side-effect loop */
  useEffect(() => {
    if (event) {
      setPassword('');
      setAuthenticating(false);
    }
  }, [event]);
  /* eslint-enable react/set-state-in-effect */

  const handleRetry = useCallback(() => {
    if (event && password.length > 0 && !authenticating) {
      setAuthenticating(true);
      event.respond(password);
    }
  }, [event, password, authenticating]);

  const handleCancel = useCallback(() => {
    if (!authenticating) {
      event?.respond(null);
      onDismiss?.();
    }
  }, [event, authenticating, onDismiss]);

  const submitDisabled = password.length === 0 || authenticating;

  return (
    <Modal
      visible={event != null}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          onPress={handleCancel}
          className="flex-1 justify-end bg-black/40"
        >
          <Pressable onPress={() => {}}>
            <View
              className="rounded-t-3xl bg-surface"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <View className="items-center py-3">
                <View className="h-[5px] w-9 rounded-full bg-content-tertiary/30" />
              </View>

              <View className="px-5 pb-5">
                <View className="mb-4 flex-row items-center justify-between">
                  <Text className="text-[17px] font-semibold text-content">
                    {hostLabel ?? event?.host ?? ''}
                  </Text>
                  {!authenticating && (
                    <Pressable onPress={handleCancel}>
                      <Text className="text-[15px] font-medium text-accent">Cancel</Text>
                    </Pressable>
                  )}
                </View>

                <Text className="mb-1 text-center text-[14px] text-content-secondary">
                  {event?.username ?? ''}
                  @
                  {event?.host ?? ''}
                  :
                  {event?.port ?? 22}
                </Text>
                <Text className="mb-4 text-center text-[14px] text-content-secondary">
                  Password:
                </Text>

                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoFocus
                  editable={!authenticating}
                  placeholder="Enter password"
                  placeholderTextColor={colors.contentTertiary}
                  onSubmitEditing={handleRetry}
                  returnKeyType="go"
                  className="mb-4 rounded-xl bg-surface-raised px-4 py-3 text-[15px] text-content"
                />

                <Pressable
                  onPress={handleRetry}
                  disabled={submitDisabled}
                  className={`flex-row items-center justify-center rounded-xl py-3.5 active:opacity-80 ${submitDisabled ? 'bg-surface-raised opacity-50' : 'bg-accent'}`}
                >
                  {authenticating && (
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                  )}
                  <Text className={`text-[15px] font-semibold ${submitDisabled ? 'text-content-tertiary' : 'text-white'}`}>
                    {authenticating ? 'Authenticating…' : 'Connect'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
