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

import { Folder } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { getAvatarInitial, getAvatarPalette } from '../theme/host-avatar-color';

interface IHostAvatarProps {
  readonly id: string;
  readonly label: string;
  readonly type: 'host' | 'group' | 'unknown';
  readonly size?: number;
}

export function HostAvatar({ id, label, type, size = 36 }: IHostAvatarProps) {
  const dimension = { width: size, height: size };

  if (type === 'group') {
    return (
      <View
        className="items-center justify-center rounded-lg bg-one-bg2"
        style={dimension}
      >
        <Folder size={Math.round(size * 0.55)} color="#61afef" />
      </View>
    );
  }

  const { bg, fg } = getAvatarPalette(id);
  return (
    <View
      className="items-center justify-center rounded-full"
      style={[dimension, { backgroundColor: bg }]}
    >
      <Text
        className="font-semibold"
        style={{ color: fg, fontSize: Math.round(size * 0.42) }}
      >
        {getAvatarInitial(label)}
      </Text>
    </View>
  );
}
