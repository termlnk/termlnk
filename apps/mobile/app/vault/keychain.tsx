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

import { MenuView } from '@react-native-menu/menu';
import { useRouter } from 'expo-router';
import { KeyRound, Plus, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIdentityRepository, useObservable, useSshKeyRepository } from '../../src/core/core-context';
import { Card } from '../../src/ui/card';
import { IconTile } from '../../src/ui/icon-tile';
import { PillTabBar } from '../../src/ui/pill-tab-bar';
import { RoundButton } from '../../src/ui/round-button';
import { NavRow } from '../../src/ui/rows';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';

type KeychainTab = 'keys' | 'identities';

const TABS = [
  { label: 'SSH Keys', value: 'keys' as const },
  { label: 'Identities', value: 'identities' as const },
] as const;

export default function KeychainScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyRepo = useSshKeyRepository();
  const identityRepo = useIdentityRepository();

  const keys = useObservable(keyRepo.keys$, []);
  const identities = useObservable(identityRepo.identities$, []);

  const [tab, setTab] = useState<KeychainTab>('keys');

  useEffect(() => {
    void keyRepo.ready();
    void identityRepo.ready();
  }, [keyRepo, identityRepo]);

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="nav"
        title="Keychain"
        onBack={() => router.back()}
        right={(
          <MenuView
            actions={[
              { id: 'ssh-key', title: 'SSH Key', image: 'key.fill' },
              { id: 'identity', title: 'Identity', image: 'person.fill' },
            ]}
            onPressAction={({ nativeEvent }) => {
              if (nativeEvent.event === 'ssh-key') {
                router.push('/keychain/key');
              } else if (nativeEvent.event === 'identity') {
                router.push('/keychain/identity');
              }
            }}
          >
            <RoundButton icon={Plus} onPress={() => {}} accessibilityLabel="Add to keychain" />
          </MenuView>
        )}
      />

      <PillTabBar tabs={TABS} value={tab} onChange={setTab} className="mx-4 mt-4" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {tab === 'keys' && (
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
        )}

        {tab === 'identities' && (
          <Card dividerInset={64}>
            {identities.length === 0
              ? <EmptyRow text="No identities yet. Tap + to add a reusable username + secret." />
              : identities.map((idn) => (
                <NavRow
                  key={idn.id}
                  leading={<IconTile icon={UserRound} tone="sessions" />}
                  title={idn.label}
                  subtitle={`${idn.username}${idn.keyId ? ' · key' : idn.hasPassword ? ' · password' : ''}`}
                  onPress={() => router.push({ pathname: '/keychain/identity', params: { id: idn.id } })}
                />
              ))}
          </Card>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <View className="px-4 py-4">
      <Text className="text-[14px] text-content-secondary">{text}</Text>
    </View>
  );
}
