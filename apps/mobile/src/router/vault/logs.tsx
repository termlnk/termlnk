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

import type { IMobileHost, IRecentSession } from '@termlnk/database-mobile';
import { useRouter } from 'expo-router';
import { History } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HostRow } from '../../components/hosts/host-row';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { DangerButton } from '../../components/ui/form';
import { ScreenContainer } from '../../components/ui/screen-container';
import { ScreenHeader } from '../../components/ui/screen-header';
import { useRecentSessionsRepository, useSyncService } from '../../core/core-context';

// Compact single-unit "time ago" so the trailing column stays narrow.
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

export default function LogsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pull = useSyncService();
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
    return sessions.map((session) => ({ session, host: byId.get(session.hostId) ?? null }));
  }, [sessions, hosts]);

  const onOpen = useCallback((item: IResolvedSession) => {
    if (item.host == null) {
      return;
    }
    if (item.session.kind === 'sftp') {
      router.push({ pathname: '/host/[id]/sftp', params: { id: item.session.hostId } });
      return;
    }
    router.push({ pathname: '/host/[id]/terminal', params: { id: item.session.hostId } });
  }, [router]);

  return (
    <ScreenContainer>
      <ScreenHeader variant="nav" title="Logs" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {resolved.length === 0
          ? (
            <View className="pt-16">
              <EmptyState
                icon={History}
                title="No recent connections"
                description="Open a host to start a session — it lands here for one-tap reconnect."
              />
            </View>
          )
          : (
            <>
              <Card dividerInset={64}>
                {resolved.map((item) => {
                  const label = item.host?.label ?? '(deleted host)';
                  const addr = item.host?.addr ?? '—';
                  const port = item.host?.port ?? 22;
                  return (
                    <HostRow
                      key={`${item.session.hostId}::${item.session.kind}`}
                      id={item.session.hostId}
                      label={label}
                      type={item.host?.type ?? 'host'}
                      subtitle={`${item.session.kind === 'sftp' ? 'SFTP' : 'SSH'} · ${addr}:${port}`}
                      trailing={formatAgo(item.session.lastUsedAt)}
                      onPress={() => onOpen(item)}
                    />
                  );
                })}
              </Card>
              <View className="mt-6">
                <DangerButton title="Clear recent" onPress={() => void repo.clear()} />
              </View>
            </>
          )}
      </ScrollView>
    </ScreenContainer>
  );
}
