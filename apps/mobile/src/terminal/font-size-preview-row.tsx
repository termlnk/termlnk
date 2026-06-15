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

import { Pressable, Text, View } from 'react-native';
import { cn } from '../ui/cn';
import { hapticSelection } from '../ui/haptics';
import { FONT_SIZE_STEPS } from './terminal-config';

export interface IFontSizePreviewRowProps {
  readonly value: number;
  readonly onChange: (size: number) => void;
}

export function FontSizePreviewRow({ value, onChange }: IFontSizePreviewRowProps) {
  return (
    <View className="flex-row items-center justify-around px-4 py-3">
      {FONT_SIZE_STEPS.map((size) => {
        const active = size === value;
        return (
          <Pressable
            key={size}
            onPress={() => {
              hapticSelection();
              onChange(size);
            }}
            className={cn(
              'h-[44px] w-[44px] items-center justify-center rounded-xl',
              { 'border-2 border-accent': active }
            )}
          >
            <Text
              className={cn({
                'font-semibold text-accent': active,
                'text-content-secondary': !active,
              })}
              style={{ fontSize: size }}
            >
              Aa
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
