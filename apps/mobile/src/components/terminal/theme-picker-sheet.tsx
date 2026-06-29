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

import type { ITheme } from '@termlnk/themes';
import { ALL_THEMES } from '@termlnk/themes';
import { Check, Search, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticSelection } from '../../lib/haptics';
import { useThemeColors } from '../../theme/theme-provider';

interface IThemePickerSheetProps {
  readonly visible: boolean;
  readonly value: string;
  readonly onSelect: (themeName: string) => void;
  readonly onClose: () => void;
}

const DARK_THEMES = ALL_THEMES.filter((t) => t.type === 'dark');
const LIGHT_THEMES = ALL_THEMES.filter((t) => t.type === 'light');

export function ThemePickerSheet({ visible, value, onSelect, onClose }: IThemePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      return { dark: DARK_THEMES, light: LIGHT_THEMES };
    }
    return {
      dark: DARK_THEMES.filter((t) => t.name.toLowerCase().includes(q)),
      light: LIGHT_THEMES.filter((t) => t.name.toLowerCase().includes(q)),
    };
  }, [query]);

  const sections = useMemo(() => {
    const items: Array<{ type: 'header'; title: string } | { type: 'theme'; theme: ITheme }> = [];
    if (filtered.dark.length > 0) {
      items.push({ type: 'header', title: `Dark (${filtered.dark.length})` });
      filtered.dark.forEach((t) => items.push({ type: 'theme', theme: t }));
    }
    if (filtered.light.length > 0) {
      items.push({ type: 'header', title: `Light (${filtered.light.length})` });
      filtered.light.forEach((t) => items.push({ type: 'theme', theme: t }));
    }
    return items;
  }, [filtered]);

  const handleSelect = useCallback((theme: ITheme) => {
    hapticSelection();
    onSelect(theme.name);
    onClose();
  }, [onSelect, onClose]);

  const renderItem = useCallback(({ item }: { item: (typeof sections)[number] }) => {
    if (item.type === 'header') {
      return (
        <Text className="px-5 pb-2 pt-4 text-[12px] font-semibold uppercase tracking-wider text-content-tertiary">
          {item.title}
        </Text>
      );
    }
    const { theme } = item;
    const selected = theme.name === value;
    return (
      <Pressable
        onPress={() => handleSelect(theme)}
        className="mx-4 mb-1 flex-row items-center rounded-xl px-3 py-2.5 active:bg-surface-sunken"
      >
        <View
          className="mr-3 h-10 w-10 items-center justify-center overflow-hidden rounded-lg"
          style={{ backgroundColor: theme.base_16.base00 ?? theme.base_30.black }}
        >
          <View className="flex-row gap-0.5">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.base_30.red }} />
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.base_30.green }} />
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.base_30.blue }} />
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.base_30.yellow }} />
          </View>
        </View>
        <Text className="flex-1 text-[15px] text-content">{theme.name.replace(/-/g, ' ')}</Text>
        {selected && <Check size={20} color={colors.accent} />}
      </Pressable>
    );
  }, [value, colors.accent, handleSelect]);

  const keyExtractor = useCallback((item: (typeof sections)[number], index: number) => {
    if (item.type === 'header') {
      return `h-${item.title}`;
    }
    return item.theme.name;
  }, []);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-[18px] font-semibold text-content">Terminal Theme</Text>
          <Pressable onPress={onClose} className="h-8 w-8 items-center justify-center rounded-full bg-surface-sunken active:opacity-70">
            <X size={18} color={colors.content} />
          </Pressable>
        </View>

        <View className="mx-4 mb-3 flex-row items-center rounded-xl bg-surface-raised px-3 py-2.5">
          <Search size={16} color={colors.contentTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search themes…"
            placeholderTextColor={colors.contentTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            className="ml-2 flex-1 text-[15px] text-content"
          />
        </View>

        <FlatList
          data={sections}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </Modal>
  );
}
