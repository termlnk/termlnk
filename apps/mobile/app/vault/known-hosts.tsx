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

import { useRouter } from 'expo-router';
import { Check, CircleCheck, Fingerprint, Search, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKnownHostRepository, useObservable } from '../../src/core/core-context';
import { useThemeColors } from '../../src/theme/theme-provider';
import { Card } from '../../src/ui/card';
import { EmptyState } from '../../src/ui/empty-state';
import { hapticLight, hapticSelection } from '../../src/ui/haptics';
import { IconTile } from '../../src/ui/icon-tile';
import { RoundButton } from '../../src/ui/round-button';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';

export default function KnownHostsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const knownHostRepo = useKnownHostRepository();
  const knownHosts = useObservable(knownHostRepo.knownHosts$, []);

  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    void knownHostRepo.ready();
  }, [knownHostRepo]);

  const filtered = useMemo(() => {
    if (!search.trim()) {
      return knownHosts;
    }
    const q = search.toLowerCase();
    return knownHosts.filter((kh) => `${kh.host}:${kh.port}`.toLowerCase().includes(q));
  }, [knownHosts, search]);

  const toggleSelect = useCallback((id: string) => {
    hapticSelection();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const enterSelectMode = useCallback(() => {
    hapticLight();
    setSelecting(true);
    setSelected(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  const onDeleteSelected = useCallback(() => {
    if (selected.size === 0) {
      return;
    }
    Alert.alert(
      'Forget host keys',
      `Forget ${selected.size} trusted key${selected.size > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            for (const id of selected) {
              await knownHostRepo.deleteKnownHost(id);
            }
            exitSelectMode();
          },
        },
      ]
    );
  }, [selected, knownHostRepo, exitSelectMode]);

  const headerRight = selecting
    ? (
      <View className="flex-row items-center gap-2">
        <RoundButton icon={Trash2} onPress={onDeleteSelected} disabled={selected.size === 0} accessibilityLabel="Delete selected" />
        <RoundButton icon={Check} onPress={exitSelectMode} accessibilityLabel="Done" />
      </View>
    )
    : knownHosts.length > 0
      ? (
        <Pressable onPress={enterSelectMode} className="px-2 py-1">
          <Text className="text-[16px] font-semibold text-content">Select</Text>
        </Pressable>
      )
      : undefined;

  const headerTitle = selecting ? `${selected.size} selected` : 'Known Hosts';

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="nav"
        title={headerTitle}
        onBack={() => {
          if (selecting) {
            exitSelectMode();
          } else {
            router.back();
          }
        }}
        right={headerRight}
      />

      {/* Search bar */}
      <View className="mx-4 mb-2 mt-1 flex-row items-center rounded-full bg-surface-sunken px-3 py-2">
        <Search size={18} color={colors.contentTertiary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          placeholderTextColor={colors.contentTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          className="ml-2 flex-1 text-[15px] leading-[20px] text-content"
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {knownHosts.length === 0
          ? (
            <View className="pt-16">
              <EmptyState
                icon={Fingerprint}
                title="Known Hosts will appear here"
                description="Known hosts are trusted server identities saved for secure future connections."
              />
            </View>
          )
          : filtered.length === 0
            ? (
              <View className="pt-16">
                <EmptyState title="No results" description="Try a different search term." />
              </View>
            )
            : (
              <Card dividerInset={selecting ? 80 : 64}>
                {filtered.map((kh) => {
                  const isSelected = selected.has(kh.id);
                  return (
                    <Pressable
                      key={kh.id}
                      onPress={() => {
                        if (selecting) {
                          toggleSelect(kh.id);
                        }
                      }}
                      className="flex-row items-center px-4 py-3 active:bg-surface-sunken"
                    >
                      {selecting && (
                        <View className="mr-3">
                          {isSelected
                            ? <CircleCheck size={22} color={colors.accent} fill={colors.accent} />
                            : <View className="h-[22px] w-[22px] rounded-full border-2 border-divider" />}
                        </View>
                      )}
                      <IconTile icon={Fingerprint} tone="known" />
                      <Text className="ml-3 flex-1 text-[15px] leading-[20px] text-content" numberOfLines={1}>
                        {kh.host}
                        :
                        {kh.port}
                      </Text>
                    </Pressable>
                  );
                })}
              </Card>
            )}
      </ScrollView>
    </ScreenContainer>
  );
}
