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
import { ActivityIndicator, Pressable, View } from 'react-native';
import { cn } from '../../lib/cn';
import { useThemeColors } from '../../theme/theme-provider';

interface IModalHeaderButtonProps {
  readonly icon: LucideIcon;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
  readonly variant?: 'secondary' | 'accent';
  readonly disabled?: boolean;
  readonly loading?: boolean;
}

export function ModalHeaderButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  variant = 'secondary',
  disabled,
  loading,
}: IModalHeaderButtonProps) {
  const colors = useThemeColors();
  const interactive = disabled !== true && loading !== true;
  const isAccent = variant === 'accent';
  const iconColor = interactive
    ? (isAccent ? colors.accentContent : colors.contentSecondary)
    : colors.contentTertiary;

  return (
    <Pressable
      onPress={interactive ? onPress : undefined}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !interactive, busy: loading === true }}
      className={cn({ 'active:opacity-60': interactive })}
    >
      <View
        className={cn('size-7 items-center justify-center rounded-full', {
          'bg-accent': isAccent && interactive,
          'bg-surface-raised': !isAccent && interactive,
          'bg-surface-sunken': !interactive,
        })}
      >
        {loading === true
          ? <ActivityIndicator size="small" color={colors.accentContent} />
          : <Icon size={18} color={iconColor} />}
      </View>
    </Pressable>
  );
}
