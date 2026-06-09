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
import { View } from 'react-native';

interface IScreenContainerProps {
  readonly children: ReactNode;
  // Pass-through for screens that need to override the default `bg-surface`
  // (e.g. the terminal forces its own dark background).
  readonly className?: string;
}

export function ScreenContainer({ children, className }: IScreenContainerProps) {
  return (
    <View className={`flex-1 bg-surface ${className ?? ''}`}>
      {children}
    </View>
  );
}
