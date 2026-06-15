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

import { Check } from 'lucide-react-native';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../theme/theme-provider';
import { hapticSelection } from './haptics';

export interface ISelectSheetOption<T extends string> {
  readonly label: string;
  readonly subtitle?: string;
  readonly value: T;
}

interface ISelectSheetProps<T extends string> {
  readonly visible: boolean;
  readonly title: string;
  readonly options: readonly ISelectSheetOption<T>[];
  readonly value: T;
  readonly onSelect: (value: T) => void;
  readonly onClose: () => void;
}

export function SelectSheet<T extends string>(props: ISelectSheetProps<T>) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const handleSelect = (value: T) => {
    hapticSelection();
    props.onSelect(value);
    props.onClose();
  };

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={props.onClose}
    >
      <Pressable
        onPress={props.onClose}
        className="flex-1 justify-end bg-black/40"
      >
        <Pressable onPress={() => {}}>
          <View
            className="rounded-t-3xl bg-surface"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <View className="items-center py-3">
              <View className="h-[5px] w-9 rounded-full bg-content-tertiary/30" />
            </View>

            <Text className="mb-4 text-center text-[16px] font-semibold text-content">
              {props.title}
            </Text>

            <View className="mx-4 overflow-hidden rounded-2xl bg-surface-raised">
              {props.options.map((opt, idx) => {
                const isSelected = opt.value === props.value;
                const isLast = idx === props.options.length - 1;
                return (
                  <View key={opt.value}>
                    <Pressable
                      onPress={() => handleSelect(opt.value)}
                      className="flex-row items-center justify-between px-4 py-3.5 active:bg-surface-sunken"
                    >
                      <View className="flex-1">
                        <Text className="text-[15px] leading-[20px] text-content">
                          <Text className="font-medium">{opt.label}</Text>
                          {opt.subtitle != null && (
                            <Text className="text-content-secondary">
                              {' | '}
                              {opt.subtitle}
                            </Text>
                          )}
                        </Text>
                      </View>
                      {isSelected && (
                        <Check size={20} color={colors.accent} style={{ marginLeft: 12 }} />
                      )}
                    </Pressable>
                    {!isLast && <View className="mx-4 h-px bg-divider/50" />}
                  </View>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
