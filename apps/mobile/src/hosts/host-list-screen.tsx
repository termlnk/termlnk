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

import type { IMobileHost } from '../storage/types';
import { useRouter } from 'expo-router';
import { Search, Server } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import { useSyncService } from '../core/core-context';
import { EmptyState } from '../ui/empty-state';
import { HostRow } from '../ui/host-row';
import { ScreenContainer } from '../ui/screen-container';
import { SectionLabel } from '../ui/section-label';
import { useHostChildren } from './use-host-tree';

interface IHostListScreenProps {
  // 'root' for the Hosts tab landing page; a group id for nested screens.
  readonly parentId: string;
}

type IListRow =
  | { readonly kind: 'section'; readonly key: string; readonly title: string; readonly count: number }
  | { readonly kind: 'item'; readonly key: string; readonly host: IMobileHost };

function matches(host: IMobileHost, query: string): boolean {
  if (query.length === 0) {
    return true;
  }
  const needle = query.toLowerCase();
  if (host.label.toLowerCase().includes(needle)) {
    return true;
  }
  if (host.addr != null && host.addr.toLowerCase().includes(needle)) {
    return true;
  }
  return false;
}

export function HostListScreen({ parentId }: IHostListScreenProps) {
  const router = useRouter();
  const pull = useSyncService();
  const { groups, hosts } = useHostChildren(parentId);

  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await pull.pull();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pull failed');
    } finally {
      setRefreshing(false);
    }
  }, [pull]);

  // Initial pull on root only — group sub-pages re-use the cached snapshot.
  useEffect(() => {
    if (parentId === 'root') {
      void onRefresh();
    }
  }, [parentId, onRefresh]);

  const rows: readonly IListRow[] = useMemo(() => {
    const visibleGroups = groups.filter((g) => matches(g, query));
    const visibleHosts = hosts.filter((h) => matches(h, query));
    const out: IListRow[] = [];
    if (visibleGroups.length > 0) {
      out.push({ kind: 'section', key: 's-groups', title: 'Groups', count: visibleGroups.length });
      for (const g of visibleGroups) {
        out.push({ kind: 'item', key: g.id, host: g });
      }
    }
    if (visibleHosts.length > 0) {
      out.push({ kind: 'section', key: 's-hosts', title: 'Hosts', count: visibleHosts.length });
      for (const h of visibleHosts) {
        out.push({ kind: 'item', key: h.id, host: h });
      }
    }
    return out;
  }, [groups, hosts, query]);

  const onPressItem = useCallback(
    (host: IMobileHost) => {
      if (host.type === 'group') {
        router.push({ pathname: '/group/[id]', params: { id: host.id } });
        return;
      }
      router.push({ pathname: '/host/[id]', params: { id: host.id } });
    },
    [router]
  );

  return (
    <ScreenContainer>
      <View className="border-b border-line bg-black px-4 pb-3 pt-3">
        <View className="flex-row items-center rounded-lg bg-one-bg px-3">
          <Search size={16} color="#565c64" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search hosts"
            placeholderTextColor="#42464e"
            autoCapitalize="none"
            autoCorrect={false}
            className="ml-2 flex-1 py-2 text-[14px] text-light-grey"
          />
        </View>
      </View>

      {error != null && (
        <View className="bg-red/10 px-4 py-2">
          <Text className="text-[12px] text-red">{error}</Text>
        </View>
      )}

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6f737b" />}
        renderItem={({ item }) => {
          if (item.kind === 'section') {
            return <SectionLabel title={item.title} count={item.count} />;
          }
          const host = item.host;
          const subtitle = host.type === 'group'
            ? 'Group'
            : `${host.addr ?? '—'}${host.port != null ? `:${host.port}` : ''}`;
          return (
            <HostRow
              id={host.id}
              label={host.label}
              type={host.type}
              subtitle={subtitle}
              onPress={() => onPressItem(host)}
            />
          );
        }}
        ListEmptyComponent={refreshing
          ? <ActivityIndicator color="#61afef" className="mt-12" />
          : (
            <EmptyState
              icon={Server}
              title={parentId === 'root' ? 'No hosts yet' : 'Empty group'}
              description={parentId === 'root'
                ? 'Pull down to sync your hosts from the desktop vault.'
                : 'This group has no hosts. Add hosts on the desktop and pull again.'}
            />
          )}
      />
    </ScreenContainer>
  );
}
