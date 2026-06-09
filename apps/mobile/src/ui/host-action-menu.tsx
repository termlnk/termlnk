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

// Termius-style floating action menu. A long-press / overflow tap on a list row hands us a
// screen-space anchor; we render a rounded card next to it over a dimmed scrim. Built on the
// RN Modal + built-in Animated API so it needs no native context-menu module. The parent
// mounts this only while open, so each open starts fresh and plays the entry animation.

import type { LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Animated, Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../theme/theme-provider';

export interface IMenuAction {
  readonly key: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onPress: () => void;
  readonly destructive?: boolean;
}

export type IMenuItem = IMenuAction | { readonly key: string; readonly divider: true };

export interface IMenuAnchor {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface IHostActionMenuProps {
  readonly anchor: IMenuAnchor;
  readonly items: readonly IMenuItem[];
  readonly onClose: () => void;
}

const CARD_WIDTH = 248;
const SCREEN_MARGIN = 12;
const ANCHOR_GAP = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function HostActionMenu({ anchor, items, onClose }: IHostActionMenuProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  // Card height is unknown until first layout; until then it stays invisible so it never
  // flashes at the wrong spot before we can flip it above the anchor when needed.
  const [cardHeight, setCardHeight] = useState(0);

  const left = clamp(anchor.x, SCREEN_MARGIN, winW - CARD_WIDTH - SCREEN_MARGIN);
  const belowTop = anchor.y + anchor.height + ANCHOR_GAP;
  const aboveTop = anchor.y - cardHeight - ANCHOR_GAP;
  const bottomLimit = winH - insets.bottom - SCREEN_MARGIN;
  // Prefer dropping below the row; flip above only when the measured card would overrun the
  // screen bottom and there is room above.
  const placeAbove = cardHeight > 0 && belowTop + cardHeight > bottomLimit && aboveTop >= insets.top + SCREEN_MARGIN;
  const top = placeAbove ? aboveTop : belowTop;

  const onLayout = (event: { nativeEvent: { layout: { height: number } } }) => {
    const height = event.nativeEvent.layout.height;
    if (height > 0 && cardHeight === 0) {
      setCardHeight(height);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 8, tension: 120, useNativeDriver: true }),
      ]).start();
    }
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose}>
        <Animated.View
          onLayout={onLayout}
          style={{
            position: 'absolute',
            left,
            top,
            width: CARD_WIDTH,
            opacity,
            transform: [{ scale }],
            backgroundColor: colors.surfaceRaised,
            borderRadius: 16,
            paddingVertical: 6,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: 12,
          }}
        >
          {items.map((item) => {
            if ('divider' in item) {
              return <View key={item.key} className="my-1.5 h-px bg-divider" />;
            }
            const Icon = item.icon;
            const tint = item.destructive ? colors.danger : colors.content;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
                className="flex-row items-center px-4 py-3 active:bg-surface-sunken"
              >
                <Icon size={19} color={tint} />
                <Text
                  className="ml-3 text-[16px]"
                  style={{ color: tint }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
