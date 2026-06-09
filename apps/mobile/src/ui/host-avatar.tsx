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
import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { getAvatarInitial, getAvatarPalette } from '../theme/host-avatar-color';
import { useThemeColors } from '../theme/theme-provider';

interface IHostAvatarProps {
  readonly id: string;
  readonly label: string;
  readonly type: 'host' | 'group' | 'unknown';
  readonly size?: number;
  // Overlays a spinning accent ring while the host's SSH transport is being established.
  readonly connecting?: boolean;
}

export function HostAvatar({ id, label, type, size = 36, connecting = false }: IHostAvatarProps) {
  const colors = useThemeColors();
  const dimension = { width: size, height: size };

  return (
    <View className="items-center justify-center" style={dimension}>
      {type === 'group'
        ? (
          <View
            className="items-center justify-center rounded-xl bg-surface-sunken"
            style={dimension}
          >
            <Folder size={Math.round(size * 0.55)} color={colors.accent} />
          </View>
        )
        : <HostInitial id={id} label={label} size={size} dimension={dimension} />}
      {connecting && <ConnectingRing size={size} color={colors.accent} />}
    </View>
  );
}

function HostInitial({ id, label, size, dimension }: { id: string; label: string; size: number; dimension: { width: number; height: number } }) {
  const { bg, fg } = getAvatarPalette(id);
  return (
    <View
      className="items-center justify-center rounded-xl"
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

// A rounded-square outline with two adjacent accent borders, spun continuously so the lit
// corner sweeps around the avatar — the "connecting" cue from the Termius host list.
function ConnectingRing({ size, color }: { size: number; color: string }) {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotate]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ringSize = size + 8;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        // Ring is 8px larger than the avatar; offset by half that to centre it over the icon.
        top: -4,
        left: -4,
        width: ringSize,
        height: ringSize,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: 'transparent',
        borderTopColor: color,
        borderRightColor: color,
        transform: [{ rotate: spin }],
      }}
    />
  );
}
