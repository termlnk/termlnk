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
import { Text, View } from 'react-native';
import { useThemeColors } from '../theme/theme-provider';

interface IEmptyStateProps {
  readonly icon?: LucideIcon;
  readonly title: string;
  readonly description?: string;
}

export function EmptyState({ icon: Icon, title, description }: IEmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      {Icon != null && (
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised">
          <Icon size={28} color={colors.contentTertiary} />
        </View>
      )}
      <Text className="text-center text-[16px] font-semibold leading-5 text-content">
        {title}
      </Text>
      {description != null && (
        <Text className="mt-2 text-center text-[13px] leading-4.5 text-content-secondary">
          {description}
        </Text>
      )}
    </View>
  );
}
