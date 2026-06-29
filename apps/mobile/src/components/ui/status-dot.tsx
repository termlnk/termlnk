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

import { View } from 'react-native';

interface IStatusDotProps {
  readonly active: boolean;
  readonly activeColor?: string;
  readonly inactiveColor?: string;
  readonly size?: number;
}

export function StatusDot({
  active,
  activeColor = '#22c55e',
  inactiveColor = '#94a3b8',
  size = 10,
}: IStatusDotProps) {
  return (
    <View className="mr-3 items-center justify-center">
      <View
        className="rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: active ? activeColor : inactiveColor,
        }}
      />
    </View>
  );
}
