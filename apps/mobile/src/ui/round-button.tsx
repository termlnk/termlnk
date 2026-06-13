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

import type { VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react-native';
import { cva } from 'class-variance-authority';
import { Pressable } from 'react-native';
import { useThemeColors } from '../theme/theme-provider';
import { cn } from './cn';

const roundButtonVariants = cva(
  'h-11 w-11 items-center justify-center rounded-full active:opacity-80',
  {
    variants: {
      variant: {
        plain: 'bg-surface-raised',
        accent: 'bg-accent',
      },
    },
    defaultVariants: { variant: 'plain' },
  }
);

interface IRoundButtonProps extends VariantProps<typeof roundButtonVariants> {
  readonly icon: LucideIcon;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
  readonly className?: string;
}

export function RoundButton({ icon: Icon, onPress, variant = 'plain', disabled, accessibilityLabel, className }: IRoundButtonProps) {
  const colors = useThemeColors();
  const iconColor = disabled
    ? colors.contentTertiary
    : variant === 'accent'
      ? colors.accentContent
      : colors.content;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={cn(
        roundButtonVariants({ variant }),
        { 'bg-surface-sunken': disabled },
        className
      )}
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
