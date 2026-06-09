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
import { ShieldCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKnownHostRepository, useObservable } from '../../src/core/core-context';
import { Card } from '../../src/ui/card';
import { EmptyState } from '../../src/ui/empty-state';
import { IconTile } from '../../src/ui/icon-tile';
import { NavRow } from '../../src/ui/rows';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';

export default function KnownHostsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const knownHostRepo = useKnownHostRepository();
  const knownHosts = useObservable(knownHostRepo.knownHosts$, []);

  useEffect(() => {
    void knownHostRepo.ready();
  }, [knownHostRepo]);

  const onDelete = (id: string, label: string) => {
    Alert.alert('Forget host key', `Forget the trusted key for ${label}?`, [
      { text: 'Forget', style: 'destructive', onPress: () => void knownHostRepo.deleteKnownHost(id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScreenContainer>
      <ScreenHeader variant="nav" title="Known Hosts" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {knownHosts.length === 0
          ? (
            <View className="pt-16">
              <EmptyState
                icon={ShieldCheck}
                title="No known hosts"
                description="Server fingerprints you trust on first connect are stored here."
              />
            </View>
          )
          : (
            <Card dividerInset={64}>
              {knownHosts.map((kh) => (
                <NavRow
                  key={kh.id}
                  leading={<IconTile icon={ShieldCheck} tone="known" />}
                  title={`${kh.host}:${kh.port}`}
                  subtitle={`${kh.keyType} · ${kh.fingerprint.slice(0, 24)}…`}
                  showChevron={false}
                  onPress={() => onDelete(kh.id, `${kh.host}:${kh.port}`)}
                />
              ))}
            </Card>
          )}
      </ScrollView>
    </ScreenContainer>
  );
}
