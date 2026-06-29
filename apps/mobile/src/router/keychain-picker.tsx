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

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, KeyRound, UserRound } from 'lucide-react-native';
import { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/ui/card';
import { IconTile } from '../components/ui/icon-tile';
import { NavRow } from '../components/ui/rows';
import { useIdentityRepository, useObservable, useSshKeyRepository } from '../core/core-context';
import { setPendingKeychainSelection } from '../lib/keychain-selection';
import { useThemeColors } from '../theme/theme-provider';

export default function KeychainPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ type: string; selectedId?: string; sourceRoute?: string }>();
  const pickerType = params.type === 'identity' ? 'identity' : 'key';
  const selectedId = params.selectedId ?? '';
  const sourceRoute = params.sourceRoute ?? 'host-edit';

  const keyRepo = useSshKeyRepository();
  const identityRepo = useIdentityRepository();
  const keys = useObservable(keyRepo.keys$, []);
  const identities = useObservable(identityRepo.identities$, []);

  useEffect(() => {
    if (pickerType === 'key') {
      void keyRepo.ready();
    } else {
      void identityRepo.ready();
    }
  }, [pickerType, keyRepo, identityRepo]);

  const title = pickerType === 'key' ? 'Select Key' : 'Select Identity';
  const items = pickerType === 'key' ? keys : identities;

  const onSelect = (id: string, label: string) => {
    setPendingKeychainSelection({ type: pickerType, id, label, sourceRoute });
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 96, paddingBottom: insets.bottom + 32 }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        {items.length === 0
          ? (
            <Text className="mt-4 px-2 text-center text-[14px] text-content-secondary">
              {pickerType === 'key'
                ? 'No keys yet. Add one in Keychain first.'
                : 'No identities yet. Add one in Keychain first.'}
            </Text>
          )
          : (
            <Card dividerInset={64}>
              {pickerType === 'key'
                ? keys.map((k) => (
                  <NavRow
                    key={k.id}
                    leading={<IconTile icon={KeyRound} tone="keychain" />}
                    title={k.label}
                    subtitle={`${k.algorithm.toUpperCase()}${k.bits ? ` ${k.bits}` : ''}${k.source === 'generated' ? ' · generated' : ''}`}
                    showChevron={false}
                    onPress={() => onSelect(k.id, k.label)}
                    trailing={selectedId === k.id ? <Check size={20} color={colors.accent} /> : undefined}
                  />
                ))
                : identities.map((idn) => (
                  <NavRow
                    key={idn.id}
                    leading={<IconTile icon={UserRound} tone="sessions" />}
                    title={idn.label}
                    subtitle={idn.username + (idn.keyId ? ' · key' : idn.hasPassword ? ' · password' : '')}
                    showChevron={false}
                    onPress={() => onSelect(idn.id, idn.label)}
                    trailing={selectedId === idn.id ? <Check size={20} color={colors.accent} /> : undefined}
                  />
                ))}
            </Card>
          )}
      </ScrollView>
    </>
  );
}
