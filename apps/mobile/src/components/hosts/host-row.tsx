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

import type { IMenuItem } from '../../lib/menu-types';
import { MenuView } from '@react-native-menu/menu';
import { ChevronRight, MoreHorizontal } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { cn } from '../../lib/cn';
import { isMenuAction, toNativeMenuActions } from '../../lib/native-menu';
import { useThemeColors } from '../../theme/theme-provider';
import { HostAvatar } from './host-avatar';

interface IHostRowProps {
  readonly id: string;
  readonly label: string;
  readonly type: 'host' | 'group' | 'unknown';
  readonly subtitle?: string;
  readonly trailing?: string;
  readonly onPress: () => void;
  readonly menuItems?: readonly IMenuItem[];
  readonly connecting?: boolean;
  readonly connected?: boolean;
  readonly error?: string | null;
  readonly useNativeMenu?: boolean;
}

function HostRowContent(props: IHostRowProps) {
  const hasError = props.error != null && props.error.length > 0;
  let subtitle = props.subtitle;
  if (props.connecting) {
    subtitle = 'Connecting…';
  } else if (hasError) {
    subtitle = props.error;
  } else if (props.connected) {
    subtitle = 'Active · 1 session';
  }

  return (
    <>
      <HostAvatar id={props.id} label={props.label} type={props.type} connecting={props.connecting} error={hasError} />
      <View className="ml-3 flex-1">
        <Text numberOfLines={1} className="text-[15px] font-medium leading-[20px] text-content">
          {props.label}
        </Text>
        {subtitle != null && (
          <Text
            numberOfLines={1}
            className={cn('mt-0.5 text-[12px] leading-4', {
              'text-danger': hasError,
              'text-content-secondary': !hasError,
            })}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {props.trailing != null && (
        <Text className="ml-2 text-[11px] leading-[14px] text-content-tertiary">{props.trailing}</Text>
      )}
    </>
  );
}

function NativeMenuButton({ items }: { readonly items: readonly IMenuItem[] }) {
  const colors = useThemeColors();
  const actionLookup = new Map(
    items.filter(isMenuAction).map((item) => [item.key, item])
  );

  return (
    <MenuView
      actions={toNativeMenuActions(items)}
      onPressAction={({ nativeEvent }) => {
        const action = actionLookup.get(nativeEvent.event);
        if (action != null) {
          action.onPress();
        }
      }}
    >
      <View className="mr-2 h-9 w-9 items-center justify-center rounded-full">
        <MoreHorizontal size={22} color={colors.contentTertiary} />
      </View>
    </MenuView>
  );
}

export function HostRow(props: IHostRowProps) {
  const colors = useThemeColors();
  const hasMenu = props.useNativeMenu === true
    && props.menuItems != null
    && props.menuItems.some(isMenuAction);
  const hasInlineMenu = props.useNativeMenu !== true
    && props.menuItems != null
    && props.menuItems.some(isMenuAction);

  if (!hasMenu) {
    return (
      <View className="flex-row items-center">
        <Pressable
          onPress={props.onPress}
          className="flex-1 active:bg-surface-sunken"
        >
          <View className="flex-row items-center px-4 py-3">
            <HostRowContent {...props} />
            {!hasInlineMenu && <ChevronRight size={18} color={colors.contentTertiary} />}
          </View>
        </Pressable>
        {hasInlineMenu && <NativeMenuButton items={props.menuItems!} />}
      </View>
    );
  }

  const actionLookup = new Map(
    props.menuItems!.filter(isMenuAction).map((item) => [item.key, item])
  );

  return (
    <MenuView
      actions={toNativeMenuActions(props.menuItems!)}
      shouldOpenOnLongPress
      onPressAction={({ nativeEvent }) => {
        const action = actionLookup.get(nativeEvent.event);
        if (action != null) {
          action.onPress();
        }
      }}
    >
      <Pressable
        onPress={props.onPress}
        className="active:bg-surface-sunken"
      >
        <View className="flex-row items-center px-4 py-3">
          <HostRowContent {...props} />
          <ChevronRight size={18} color={colors.contentTertiary} />
        </View>
      </Pressable>
    </MenuView>
  );
}
