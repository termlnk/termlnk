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
import { Pressable, Text, View } from 'react-native';
import { cn } from '../../lib/cn';
import { useThemeColors } from '../../theme/theme-provider';

interface IToolbarIconButtonProps {
  readonly icon: LucideIcon;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly badge?: string;
  readonly accessibilityLabel: string;
}

export function ToolbarIconButton({ icon: Icon, onPress, disabled, badge, accessibilityLabel }: IToolbarIconButtonProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      className={cn('h-8 w-8 items-center justify-center rounded-lg', {
        'opacity-30': !!disabled,
        'active:bg-surface-sunken': !disabled,
      })}
    >
      <Icon size={16} color={colors.contentSecondary} />
      {badge != null
        ? (
          <View className="absolute -right-0.5 -top-0.5 min-w-[16px] items-center justify-center rounded-full bg-accent px-1" style={{ height: 16 }}>
            <Text className="text-[9px] font-bold" style={{ color: colors.accentContent }}>
              {badge}
            </Text>
          </View>
        )
        : null}
    </Pressable>
  );
}
