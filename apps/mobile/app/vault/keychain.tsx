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
import { KeyRound, Plus, UserRound } from 'lucide-react-native';
import { useEffect } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIdentityRepository, useObservable, useSshKeyRepository } from '../../src/core/core-context';
import { Card } from '../../src/ui/card';
import { IconTile } from '../../src/ui/icon-tile';
import { RoundButton } from '../../src/ui/round-button';
import { NavRow } from '../../src/ui/rows';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';

export default function KeychainScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyRepo = useSshKeyRepository();
  const identityRepo = useIdentityRepository();

  const keys = useObservable(keyRepo.keys$, []);
  const identities = useObservable(identityRepo.identities$, []);

  useEffect(() => {
    void keyRepo.ready();
    void identityRepo.ready();
  }, [keyRepo, identityRepo]);

  const onAdd = () => {
    Alert.alert('New', undefined, [
      { text: 'SSH key', onPress: () => router.push('/keychain/key') },
      { text: 'Identity', onPress: () => router.push('/keychain/identity') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="nav"
        title="Keychain"
        onBack={() => router.back()}
        right={<RoundButton icon={Plus} onPress={onAdd} accessibilityLabel="Add to keychain" />}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        <SectionTitle title="SSH Keys" count={keys.length} />
        <Card dividerInset={64}>
          {keys.length === 0
            ? <EmptyRow text="No keys yet. Tap + to generate or import one." />
            : keys.map((k) => (
              <NavRow
                key={k.id}
                leading={<IconTile icon={KeyRound} tone="keychain" />}
                title={k.label}
                subtitle={`${k.algorithm.toUpperCase()}${k.bits ? ` ${k.bits}` : ''}${k.source === 'generated' ? ' · generated' : ''}`}
                onPress={() => router.push({ pathname: '/keychain/key', params: { id: k.id } })}
              />
            ))}
        </Card>

        <SectionTitle title="Identities" count={identities.length} />
        <Card dividerInset={64}>
          {identities.length === 0
            ? <EmptyRow text="No identities yet. Tap + to add a reusable username + secret." />
            : identities.map((idn) => (
              <NavRow
                key={idn.id}
                leading={<IconTile icon={UserRound} tone="sessions" />}
                title={idn.label}
                subtitle={idn.username + (idn.keyId ? ' · key' : idn.hasPassword ? ' · password' : '')}
                onPress={() => router.push({ pathname: '/keychain/identity', params: { id: idn.id } })}
              />
            ))}
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <View className="flex-row items-baseline px-1 pb-2 pt-4">
      <Text className="text-[12px] font-semibold uppercase tracking-wider text-content-tertiary">{title}</Text>
      <Text className="ml-2 text-[12px] text-content-tertiary">{count}</Text>
    </View>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <View className="px-4 py-4">
      <Text className="text-[14px] text-content-secondary">{text}</Text>
    </View>
  );
}
