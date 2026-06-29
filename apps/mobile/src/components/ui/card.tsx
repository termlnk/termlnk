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

import type { ReactElement, ReactNode } from 'react';
import { Children, Fragment } from 'react';
import { View } from 'react-native';
import { cn } from '../../lib/cn';

interface ICardProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly dividerInset?: number;
}

export function Card({ children, className, dividerInset = 16 }: ICardProps) {
  // eslint-disable-next-line react/no-children-to-array
  const items = Children.toArray(children).filter(Boolean) as ReactElement[];
  return (
    <View
      className={cn('overflow-hidden rounded-2xl bg-surface-raised', className)}
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      {items.map((child, index) => (
        <Fragment key={child.key ?? index}>
          {index > 0 && <View className="h-px bg-divider" style={{ marginLeft: dividerInset }} />}
          {child}
        </Fragment>
      ))}
    </View>
  );
}
