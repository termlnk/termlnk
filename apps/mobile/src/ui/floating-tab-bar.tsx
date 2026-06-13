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
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrentUser } from '../core/core-context';
import { useThemeColors } from '../theme/theme-provider';
import { cn } from './cn';
import { hapticLight } from './haptics';
import { UserAvatar } from './user-avatar';

type ITabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TAB_BAR_HEIGHT = 64;

// SF Symbol names for iOS native rendering; Android falls back to lucide.
const SF_SYMBOLS: Record<string, string> = {
  vaults: 'lock.shield.fill',
  connections: 'terminal.fill',
  profile: 'person.crop.circle.fill',
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SymbolView = Platform.OS === 'ios' ? require('expo-symbols').SymbolView : null;

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

function TabIcon({ routeName, focused, color, size }: {
  readonly routeName: string;
  readonly focused: boolean;
  readonly color: string;
  readonly size: number;
}) {
  if (Platform.OS === 'ios' && SymbolView != null && SF_SYMBOLS[routeName] != null) {
    return (
      <SymbolView
        name={SF_SYMBOLS[routeName]}
        tintColor={color}
        style={{ width: size, height: size }}
        weight={focused ? 'semibold' : 'regular'}
      />
    );
  }
  const Icon = TAB_ICONS[routeName] ?? Vault;
  return <Icon size={size} color={color} />;
}

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
          const label = TAB_LABELS[route.name] ?? route.name;
          const showUserAvatar = route.name === 'profile' && user != null;
          const iconColor = focused ? colors.content : colors.contentTertiary;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              hapticLight();
              navigation.navigate(route.name);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              className={cn('items-center rounded-full px-7 py-1.5', { 'bg-surface-sunken': focused })}
            >
              {showUserAvatar
                ? <UserAvatar user={user} size={24} radius={12} />
                : <TabIcon routeName={route.name} focused={focused} color={iconColor} size={24} />}
              <Text
                className={cn('mt-1 text-[11px]', {
                  'font-semibold text-content': focused,
                  'text-content-tertiary': !focused,
                })}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
