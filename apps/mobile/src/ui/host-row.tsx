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

import type { MenuAction } from '@react-native-menu/menu';
import type { IMenuAction, IMenuItem } from './menu-types';
import { MenuView } from '@react-native-menu/menu';
import { ChevronRight, MoreHorizontal } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../theme/theme-provider';
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
  // MenuView can intercept short taps on navigable group rows, so callers opt in
  // only where the native context menu does not block the primary action.
  readonly useNativeMenu?: boolean;
}

function isAction(item: IMenuItem): item is IMenuAction {
  return !('divider' in item);
}

function toNativeActions(items: readonly IMenuItem[]): MenuAction[] {
  const groups: IMenuAction[][] = [];
  let current: IMenuAction[] = [];
  for (const item of items) {
    if ('divider' in item) {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(item);
    }
  }
  if (current.length > 0) {
    groups.push(current);
  }

  if (groups.length <= 1) {
    return groups.flatMap((g) => g.map(toAction));
  }

  return groups.map((group, i) => ({
    id: `__group_${i}`,
    title: '',
    displayInline: true,
    subactions: group.map(toAction),
  }));
}

function toAction(item: IMenuAction): MenuAction {
  return {
    id: item.key,
    title: item.label,
    image: item.sfSymbol,
    attributes: {
      destructive: item.destructive,
    },
  };
}

function HostRowContent(props: IHostRowProps) {
  const subtitle = props.connecting ? 'Connecting…' : props.subtitle;

  return (
    <>
      <HostAvatar id={props.id} label={props.label} type={props.type} connecting={props.connecting} />
      <View className="ml-3 flex-1">
        <Text numberOfLines={1} className="text-[15px] font-medium leading-[20px] text-content">
          {props.label}
        </Text>
        {subtitle != null && (
          <Text numberOfLines={1} className="mt-0.5 text-[12px] leading-4 text-content-secondary">
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
    items.filter(isAction).map((item) => [item.key, item])
  );

  return (
    <MenuView
      actions={toNativeActions(items)}
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
    && props.menuItems.filter(isAction).length > 0;
  const hasInlineMenu = props.useNativeMenu !== true
    && props.menuItems != null
    && props.menuItems.filter(isAction).length > 0;

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
    props.menuItems!.filter(isAction).map((item) => [item.key, item])
  );

  return (
    <MenuView
      actions={toNativeActions(props.menuItems!)}
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
