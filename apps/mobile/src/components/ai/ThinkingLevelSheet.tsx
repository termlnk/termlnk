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

import type { MobileThinkingLevel } from '@termlnk/agent-mobile';
import { Ban, Check, Lightbulb, Sparkles } from 'lucide-react-native';
import { useCallback } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticSelection } from '../../lib/haptics';
import { useThemeColors } from '../../theme/theme-provider';

interface ILevelOption {
  readonly level: MobileThinkingLevel;
  readonly label: string;
  readonly description: string;
}

const LEVELS: readonly ILevelOption[] = [
  { level: 'off', label: 'Off', description: 'No extended thinking' },
  { level: 'minimal', label: 'Minimal', description: 'Brief reasoning (~1K tokens)' },
  { level: 'low', label: 'Low', description: 'Light reasoning (~2K tokens)' },
  { level: 'medium', label: 'Medium', description: 'Moderate reasoning (~4K tokens)' },
  { level: 'high', label: 'High', description: 'Deep reasoning (auto budget)' },
  { level: 'xhigh', label: 'Extra High', description: 'Maximum reasoning depth' },
];

interface IThinkingLevelSheetProps {
  readonly visible: boolean;
  readonly level: MobileThinkingLevel;
  readonly supportsReasoning: boolean;
  readonly onSelect: (level: MobileThinkingLevel) => void;
  readonly onClose: () => void;
}

export function ThinkingLevelSheet({ visible, level, supportsReasoning, onSelect, onClose }: IThinkingLevelSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const handleSelect = useCallback((l: MobileThinkingLevel) => {
    hapticSelection();
    onSelect(l);
    onClose();
  }, [onSelect, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/40">
        <Pressable onPress={() => {}}>
          <View className="rounded-t-3xl bg-surface" style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="items-center py-3">
              <View className="h-[5px] w-9 rounded-full bg-content-tertiary/30" />
            </View>

            <Text className="mb-4 text-center text-[16px] font-semibold text-content">Thinking Level</Text>

            {!supportsReasoning
              ? (
                <View className="items-center px-8 py-8">
                  <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised">
                    <Sparkles size={24} color={colors.contentTertiary} />
                  </View>
                  <Text className="text-center text-[15px] leading-5 text-content-tertiary">
                    {'This model does not support\nextended thinking.'}
                  </Text>
                </View>
              )
              : (
                <View className="mx-4 overflow-hidden rounded-2xl bg-surface-raised" style={{ borderCurve: 'continuous' }}>
                  {LEVELS.map((opt, i) => {
                    const isSelected = opt.level === level;
                    const isLast = i === LEVELS.length - 1;
                    return (
                      <View key={opt.level}>
                        <Pressable
                          onPress={() => handleSelect(opt.level)}
                          className="flex-row items-center px-4 py-3.5 active:bg-surface-sunken"
                        >
                          <View className="mr-3 h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `${colors.contentTertiary}12` }}>
                            {opt.level === 'off'
                              ? <Ban size={16} color={colors.contentTertiary} />
                              : <Lightbulb size={16} color={isSelected ? colors.accent : colors.contentTertiary} />}
                          </View>
                          <View className="flex-1">
                            <Text className="text-[15px] leading-5 text-content">{opt.label}</Text>
                            <Text className="text-[12px] leading-4 text-content-secondary">{opt.description}</Text>
                          </View>
                          {isSelected ? <Check size={18} color={colors.accent} /> : null}
                        </Pressable>
                        {!isLast ? <View className="mx-4 h-px bg-divider/50" style={{ marginLeft: 56 }} /> : null}
                      </View>
                    );
                  })}
                </View>
              )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
