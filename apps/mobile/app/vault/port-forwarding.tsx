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

import type { IPortForwardingRuleEntity } from '@termlnk/database-mobile';
import { useRouter } from 'expo-router';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Globe, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHostRepository, useObservable, usePortForwardingService, useSyncService } from '../../src/core/core-context';
import { Card } from '../../src/ui/card';
import { EmptyState } from '../../src/ui/empty-state';
import { IconTile } from '../../src/ui/icon-tile';
import { RoundButton } from '../../src/ui/round-button';
import { NavRow } from '../../src/ui/rows';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';
import { SearchField } from '../../src/ui/search-field';

function typeIcon(type: string) {
  switch (type) {
    case 'local': return ArrowDownToLine;
    case 'remote': return ArrowUpFromLine;
    case 'dynamic': return Globe;
    default: return ArrowLeftRight;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'local': return 'Local';
    case 'remote': return 'Remote';
    case 'dynamic': return 'Dynamic';
    default: return type;
  }
}

function ruleTitle(rule: IPortForwardingRuleEntity): string {
  if (rule.label) {
    return rule.label;
  }
  if (rule.type === 'dynamic') {
    return `${rule.bindAddress}:${rule.bindPort}`;
  }
  return `${rule.bindPort} → ${rule.destinationAddress ?? '?'}:${rule.destinationPort ?? '?'}`;
}

export default function PortForwardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pfService = usePortForwardingService();
  const syncService = useSyncService();
  const hostRepo = useHostRepository();

  const rules = useObservable(pfService.rules$, []);
  const hosts = useObservable(hostRepo.hosts$, []);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void hostRepo.ready();
  }, [hostRepo]);

  const hostMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of hosts) {
      map.set(h.id, h.label);
    }
    return map;
  }, [hosts]);

  const filtered = useMemo(() => {
    if (!search.trim()) {
      return rules;
    }
    const q = search.toLowerCase();
    return rules.filter((r) =>
      ruleTitle(r).toLowerCase().includes(q)
      || (hostMap.get(r.hostId) ?? '').toLowerCase().includes(q)
      || typeLabel(r.type).toLowerCase().includes(q)
    );
  }, [rules, search, hostMap]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncService.pull();
    } finally {
      setRefreshing(false);
    }
  }, [syncService]);

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="nav"
        title="Port Forwarding"
        onBack={() => router.back()}
        right={<RoundButton icon={Plus} onPress={() => router.push('/vault/port-forwarding-edit')} accessibilityLabel="Add rule" />}
      />
      <SearchField value={search} onChangeText={setSearch} placeholder="Search rules..." />
      {filtered.length === 0 && !search
        ? (
          <View className="flex-1 justify-center">
            <EmptyState
              icon={ArrowLeftRight}
              title="Set up Port Forwarding"
              description="Save port forwarding to access databases, web apps, and other services."
            />
          </View>
        )
        : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <Card dividerInset={64}>
              {filtered.map((rule) => (
                <NavRow
                  key={rule.id}
                  leading={<IconTile icon={typeIcon(rule.type)} tone="portfwd" />}
                  title={ruleTitle(rule)}
                  subtitle={`${typeLabel(rule.type)} · ${hostMap.get(rule.hostId) ?? 'Unknown host'}`}
                  onPress={() => router.push({ pathname: '/vault/port-forwarding-edit', params: { id: rule.id } })}
                />
              ))}
            </Card>
            {filtered.length === 0 && search && (
              <View className="items-center py-8">
                <Text className="text-[14px] text-content-tertiary">No rules match "{search}"</Text>
              </View>
            )}
          </ScrollView>
        )}
    </ScreenContainer>
  );
}
