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
import { Monitor } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHostRepository, useObservable } from '../../src/core/core-context';
import { setPendingHostSelection } from '../../src/hosts/host-selection';
import { Card } from '../../src/ui/card';
import { EmptyState } from '../../src/ui/empty-state';
import { IconTile } from '../../src/ui/icon-tile';
import { NavRow } from '../../src/ui/rows';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';
import { SearchField } from '../../src/ui/search-field';

export default function PortForwardingHostPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hostRepo = useHostRepository();
  const hosts = useObservable(hostRepo.hosts$, []);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void hostRepo.ready();
  }, [hostRepo]);

  const hostNodes = useMemo(() => {
    return hosts.filter((h) => h.type === 'host');
  }, [hosts]);

  const filtered = useMemo(() => {
    if (!search.trim()) {
      return hostNodes;
    }
    const q = search.toLowerCase();
    return hostNodes.filter((h) =>
      h.label.toLowerCase().includes(q)
      || (h.addr ?? '').toLowerCase().includes(q)
    );
  }, [hostNodes, search]);

  const onSelect = (hostId: string, label: string) => {
    setPendingHostSelection({ hostId, label });
    router.back();
  };

  return (
    <ScreenContainer>
      <ScreenHeader variant="nav" title="Select Host" onBack={() => router.back()} />
      <SearchField value={search} onChangeText={setSearch} placeholder="Search hosts..." />
      {filtered.length === 0
        ? (
          <View className="flex-1 justify-center">
            <EmptyState
              icon={Monitor}
              title="No hosts"
              description={search ? `No hosts match "${search}"` : 'Add a host first to use port forwarding.'}
            />
          </View>
        )
        : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
            <Card dividerInset={64}>
              {filtered.map((h) => (
                <NavRow
                  key={h.id}
                  leading={<IconTile icon={Monitor} tone="host" />}
                  title={h.label}
                  subtitle={h.addr ? `${h.addr}${h.port ? `:${h.port}` : ''}` : undefined}
                  onPress={() => onSelect(h.id, h.label)}
                />
              ))}
            </Card>
          </ScrollView>
        )}
    </ScreenContainer>
  );
}
