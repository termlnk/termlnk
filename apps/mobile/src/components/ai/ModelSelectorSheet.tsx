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

import type { IMobileModelConfig, IMobileProviderGroup } from '@termlnk/agent-mobile';
import { Brain, Check, SearchIcon, Sparkles } from 'lucide-react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, SectionList, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '../../lib/cn';
import { hapticSelection } from '../../lib/haptics';
import { useThemeColors } from '../../theme/theme-provider';

const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.55;

function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(0)}M`;
  }
  return `${(tokens / 1_000).toFixed(0)}K`;
}

interface IModelRowProps {
  readonly model: IMobileModelConfig;
  readonly isActive: boolean;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly onSelect: (model: IMobileModelConfig) => void;
}

const ModelRow = memo(function ModelRow({ model, isActive, isFirst, isLast, onSelect }: IModelRowProps) {
  const colors = useThemeColors();

  const handlePress = useCallback(() => {
    onSelect(model);
  }, [model, onSelect]);

  return (
    <View
      className="mx-4 overflow-hidden bg-surface-raised"
      style={[
        isFirst ? { borderTopLeftRadius: 16, borderTopRightRadius: 16 } : undefined,
        isLast ? { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 } : undefined,
        { borderCurve: 'continuous' },
      ]}
    >
      <Pressable
        onPress={handlePress}
        className="flex-row items-center px-4 py-3.5 active:bg-surface-sunken"
      >
        <View className="flex-1">
          <Text
            className={cn('text-[15px] leading-5', {
              'font-semibold text-accent': isActive,
              'text-content': !isActive,
            })}
            numberOfLines={1}
          >
            {model.name}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          {model.reasoning ? <Brain size={14} color={colors.contentTertiary} /> : null}
          <Text className="text-[12px] text-content-tertiary">
            {formatContextWindow(model.contextWindow)}
          </Text>
          {isActive ? <Check size={18} color={colors.accent} /> : null}
        </View>
      </Pressable>
      {!isLast ? <View className="mx-4 h-px bg-divider/50" /> : null}
    </View>
  );
});

interface IModelSelectorSheetProps {
  readonly visible: boolean;
  readonly providers: readonly IMobileProviderGroup[];
  readonly activeModelId: string | null;
  readonly onSelect: (model: IMobileModelConfig) => void;
  readonly onClose: () => void;
}

interface IModelSection {
  readonly title: string;
  readonly data: readonly IMobileModelConfig[];
}

export function ModelSelectorSheet({ visible, providers, activeModelId, onSelect, onClose }: IModelSelectorSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const sections: IModelSection[] = useMemo(() => {
    return providers
      .filter((g) => g.provider.enabled && g.models.length > 0)
      .map((g) => ({
        title: g.provider.name,
        data: g.models.filter((m) =>
          m.enabled && (search.length === 0 || m.name.toLowerCase().includes(search.toLowerCase()))
        ),
      }))
      .filter((s) => s.data.length > 0);
  }, [providers, search]);

  const handleSelect = useCallback((model: IMobileModelConfig) => {
    hapticSelection();
    onSelect(model);
    onClose();
  }, [onSelect, onClose]);

  const handleClose = useCallback(() => {
    setSearch('');
    onClose();
  }, [onClose]);

  const renderItem = useCallback(({ item, index, section }: { item: IMobileModelConfig; index: number; section: IModelSection }) => (
    <ModelRow
      model={item}
      isActive={item.id === activeModelId}
      isFirst={index === 0}
      isLast={index === section.data.length - 1}
      onSelect={handleSelect}
    />
  ), [activeModelId, handleSelect]);

  const renderSectionHeader = useCallback(({ section }: { section: IModelSection }) => (
    <View className="bg-surface px-8 pb-2 pt-5">
      <Text className="text-[12px] font-semibold uppercase tracking-wider text-content-tertiary">
        {section.title}
      </Text>
    </View>
  ), []);

  const keyExtractor = useCallback((item: IMobileModelConfig) => item.id, []);

  const ListEmptyComponent = useMemo(() => (
    <View className="items-center px-8 py-16">
      <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised">
        <Sparkles size={24} color={colors.contentTertiary} />
      </View>
      <Text className="text-center text-[15px] leading-5 text-content-tertiary">
        {search.length > 0 ? 'No models match your search.' : 'No models available.\nConfigure a provider first.'}
      </Text>
    </View>
  ), [search.length, colors.contentTertiary]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable onPress={handleClose} className="flex-1 justify-end bg-black/40">
        <Pressable onPress={() => {}}>
          <View
            className="rounded-t-3xl bg-surface"
            style={{ paddingBottom: insets.bottom + 16, maxHeight: SHEET_MAX_HEIGHT }}
          >
            <View className="items-center py-3">
              <View className="h-[5px] w-9 rounded-full bg-content-tertiary/30" />
            </View>

            <Text className="mb-3 text-center text-[16px] font-semibold text-content">Select Model</Text>

            <View className="mx-4 mb-2 flex-row items-center rounded-xl bg-field px-3">
              <SearchIcon size={16} color={colors.contentTertiary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search models…"
                placeholderTextColor={colors.contentTertiary}
                className="ml-2 flex-1 py-2.5 text-[15px] text-content"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>

            <SectionList
              sections={sections}
              renderItem={renderItem}
              renderSectionHeader={renderSectionHeader}
              keyExtractor={keyExtractor}
              ListEmptyComponent={ListEmptyComponent}
              stickySectionHeadersEnabled={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
