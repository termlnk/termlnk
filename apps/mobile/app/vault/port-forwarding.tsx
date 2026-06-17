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
import type { IPortForwardingTunnelState } from '@termlnk/port-forwarding-mobile';
import type { IMenuAction, IMenuItem } from '../../src/ui/menu-types';
import { MenuView } from '@react-native-menu/menu';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { ArrowLeftRight, Plus } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHostRepository, useObservable, usePortForwardingService, useSyncService } from '../../src/core/core-context';
import { useThemeColors } from '../../src/theme/theme-provider';
import { Card } from '../../src/ui/card';
import { cn } from '../../src/ui/cn';
import { EmptyState } from '../../src/ui/empty-state';
import { TILE_TONES } from '../../src/ui/icon-tile';
import { isMenuAction, toNativeMenuActions } from '../../src/ui/native-menu';
import { RoundButton } from '../../src/ui/round-button';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';
import { SearchField } from '../../src/ui/search-field';

function typeLetter(type: string): string {
  switch (type) {
    case 'local': return 'L';
    case 'remote': return 'R';
    case 'dynamic': return 'D';
    default: return '?';
  }
}

function TypeLetterTile({ type }: { type: string }) {
  const { bg, fg } = TILE_TONES.portfwd;
  return (
    <View
      className="items-center justify-center rounded-xl"
      style={{ width: 36, height: 36, backgroundColor: bg }}
    >
      <Text style={{ color: fg, fontSize: 17, fontWeight: '700' }}>{typeLetter(type)}</Text>
    </View>
  );
}

function ruleSubtitle(rule: IPortForwardingRuleEntity, hostLabel: string): string {
  const bind = `${rule.bindAddress}:${rule.bindPort}`;
  const dest = `${rule.destinationAddress ?? '?'}:${rule.destinationPort ?? '?'}`;
  switch (rule.type) {
    case 'local':
      return `${bind} → ${hostLabel} → ${dest}`;
    case 'remote':
      return `${hostLabel}:${rule.bindPort} → This device → ${dest}`;
    case 'dynamic':
      return `socks5://${bind}`;
    default:
      return `${bind} → ${dest}`;
  }
}

