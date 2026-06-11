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

import type { IMobileHost } from '@termlnk/database-mobile';
import type { IHostConnectionState } from '@termlnk/terminal-mobile';
import type { IMenuItem } from '../ui/menu-types';
import { MenuView } from '@react-native-menu/menu';
import { generateRandomId } from '@termlnk/core';
import { useFocusEffect, useRouter } from 'expo-router';
import { Copy, FolderInput, FolderOpen, Pencil, Plug, Plus, Server, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectionService, useHostRepository, useObservable, useSyncService } from '../core/core-context';
import { useThemeColors } from '../theme/theme-provider';
import { Card } from '../ui/card';
import { CreateHostEmptyState } from '../ui/create-host-empty-state';
import { EmptyState } from '../ui/empty-state';
import { HostRow } from '../ui/host-row';
import { RoundButton } from '../ui/round-button';
import { ScreenContainer } from '../ui/screen-container';
import { ScreenHeader } from '../ui/screen-header';
import { SearchField } from '../ui/search-field';
import { takePendingGroupSelection } from './group-selection';
import { useHostChildren } from './use-host-tree';

interface IHostListScreenProps {
  // 'root' for the Hosts landing page; a group id for nested screens.
  readonly parentId: string;
}

const EMPTY_CONNECTIONS: ReadonlyMap<string, IHostConnectionState> = new Map();

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

function hostSubtitle(host: IMobileHost): string {
  if (host.type === 'group') {
    return 'Group';
  }
  return `${host.addr ?? '—'}${host.port != null ? `:${host.port}` : ''}`;
}

