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
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { getAvatarInitial, getAvatarPalette } from '../../lib/host-avatar-color';
import { useThemeColors } from '../../theme/theme-provider';

interface IHostAvatarProps {
  readonly id: string;
  readonly label: string;
  readonly type: 'host' | 'group' | 'unknown';
  readonly size?: number;
  // Overlays a spinning accent ring while the host's SSH transport is being established.
  readonly connecting?: boolean;
  // Overlays a static danger-colored ring when the last connection attempt failed.
  readonly error?: boolean;
}

export function HostAvatar({ id, label, type, size = 36, connecting = false, error = false }: IHostAvatarProps) {
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
      {connecting && <ConnectingRing size={size} />}
      {!connecting && error && <ErrorRing size={size} />}
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

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// A rounded-square gradient stroke segment that advances along the avatar outline.
function ConnectingRing({ size }: { size: number }) {
  const dashOffset = useRef(new Animated.Value(0)).current;
  const gradientId = useRef(`hostConnectingRing${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(dashOffset, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [dashOffset]);

  const ringSize = size + 8;
  const strokeWidth = 4;
  const inset = strokeWidth / 2;
  const rectSize = ringSize - strokeWidth;
  const radius = Math.round(size * 0.34) + 4;
  const straightLength = Math.max(0, rectSize - radius * 2);
  const perimeter = straightLength * 4 + 2 * Math.PI * radius;
  const dashLength = perimeter * 0.38;
  const gapLength = perimeter - dashLength;
  const movingOffset = dashOffset.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -perimeter],
  });

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -4,
        left: -4,
        width: ringSize,
        height: ringSize,
      }}
    >
      <Svg
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2={ringSize} y2={ringSize}>
            <Stop offset="0" stopColor="#1d4ed8" stopOpacity="0.2" />
            <Stop offset="0.22" stopColor="#2563eb" stopOpacity="1" />
            <Stop offset="0.58" stopColor="#06b6d4" stopOpacity="1" />
            <Stop offset="0.9" stopColor="#8b5cf6" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#8b5cf6" stopOpacity="0.25" />
          </LinearGradient>
        </Defs>
        <Rect
          x={inset}
          y={inset}
          width={rectSize}
          height={rectSize}
          rx={radius}
          ry={radius}
          fill="none"
          stroke="#bfdbfe"
          strokeWidth={2.5}
          strokeOpacity={0.85}
        />
        <AnimatedRect
          x={inset}
          y={inset}
          width={rectSize}
          height={rectSize}
          rx={radius}
          ry={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={[dashLength, gapLength]}
          strokeDashoffset={movingOffset}
        />
      </Svg>
    </View>
  );
}

function ErrorRing({ size }: { size: number }) {
  const colors = useThemeColors();
  const ringSize = size + 8;
  const strokeWidth = 2.5;
  const inset = strokeWidth / 2;
  const rectSize = ringSize - strokeWidth;
  const radius = Math.round(size * 0.34) + 4;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -4,
        left: -4,
        width: ringSize,
        height: ringSize,
      }}
    >
      <Svg
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
      >
        <Rect
          x={inset}
          y={inset}
          width={rectSize}
          height={rectSize}
          rx={radius}
          ry={radius}
          fill="none"
          stroke={colors.danger}
          strokeWidth={strokeWidth}
          strokeOpacity={0.85}
        />
      </Svg>
    </View>
  );
}
