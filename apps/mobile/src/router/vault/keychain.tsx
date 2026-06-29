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
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { IconTile } from '../../components/ui/icon-tile';
import { PillTabBar } from '../../components/ui/pill-tab-bar';
import { RoundButton } from '../../components/ui/round-button';
import { NavRow } from '../../components/ui/rows';
import { ScreenContainer } from '../../components/ui/screen-container';
import { ScreenHeader } from '../../components/ui/screen-header';
import { useIdentityRepository, useObservable, useSshKeyRepository } from '../../core/core-context';

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
              { id: 'identity', title: 'New Identity', image: 'person.fill' },
              { id: 'new-key', title: 'New Key', image: 'key.fill' },
              { id: 'generate-key', title: 'Generate Key', image: 'wand.and.stars' },
            ]}
            onPressAction={({ nativeEvent }) => {
              if (nativeEvent.event === 'identity') {
                router.push('/keychain/identity');
              } else if (nativeEvent.event === 'new-key') {
                router.push('/keychain/new-key');
              } else if (nativeEvent.event === 'generate-key') {
                router.push('/keychain/generate-key');
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
              ? <EmptyState title="No keys yet" description="Tap + to generate or import one." />
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
              ? <EmptyState title="No identities yet" description="Tap + to add a reusable username + secret." />
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