export function HostListScreen({ parentId }: IHostListScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const pull = useSyncService();
  const hostRepo = useHostRepository();
  const connectionService = useConnectionService();
  const { groups, hosts } = useHostChildren(parentId);
  const allHosts = useObservable(hostRepo.hosts$, []);
  const connections = useObservable(connectionService.connections$, EMPTY_CONNECTIONS);

  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Records which host a "Move to group" flow is acting on so the group-picker hand-off
  // (consumed on focus return) knows what to reparent.
  const movingHostIdRef = useRef<string | null>(null);

  const isRoot = parentId === 'root';
  const self = isRoot ? null : allHosts.find((h) => h.id === parentId) ?? null;
  const title = isRoot ? 'Hosts' : self?.label ?? 'Group';
  const subtitle = isRoot ? 'Personal' : undefined;

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
    if (isRoot) {
      void onRefresh();
    }
  }, [isRoot, onRefresh]);

  // Apply a Parent Group chosen on the picker screen to the host being moved.
  useFocusEffect(
    useCallback(() => {
      const selection = takePendingGroupSelection();
      const movingId = movingHostIdRef.current;
      if (selection == null || movingId == null) {
        return;
      }
      movingHostIdRef.current = null;
      void (async () => {
        try {
          const full = await hostRepo.getInfo(movingId);
          if (full == null) {
            return;
          }
          await hostRepo.saveHost({ ...full, pid: selection.pid }, { isNew: false });
        } catch (err) {
          Alert.alert('Move failed', String(err));
        }
      })();
    }, [hostRepo])
  );

  const onNewHost = useCallback(() => {
    router.push({ pathname: '/host/edit', params: { pid: parentId, kind: 'host' } });
  }, [router, parentId]);

  const onNewGroup = useCallback(() => {
    router.push({ pathname: '/host/edit', params: { pid: parentId, kind: 'group' } });
  }, [router, parentId]);

  // Open the SSH transport (drives the row's connecting animation via connections$), then
  // navigate to the screen, which attaches to the live session — connect() is idempotent.
  const onConnect = useCallback(async (host: IMobileHost, intent: 'terminal' | 'sftp') => {
    await connectionService.connect(host.id);
    if (intent === 'sftp') {
      router.push({ pathname: '/host/[id]/sftp', params: { id: host.id } });
    } else {
      router.push({ pathname: '/host/[id]/terminal', params: { id: host.id } });
    }
  }, [connectionService, router]);

  const onPressItem = useCallback((host: IMobileHost) => {
    if (host.type === 'group') {
      router.push({ pathname: '/group/[id]', params: { id: host.id } });
      return;
    }
    void onConnect(host, 'terminal');
  }, [router, onConnect]);

  const onEdit = useCallback((host: IMobileHost) => {
    router.push({ pathname: '/host/edit', params: { id: host.id, kind: host.type === 'group' ? 'group' : 'host' } });
  }, [router]);

  const onDelete = useCallback((host: IMobileHost) => {
    Alert.alert('Delete', `Delete "${host.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void hostRepo.removeHost(host.id) },
    ]);
  }, [hostRepo]);

  const onDuplicate = useCallback(async (host: IMobileHost) => {
    try {
      const full = await hostRepo.getInfo(host.id);
      if (full == null) {
        return;
      }
      await hostRepo.saveHost({ ...full, id: generateRandomId(24), label: `${full.label} copy` }, { isNew: true });
    } catch (err) {
      Alert.alert('Duplicate failed', String(err));
    }
  }, [hostRepo]);

  const onMoveToGroup = useCallback((host: IMobileHost) => {
    movingHostIdRef.current = host.id;
    router.push({ pathname: '/group-picker', params: { selectedPid: host.pid } });
  }, [router]);

  const getMenuItems = useCallback((host: IMobileHost): IMenuItem[] => {
    if (host.type === 'group') {
      return [
        { key: 'edit', label: 'Edit', icon: Pencil, sfSymbol: 'pencil', onPress: () => onEdit(host) },
        { key: 'move', label: 'Move to group', icon: FolderInput, sfSymbol: 'folder.badge.plus', onPress: () => onMoveToGroup(host) },
        { key: 'sep', divider: true },
        { key: 'delete', label: 'Delete', icon: Trash2, sfSymbol: 'trash', destructive: true, onPress: () => onDelete(host) },
      ];
    }
    return [
      { key: 'connect', label: 'Connect', icon: Plug, sfSymbol: 'bolt.fill', onPress: () => void onConnect(host, 'terminal') },
      { key: 'sftp', label: 'Connect via SFTP', icon: FolderOpen, sfSymbol: 'folder.fill', onPress: () => void onConnect(host, 'sftp') },
      { key: 'sep1', divider: true },
      { key: 'duplicate', label: 'Duplicate', icon: Copy, sfSymbol: 'doc.on.doc', onPress: () => void onDuplicate(host) },
      { key: 'move', label: 'Move to group', icon: FolderInput, sfSymbol: 'folder.badge.plus', onPress: () => onMoveToGroup(host) },
      { key: 'sep2', divider: true },
      { key: 'edit', label: 'Edit', icon: Pencil, sfSymbol: 'pencil', onPress: () => onEdit(host) },
      { key: 'sep3', divider: true },
      { key: 'delete', label: 'Delete', icon: Trash2, sfSymbol: 'trash', destructive: true, onPress: () => onDelete(host) },
    ];
  }, [onConnect, onDuplicate, onMoveToGroup, onEdit, onDelete]);

  const isConnecting = useCallback((hostId: string): boolean => {
    const status = connections.get(hostId)?.status;
    return status === 'resolving' || status === 'connecting';
  }, [connections]);

  const visibleGroups = groups.filter((g) => matches(g, query));
  const visibleHosts = hosts.filter((h) => matches(h, query));
  const isEmpty = visibleGroups.length === 0 && visibleHosts.length === 0;
  const showCreateHost = isRoot && query.length === 0 && isEmpty && !refreshing;

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="nav"
        title={title}
        subtitle={subtitle}
        onBack={() => router.back()}
        right={(
          <MenuView
            actions={[
              { id: 'new-host', title: 'New Host', image: 'server.rack' },
              { id: 'new-group', title: 'New Group', image: 'folder.badge.plus' },
            ]}
            onPressAction={({ nativeEvent }) => {
              if (nativeEvent.event === 'new-host') {
                onNewHost();
              } else if (nativeEvent.event === 'new-group') {
                onNewGroup();
              }
            }}
          >
            <RoundButton icon={Plus} onPress={onNewHost} accessibilityLabel="New host" />
          </MenuView>
        )}
      />
      <View className="px-4 pb-2">
        <SearchField value={query} onChangeText={setQuery} placeholder="Search" />
      </View>

      {error != null && (
        <Text className="px-5 pb-1 text-[13px] text-danger">{error}</Text>
      )}

      {showCreateHost
        ? (
          <CreateHostEmptyState
            onContinue={(addr) => router.push({ pathname: '/host/edit', params: { pid: parentId, kind: 'host', addr } })}
            onDiscover={() => Alert.alert('Discover local devices', 'Local network discovery is coming soon.')}
          />
        )
        : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.contentSecondary} />}
          >
            {visibleGroups.length > 0 && (
              <Text className="px-1 pb-2 pt-4 text-[12px] font-semibold uppercase tracking-wider text-content-tertiary">Groups</Text>
            )}
            {visibleGroups.map((g) => (
              <View key={g.id} className="mb-2">
                <Card>
                  <HostRow
                    id={g.id}
                    label={g.label}
                    type={g.type}
                    subtitle={hostSubtitle(g)}
                    onPress={() => onPressItem(g)}
                    menuItems={getMenuItems(g)}
                  />
                </Card>
              </View>
            ))}

            {visibleHosts.length > 0 && (
              <Text className="px-1 pb-2 pt-4 text-[12px] font-semibold uppercase tracking-wider text-content-tertiary">Hosts</Text>
            )}
            {visibleHosts.map((h) => (
              <View key={h.id} className="mb-2">
                <Card>
                  <HostRow
                    id={h.id}
                    label={h.label}
                    type={h.type}
                    subtitle={hostSubtitle(h)}
                    connecting={isConnecting(h.id)}
                    onPress={() => onPressItem(h)}
                    menuItems={getMenuItems(h)}
                    useNativeMenu
                  />
                </Card>
              </View>
            ))}

            {isEmpty && refreshing && <ActivityIndicator color={colors.accent} className="mt-12" />}
            {isEmpty && !refreshing && (
              <EmptyState
                icon={Server}
                title={isRoot ? 'No matches' : 'Empty group'}
                description={isRoot ? 'No hosts match your search.' : 'This group is empty. Tap + to add a host here.'}
              />
            )}
          </ScrollView>
        )}

    </ScreenContainer>
  );
}
