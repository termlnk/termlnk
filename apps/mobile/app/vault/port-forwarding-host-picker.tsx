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

import { Stack, useRouter } from 'expo-router';
import { Monitor } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHostRepository, useObservable } from '../../src/core/core-context';
import { setPendingHostSelection } from '../../src/hosts/host-selection';
import { Card } from '../../src/ui/card';
import { IconTile } from '../../src/ui/icon-tile';
import { NavRow } from '../../src/ui/rows';

export default function PortForwardingHostPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hostRepo = useHostRepository();
  const hosts = useObservable(hostRepo.hosts$, []);

  useEffect(() => {
    void hostRepo.ready();
  }, [hostRepo]);

  const hostNodes = useMemo(() => {
    return hosts.filter((h) => h.type === 'host');
  }, [hosts]);

  const onSelect = (hostId: string, label: string) => {
    setPendingHostSelection({ hostId, label });
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Select Host' }} />
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 96, paddingBottom: insets.bottom + 32 }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        {hostNodes.length === 0
          ? (
            <Text className="mt-4 px-2 text-center text-[14px] text-content-secondary">
              No hosts yet. Add a host first to use port forwarding.
            </Text>
          )
          : (
            <Card dividerInset={64}>
              {hostNodes.map((h) => (
                <NavRow
                  key={h.id}
                  leading={<IconTile icon={Monitor} tone="host" />}
                  title={h.label}
                  subtitle={h.addr ? `${h.addr}${h.port ? `:${h.port}` : ''}` : undefined}
                  onPress={() => onSelect(h.id, h.label)}
                />
              ))}
            </Card>
          )}
      </ScrollView>
    </>
  );
}
