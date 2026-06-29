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

import type { IMobileHostKeyFirstUseEvent, IMobileHostKeyMismatchEvent } from '@termlnk/terminal-mobile';
import { AlertTriangle, Fingerprint } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticError } from '../../lib/haptics';
import { useThemeColors } from '../../theme/theme-provider';

type HostKeyEvent = IMobileHostKeyFirstUseEvent | IMobileHostKeyMismatchEvent;

interface IHostKeySheetProps {
  readonly event: HostKeyEvent | null;
  readonly hostLabel?: string;
  readonly onDismiss?: () => void;
}

export function HostKeySheet({ event, hostLabel, onDismiss }: IHostKeySheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isMismatch = event?.type === 'host_key_mismatch';
  const [connecting, setConnecting] = useState(false);

  /* eslint-disable react/set-state-in-effect -- reset on new event prop, not a side-effect loop */
  useEffect(() => {
    if (event) {
      setConnecting(false);
    }
  }, [event]);
  /* eslint-enable react/set-state-in-effect */

  useEffect(() => {
    if (isMismatch) {
      hapticError();
    }
  }, [isMismatch]);

  const handleAccept = useCallback(() => {
    if (event && !connecting) {
      setConnecting(true);
      event.respond(true);
    }
  }, [event, connecting]);

  const handleReject = useCallback(() => {
    if (!connecting) {
      event?.respond(false);
      onDismiss?.();
    }
  }, [event, connecting, onDismiss]);

  return (
    <Modal
      visible={event != null}
      transparent
      animationType="slide"
      onRequestClose={handleReject}
    >
      <Pressable
        onPress={handleReject}
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
                {!connecting && (
                  <Pressable onPress={handleReject}>
                    <Text className="text-[15px] font-medium text-accent">Cancel</Text>
                  </Pressable>
                )}
              </View>

              {isMismatch && (
                <View className="mb-4 flex-row items-start rounded-xl border border-danger/30 bg-danger/10 p-3">
                  <AlertTriangle size={18} color={colors.danger} style={{ marginTop: 1, marginRight: 10 }} />
                  <Text className="flex-1 text-[13px] leading-[18px] text-danger">
                    The host key for this server has changed since the last connection. This could indicate a man-in-the-middle attack.
                  </Text>
                </View>
              )}

              {!isMismatch && (
                <Text className="mb-4 text-[14px] leading-[20px] text-content-secondary">
                  {'The authenticity of host '}
                  {event?.host}
                  {' can\'t be established. Continue to proceed with connection and add this host to Known Hosts.'}
                </Text>
              )}

              <View className="mb-4 rounded-xl bg-surface-raised p-4">
                <View className="mb-3 flex-row items-center">
                  <Fingerprint size={16} color={colors.contentSecondary} style={{ marginRight: 8 }} />
                  <Text className="text-[13px] font-medium uppercase tracking-wider text-content-tertiary">
                    {event?.algorithm ?? ''}
                    {' '}
                    Fingerprint
                  </Text>
                </View>
                <Text
                  className="text-[13px] leading-[20px] text-content"
                  style={{ fontFamily: 'Menlo' }}
                  selectable
                >
                  SHA256:
                  {event?.fingerprintSha256 ?? ''}
                </Text>

                {isMismatch && event?.type === 'host_key_mismatch' && (
                  <>
                    <View className="my-3 h-px bg-divider/50" />
                    <Text className="mb-1 text-[12px] font-medium text-content-tertiary">
                      Previously stored fingerprint
                    </Text>
                    <Text
                      className="text-[13px] leading-[20px] text-content-secondary"
                      style={{ fontFamily: 'Menlo' }}
                      selectable
                    >
                      SHA256:
                      {event.storedFingerprint}
                    </Text>
                  </>
                )}
              </View>

              <Pressable
                onPress={handleAccept}
                disabled={connecting}
                className={`flex-row items-center justify-center rounded-xl py-3.5 active:opacity-80 ${connecting ? 'opacity-50' : ''} ${isMismatch ? 'bg-danger' : 'bg-accent'}`}
              >
                {connecting && (
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                )}
                <Text className="text-[15px] font-semibold text-white">
                  {connecting
                    ? 'Connecting…'
                    : isMismatch ? 'Replace and Continue' : 'Continue'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
