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

import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Cable, FolderOpen, Radar, Server } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../src/theme/theme-provider';
import { Card } from '../../src/ui/card';
import { TAB_BAR_HEIGHT } from '../../src/ui/floating-tab-bar';
import { NavRow } from '../../src/ui/rows';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';
import { SearchField } from '../../src/ui/search-field';

// Parse a quick-connect string ("ssh user@host -p 2222" or "user@host") into the
// fields the New Host form prefills. Returns null when it is just a search term.
function parseConnectInput(raw: string): { addr: string; username?: string; port?: string } | null {
  const text = raw.trim().replace(/^ssh\s+/i, '');
  const portMatch = text.match(/-p\s+(\d+)/);
  const port = portMatch?.[1];
  const target = text.replace(/\s*-p\s+\d+/, '').trim();
  if (target.length === 0) {
    return null;
  }
  const at = target.indexOf('@');
  if (at >= 0) {
    return { username: target.slice(0, at), addr: target.slice(at + 1), port };
  }
  if (raw.trim().toLowerCase().startsWith('ssh') || port != null) {
    return { addr: target, port };
  }
  return null;
}

export default function ConnectionsTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [query, setQuery] = useState('');

  const onConnect = () => {
    const parsed = parseConnectInput(query);
    if (parsed == null) {
      return;
    }
    router.push({ pathname: '/host/edit', params: { kind: 'host', addr: parsed.addr, username: parsed.username ?? '', port: parsed.port ?? '' } });
  };

  const canConnect = parseConnectInput(query) != null;

  return (
    <ScreenContainer>
      <ScreenHeader variant="large" title="Connections" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 }}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={'Search or "ssh user@hostname -p port"'}
          onSubmitEditing={onConnect}
          trailing={(
            <Pressable onPress={onConnect} disabled={!canConnect} hitSlop={8} className="pl-2">
              <Text className={`text-[14px] font-semibold ${canConnect ? 'text-accent' : 'text-content-tertiary'}`}>CONNECT</Text>
            </Pressable>
          )}
        />

        <View className="mt-5 px-1">
          <Text className="text-[18px] font-bold text-content">Ways to connect</Text>
          <Text className="mt-1 text-[14px] leading-5 text-content-secondary">
            Add a host, discover devices on your local network, or connect directly to your devices using a serial cable.
          </Text>
        </View>

        <View className="mt-3">
          <Card dividerInset={64}>
            <NavRow
              leading={<WayTile icon={<Server size={20} color={colors.content} />} />}
              title="Add a host"
              showChevron={false}
              onPress={() => router.push({ pathname: '/host/edit', params: { kind: 'host' } })}
            />
            <NavRow
              leading={<WayTile icon={<FolderOpen size={20} color={colors.content} />} />}
              title="Connect via SFTP"
              showChevron={false}
              onPress={() => router.push('/hosts')}
            />
            <NavRow
              leading={<WayTile icon={<Radar size={20} color={colors.content} />} />}
              title="Discover local devices"
              showChevron={false}
              onPress={() => Alert.alert('Discover local devices', 'Local network discovery is coming soon.')}
            />
            <NavRow
              leading={<WayTile icon={<Cable size={20} color={colors.content} />} />}
              title="Start a serial connection"
              showChevron={false}
              onPress={() => Alert.alert('Serial connection', 'Serial cable connections are coming soon.')}
            />
          </Card>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// Light neutral tile behind the "ways to connect" glyphs (matches Termius).
function WayTile({ icon }: { icon: ReactNode }) {
  return (
    <View className="h-9 w-9 items-center justify-center rounded-xl bg-surface-sunken">
      {icon}
    </View>
  );
}
