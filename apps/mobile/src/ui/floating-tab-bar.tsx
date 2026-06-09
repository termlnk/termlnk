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

import type { Tabs } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import type { ComponentProps } from 'react';
import { CircleUser, SquareTerminal, Vault } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrentUser } from '../core/core-context';
import { useThemeColors } from '../theme/theme-provider';
import { UserAvatar } from './user-avatar';

// Derive the exact tab-bar callback prop type from expo-router's Tabs so we stay
// in sync without deep-importing react-navigation internals.
type ITabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// Approximate rendered height of the floating pill; screens add this (plus the
// bottom inset) as scroll-content padding so nothing hides behind the bar.
export const TAB_BAR_HEIGHT = 64;

const TAB_ICONS: Record<string, LucideIcon> = {
  vaults: Vault,
  connections: SquareTerminal,
  profile: CircleUser,
};

const TAB_LABELS: Record<string, string> = {
  vaults: 'Vaults',
  connections: 'Connections',
  profile: 'Profile',
};

export function FloatingTabBar({ state, navigation }: ITabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const user = useCurrentUser();
  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0 items-center"
      style={{ paddingBottom: insets.bottom + 8 }}
    >
      <View
        className="flex-row items-center rounded-full bg-tabbar p-1.5"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = TAB_ICONS[route.name] ?? Vault;
          const label = TAB_LABELS[route.name] ?? route.name;
          const showUserAvatar = route.name === 'profile' && user != null;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              className={`items-center rounded-full px-7 py-1.5 ${focused ? 'bg-surface-sunken' : ''}`}
            >
              {showUserAvatar
                ? <UserAvatar user={user} size={24} radius={12} />
                : <Icon size={24} color={focused ? colors.content : colors.contentTertiary} />}
              <Text className={`mt-1 text-[11px] ${focused ? 'font-semibold text-content' : 'text-content-tertiary'}`}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
