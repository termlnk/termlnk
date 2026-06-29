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

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { cn } from '../../lib/cn';

interface IMessageCardProps {
  readonly message: string;
  readonly tone?: 'muted' | 'error';
  readonly leading?: ReactNode;
  readonly className?: string;
}

export function MessageCard({ message, tone = 'muted', leading, className }: IMessageCardProps) {
  return (
    <View className={cn('flex-row items-center rounded-2xl bg-surface-raised px-4 py-3', className)}>
      {leading}
      <Text
        className={cn(
          'text-[13px] leading-[18px]',
          {
            'text-content-secondary': tone === 'muted',
            'text-danger': tone === 'error',
          },
          { 'ml-2 flex-1': leading != null }
        )}
      >
        {message}
      </Text>
    </View>
  );
}
