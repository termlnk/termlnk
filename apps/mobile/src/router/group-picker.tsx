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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HostAvatar } from '../components/hosts/host-avatar';
import { Card } from '../components/ui/card';
import { NavRow } from '../components/ui/rows';
import { useObservable, useSyncService } from '../core/core-context';
import { setPendingGroupSelection } from '../lib/group-selection';
import { useThemeColors } from '../theme/theme-provider';

// Collect a group and all its descendants so a group cannot be reparented under
// itself (which would create a cycle in the tree).
function collectSubtree(hosts: readonly IMobileHost[], rootId: string): Set<string> {
  const byParent = new Map<string, IMobileHost[]>();
  for (const host of hosts) {
    const bucket = byParent.get(host.pid);
    if (bucket) {
      bucket.push(host);
    } else {
      byParent.set(host.pid, [host]);
    }
  }
  const excluded = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of byParent.get(current) ?? []) {
      if (child.type === 'group' && !excluded.has(child.id)) {
        excluded.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return excluded;
}

export default function GroupPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ excludeId?: string; selectedPid?: string }>();
  const pull = useSyncService();
  const hosts = useObservable(pull.hosts$, []);

  const excluded = useMemo(
    () => (params.excludeId != null ? collectSubtree(hosts, params.excludeId) : new Set<string>()),
    [hosts, params.excludeId]
  );
  const groups = useMemo(
    () => hosts.filter((h) => h.type === 'group' && !excluded.has(h.id)),
    [hosts, excluded]
  );

  const pick = (pid: string, label: string) => {
    setPendingGroupSelection({ pid, label });
    router.back();
  };

  const selectedPid = params.selectedPid ?? 'root';

  return (
    <>
      <Stack.Screen options={{ title: 'Parent Group' }} />
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 96, paddingBottom: insets.bottom + 32 }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        <Card dividerInset={64}>
          <NavRow
            leading={<View className="h-9 w-9 items-center justify-center rounded-xl bg-surface-sunken" />}
            title="No group (root)"
            showChevron={false}
            onPress={() => pick('root', 'None')}
            trailing={selectedPid === 'root' ? <Check size={20} color={colors.accent} /> : undefined}
          />
          {groups.map((g) => (
            <NavRow
              key={g.id}
              leading={<HostAvatar id={g.id} label={g.label} type="group" />}
              title={g.label}
              showChevron={false}
              onPress={() => pick(g.id, g.label)}
              trailing={selectedPid === g.id ? <Check size={20} color={colors.accent} /> : undefined}
            />
          ))}
        </Card>
        {groups.length === 0 && (
          <Text className="mt-4 px-2 text-center text-[14px] text-content-secondary">
            No groups yet. Create a group to organize your hosts.
          </Text>
        )}
      </ScrollView>
    </>
  );
}
