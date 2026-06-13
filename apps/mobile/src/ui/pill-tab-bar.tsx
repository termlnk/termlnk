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

import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../theme/theme-provider';
import { hapticSelection } from './haptics';

interface ITab<T extends string> {
  readonly label: string;
  readonly value: T;
}

interface IPillTabBarProps<T extends string> {
  readonly tabs: readonly ITab<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly className?: string;
}

export function PillTabBar<T extends string>({ tabs, value, onChange, className }: IPillTabBarProps<T>) {
  const colors = useThemeColors();
  const activeIndex = tabs.findIndex((t) => t.value === value);
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: activeIndex,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [activeIndex, slideAnim]);

  const handlePress = (v: T) => {
    if (v !== value) {
      hapticSelection();
      onChange(v);
    }
  };

  const count = tabs.length;
  const pillWidth = `${(100 / count).toFixed(2)}%`;
  const inputRange = tabs.map((_, i) => i);
  const outputRange = tabs.map((_, i) => {
    const segmentPct = 100 / count;
    const offsetPct = segmentPct * i + segmentPct * 0.03;
    return `${offsetPct.toFixed(2)}%`;
  });

  return (
    <View className={`h-[36px] flex-row items-center overflow-hidden rounded-full bg-surface-sunken ${className ?? ''}`}>
      <Animated.View
        className="absolute h-[30px] rounded-full"
        style={{
          backgroundColor: colors.accent,
          width: pillWidth,
          top: 3,
          left: slideAnim.interpolate({ inputRange, outputRange }),
        }}
      />
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => handlePress(tab.value)}
            className="h-full flex-1 items-center justify-center"
          >
            <Text
              className="text-[13px] font-semibold"
              style={{ color: active ? colors.accentContent : colors.contentSecondary }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
