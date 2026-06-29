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

import type { LucideIcon } from 'lucide-react-native';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../theme/theme-provider';

interface IPlaceholderSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly icon: LucideIcon;
  readonly description: string;
  readonly onClose: () => void;
}

export function PlaceholderSheet({ visible, title, icon: Icon, description, onClose }: IPlaceholderSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/40">
        <Pressable onPress={() => {}}>
          <View className="rounded-t-3xl bg-surface" style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="items-center py-3">
              <View className="h-[5px] w-9 rounded-full bg-content-tertiary/30" />
            </View>

            <Text className="mb-4 text-center text-[16px] font-semibold text-content">{title}</Text>

            <View className="items-center px-8 py-8">
              <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised">
                <Icon size={24} color={colors.contentTertiary} />
              </View>
              <Text className="mb-1 text-[16px] font-semibold text-content">Coming Soon</Text>
              <Text className="text-center text-[14px] leading-5 text-content-secondary">
                {description}
              </Text>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
