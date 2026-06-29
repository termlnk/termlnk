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

import type { ISnippetEntity } from '@termlnk/database-mobile';
import { MenuView } from '@react-native-menu/menu';
import { useRouter } from 'expo-router';
import { Braces, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { IconTile } from '../../components/ui/icon-tile';
import { RoundButton } from '../../components/ui/round-button';
import { NavRow } from '../../components/ui/rows';
import { ScreenContainer } from '../../components/ui/screen-container';
import { ScreenHeader } from '../../components/ui/screen-header';
import { SearchField } from '../../components/ui/search-field';
import { SectionLabel } from '../../components/ui/section-label';
import { useObservable, useSnippetRepository, useSyncService } from '../../core/core-context';
import { filterSnippets, groupSnippets } from '../../lib/snippet-utils';
import { useThemeColors } from '../../theme/theme-provider';

function SnippetCard({ snippets, router }: { snippets: ISnippetEntity[]; router: ReturnType<typeof useRouter> }) {
  return (
    <Card dividerInset={64}>
      {snippets.map((snippet) => (
        <NavRow
          key={snippet.id}
          leading={<IconTile icon={Braces} tone="snippets" />}
          title={snippet.label}
          subtitle={snippet.content?.split('\n')[0]}
          onPress={() => router.push({ pathname: '/vault/snippet-edit', params: { id: snippet.id } })}
        />
      ))}
    </Card>
  );
}

function EmptyPackageCard() {
  const colors = useThemeColors();
  return (
    <View
      style={{ borderColor: colors.divider, borderWidth: 1, borderStyle: 'dashed' }}
      className="items-center rounded-2xl px-4 py-4"
    >
      <Text className="text-[14px] text-content-tertiary">No snippets</Text>
    </View>
  );
}

export default function SnippetsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const snippetRepo = useSnippetRepository();
  const syncService = useSyncService();

  const snippets = useObservable(snippetRepo.snippets$, []);
  const packages = useObservable(snippetRepo.packages$, []);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void snippetRepo.ready();
  }, [snippetRepo]);

  const filtered = useMemo(() => filterSnippets(snippets, search), [snippets, search]);

  const grouped = useMemo(() => groupSnippets(filtered), [filtered]);

  const hasContent = snippets.length > 0 || packages.length > 0;

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
        title="Snippets"
        onBack={() => router.back()}
        right={(
          <MenuView
            actions={[
              { id: 'package', title: 'New Package', image: 'shippingbox.fill' },
              { id: 'snippet', title: 'New Snippet', image: 'curlybraces' },
            ]}
            onPressAction={({ nativeEvent }) => {
              if (nativeEvent.event === 'package') {
                router.push('/vault/snippet-package-edit');
              } else if (nativeEvent.event === 'snippet') {
                router.push('/vault/snippet-edit');
              }
            }}
          >
            <RoundButton icon={Plus} onPress={() => {}} accessibilityLabel="Add snippet" />
          </MenuView>
        )}
      />
      <View className="px-4">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search snippets..." />
      </View>
      {!hasContent && !search
        ? (
          <View className="flex-1 justify-center">
            <EmptyState
              icon={Braces}
              title="There are no snippets"
              description="Save your frequently used commands as snippets for easy execution in the future."
            />
          </View>
        )
        : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* Ungrouped snippets */}
            {grouped.ungrouped.length > 0 && (
              <SnippetCard snippets={grouped.ungrouped} router={router} />
            )}

            {/* Package sections */}
            {packages.map((pkg) => {
              const pkgSnippets = grouped.byPackage.get(pkg.id) || [];
              return (
                <View key={pkg.id} className="mt-5">
                  <Pressable
                    onPress={() => router.push({ pathname: '/vault/snippet-package-edit', params: { id: pkg.id } })}
                  >
                    <SectionLabel title={pkg.label} />
                  </Pressable>
                  {pkgSnippets.length > 0
                    ? <SnippetCard snippets={pkgSnippets} router={router} />
                    : <EmptyPackageCard />}
                </View>
              );
            })}

            {filtered.length === 0 && search && (
              <View className="items-center py-8">
                <Text className="text-[14px] text-content-tertiary">
                  No snippets match "
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
