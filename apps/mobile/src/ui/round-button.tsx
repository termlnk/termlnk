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
import { Pressable } from 'react-native';
import { useThemeColors } from '../theme/theme-provider';

interface IRoundButtonProps {
  readonly icon: LucideIcon;
  readonly onPress: () => void;
  // 'plain' = surface chip (back / X / +), 'accent' = filled blue (confirm).
  readonly variant?: 'plain' | 'accent';
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
}

// The circular header chips Termius floats over the content (back, close, add,
// confirm). 44pt hit target, soft shadow.
export function RoundButton({ icon: Icon, onPress, variant = 'plain', disabled, accessibilityLabel }: IRoundButtonProps) {
  const colors = useThemeColors();
  const accent = variant === 'accent';
  const bg = disabled ? 'bg-surface-sunken' : accent ? 'bg-accent' : 'bg-surface-raised';
  const iconColor = disabled
    ? colors.contentTertiary
    : accent
      ? colors.accentContent
      : colors.content;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={`h-11 w-11 items-center justify-center rounded-full ${bg} active:opacity-80`}
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <Icon size={22} color={iconColor} />
    </Pressable>
  );
}