function ruleCopyAddress(rule: IPortForwardingRuleEntity): string {
  const bind = `${rule.bindAddress}:${rule.bindPort}`;
  if (rule.type === 'dynamic') {
    return `socks5://${bind}`;
  }
  return bind;
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

function tunnelSubtitle(state: IPortForwardingTunnelState | undefined, fallback: string): string {
  if (!state) {
    return fallback;
  }
  switch (state.status) {
    case 'starting':
      return 'Starting…';
    case 'active':
      return `Active · ${state.activeConnections} connection${state.activeConnections === 1 ? '' : 's'}`;
    case 'failed':
      return state.error ?? 'Connection failed';
    default:
      return fallback;
  }
}

// --- PortForwardingRow ---

interface IPortForwardingRowProps {
  readonly rule: IPortForwardingRuleEntity;
  readonly hostLabel: string;
  readonly tunnelState: IPortForwardingTunnelState | undefined;
  readonly onStart: (id: string) => void;
  readonly onStop: (id: string) => void;
  readonly onEdit: (id: string) => void;
  readonly onDelete: (rule: IPortForwardingRuleEntity) => void;
}

const PortForwardingRow = memo(function PortForwardingRow({ rule, hostLabel, tunnelState, onStart, onStop, onEdit, onDelete }: IPortForwardingRowProps) {
  const colors = useThemeColors();
  const isActive = tunnelState != null && (tunnelState.status === 'active' || tunnelState.status === 'starting');
  const hasFailed = tunnelState?.status === 'failed';

  const subtitle = tunnelSubtitle(tunnelState, ruleSubtitle(rule, hostLabel));

  const menuItems = useMemo((): IMenuItem[] => {
    const connectItem: IMenuAction = isActive
      ? { key: 'disconnect', label: 'Disconnect', sfSymbol: 'bolt.slash.fill', onPress: () => onStop(rule.id) }
      : { key: 'connect', label: 'Connect', sfSymbol: 'bolt.fill', onPress: () => onStart(rule.id) };

    return [
      connectItem,
      ...(rule.type !== 'dynamic' ? [{
        key: 'browser',
        label: 'Open Browser',
        sfSymbol: 'globe',
        onPress: () => {
          const addr = `http://${rule.bindAddress}:${rule.bindPort}`;
          void Linking.openURL(addr);
        },
      }] : []),
      {
        key: 'copy',
        label: 'Copy Address',
        sfSymbol: 'doc.on.doc',
        onPress: () => {
          void Clipboard.setStringAsync(ruleCopyAddress(rule));
        },
      },
      { key: 'sep1', divider: true },
      {
        key: 'edit',
        label: 'Edit',
        sfSymbol: 'pencil',
        onPress: () => onEdit(rule.id),
      },
      { key: 'sep2', divider: true },
      {
        key: 'delete',
        label: 'Delete',
        sfSymbol: 'trash',
        destructive: true,
        onPress: () => onDelete(rule),
      },
    ];
  }, [isActive, onStart, onStop, onEdit, onDelete, rule]);

  const actionLookup = useMemo(
    () => new Map(menuItems.filter(isMenuAction).map((item) => [item.key, item])),
    [menuItems]
  );

  const onPress = useCallback(() => {
    if (isActive) {
      onStop(rule.id);
    } else {
      onStart(rule.id);
    }
  }, [isActive, onStart, onStop, rule.id]);

  return (
    <MenuView
      actions={toNativeMenuActions(menuItems)}
      shouldOpenOnLongPress
      onPressAction={({ nativeEvent }) => {
        const action = actionLookup.get(nativeEvent.event);
        if (action != null) {
          action.onPress();
        }
      }}
    >
      <Pressable onPress={onPress} className="active:bg-surface-sunken">
        <View className="flex-row items-center px-4 py-3.5">
          <TypeLetterTile type={rule.type} />
          <View className="ml-3 flex-1">
            <Text numberOfLines={1} className="text-[15px] leading-[20px] text-content">{ruleTitle(rule)}</Text>
            <Text
              numberOfLines={1}
              className={cn('mt-0.5 text-[12px] leading-4', {
                'text-danger': hasFailed,
                'text-content-secondary': !hasFailed,
              })}
            >
              {subtitle}
            </Text>
          </View>
          <View
            className="ml-2 h-2 w-2 rounded-full"
            style={{ backgroundColor: isActive ? '#34d399' : colors.contentTertiary, opacity: isActive ? 1 : 0.3 }}
          />
        </View>
      </Pressable>
    </MenuView>
  );
});

// --- Screen ---

export default function PortForwardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pfService = usePortForwardingService();
  const syncService = useSyncService();
  const hostRepo = useHostRepository();

  const rules = useObservable(pfService.rules$, []);
  const tunnelStates = useObservable(pfService.tunnelStates$, new Map());
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
      || ruleSubtitle(r, hostMap.get(r.hostId) ?? '').toLowerCase().includes(q)
      || r.type.toLowerCase().includes(q)
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

  const handleStart = useCallback((id: string) => {
    void pfService.startRule(id);
  }, [pfService]);

  const handleStop = useCallback((id: string) => {
    void pfService.stopRule(id);
  }, [pfService]);

  const handleEdit = useCallback((id: string) => {
    router.push({ pathname: '/vault/port-forwarding-edit', params: { id } });
  }, [router]);

  const handleDelete = useCallback((rule: IPortForwardingRuleEntity) => {
    Alert.alert(
      'Delete Rule',
      `Delete "${ruleTitle(rule)}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void pfService.removeRule(rule.id),
        },
      ]
    );
  }, [pfService]);

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="nav"
        title="Port Forwarding"
        onBack={() => router.back()}
        right={<RoundButton icon={Plus} onPress={() => router.push('/vault/port-forwarding-edit')} accessibilityLabel="Add rule" />}
      />
      <View className="px-4">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search rules..." />
      </View>
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
            <Card dividerInset={0}>
              {filtered.map((rule) => (
                <PortForwardingRow
                  key={rule.id}
                  rule={rule}
                  hostLabel={hostMap.get(rule.hostId) ?? 'Unknown host'}
                  tunnelState={tunnelStates.get(rule.id)}
                  onStart={handleStart}
                  onStop={handleStop}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </Card>
            {filtered.length === 0 && search && (
              <View className="items-center py-8">
                <Text className="text-[14px] text-content-tertiary">
                  No rules match "
                  {search}
                  "
                </Text>
              </View>
            )}
          </ScrollView>
        )}
    </ScreenContainer>
  );
}
