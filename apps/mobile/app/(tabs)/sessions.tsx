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

import type { IRecentSession } from '../../src/sessions/recent-sessions-repository';
import type { IMobileHost } from '../../src/sync/mobile-sync-pull.service';
import { useRouter } from 'expo-router';
import { History } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRecentSessionsRepository, useSyncPullService } from '../../src/core/core-context';
import { EmptyState } from '../../src/ui/empty-state';
import { HostRow } from '../../src/ui/host-row';
import { ScreenContainer } from '../../src/ui/screen-container';

// Format a delta into a compact human label. Single character units so the
// trailing position in the row stays narrow on small screens.
function formatAgo(ms: number): string {
  const delta = Math.max(0, Date.now() - ms);
  const min = Math.floor(delta / 60_000);
  if (min < 1) {
    return 'now';
  }
  if (min < 60) {
    return `${min}m`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr}h`;
  }
  const day = Math.floor(hr / 24);
  if (day < 30) {
    return `${day}d`;
  }
  const month = Math.floor(day / 30);
  if (month < 12) {
    return `${month}mo`;
  }
  return `${Math.floor(month / 12)}y`;
}

interface IResolvedSession {
  readonly session: IRecentSession;
  readonly host: IMobileHost | null;
}

export default function SessionsTab() {
  const router = useRouter();
  const pull = useSyncPullService();
  const repo = useRecentSessionsRepository();

  const [sessions, setSessions] = useState<readonly IRecentSession[]>([]);
  const [hosts, setHosts] = useState<readonly IMobileHost[]>([]);

  useEffect(() => {
    void repo.ready();
    const sub = repo.sessions$.subscribe(setSessions);
    return () => sub.unsubscribe();
  }, [repo]);

  useEffect(() => {
    const sub = pull.hosts$.subscribe(setHosts);
    return () => sub.unsubscribe();
  }, [pull]);

  const resolved: readonly IResolvedSession[] = useMemo(() => {
    const byId = new Map(hosts.map((h) => [h.id, h]));
    return sessions.map((session) => ({
      session,
      host: byId.get(session.hostId) ?? null,
    }));
  }, [sessions, hosts]);

  const onOpen = useCallback(
    (item: IResolvedSession) => {
      if (!item.host) {
        return;
      }
      if (item.session.kind === 'sftp') {
        router.push({ pathname: '/host/[id]/sftp', params: { id: item.session.hostId } });
        return;
      }
      router.push({ pathname: '/host/[id]/terminal', params: { id: item.session.hostId } });
    },
    [router]
  );

  const onClear = useCallback(async () => {
    await repo.clear();
  }, [repo]);

  return (
    <ScreenContainer>
      <FlatList
        data={resolved}
        keyExtractor={(item) => `${item.session.hostId}::${item.session.kind}`}
        renderItem={({ item }) => {
          const label = item.host?.label ?? '(deleted host)';
          const addr = item.host?.addr ?? '—';
          const port = item.host?.port ?? 22;
          const subtitle = `${item.session.kind === 'sftp' ? 'SFTP' : 'SSH'} · ${addr}:${port}`;
          return (
            <HostRow
              id={item.session.hostId}
              label={label}
              type={item.host?.type ?? 'host'}
              subtitle={subtitle}
              trailing={formatAgo(item.session.lastUsedAt)}
              onPress={() => onOpen(item)}
            />
          );
        }}
        ListFooterComponent={resolved.length > 0
          ? (
            <Pressable
              onPress={onClear}
              className="mx-4 mt-6 items-center rounded-lg bg-one-bg py-3 active:bg-one-bg2"
            >
              <Text className="text-[14px] font-medium text-red">Clear recent</Text>
            </Pressable>
          )
          : null}
        ListEmptyComponent={(
          <EmptyState
            icon={History}
            title="No recent connections"
            description="Pick a host on the Hosts tab to start a session. It will land here for one-tap reconnect."
          />
        )}
      />
      <View className="h-6" />
    </ScreenContainer>
  );
}
