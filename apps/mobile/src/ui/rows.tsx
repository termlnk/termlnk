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

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Switch, Text, View } from 'react-native';
import { useThemeColors } from '../theme/theme-provider';

// Shared grouped-list rows used inside `Card`. `leading` is an arbitrary node so
// callers pass an IconTile, a bare icon, or a HostAvatar as the row dictates.

interface INavRowProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly value?: string;
  readonly leading?: ReactNode;
  // Custom trailing node; takes precedence over `value`/chevron when set.
  readonly trailing?: ReactNode;
  readonly onPress: () => void;
  readonly showChevron?: boolean;
  readonly chevronTone?: 'muted' | 'accent';
  // Placeholder rows for not-yet-backed features: dimmed and inert.
  readonly disabled?: boolean;
}

export function NavRow(props: INavRowProps) {
  const colors = useThemeColors();
  const showChevron = props.showChevron ?? true;
  const chevronColor = props.chevronTone === 'accent' ? colors.accent : colors.contentTertiary;
  return (
    <Pressable
      onPress={props.disabled ? undefined : props.onPress}
      disabled={props.disabled}
      className={`flex-row items-center px-4 py-3.5 active:bg-surface-sunken ${props.disabled ? 'opacity-40' : ''}`}
    >
      {props.leading != null && <View className="mr-3">{props.leading}</View>}
      <View className="flex-1">
        <Text className="text-[16px] text-content" numberOfLines={1}>{props.title}</Text>
        {props.subtitle != null && (
          <Text className="mt-0.5 text-[13px] text-content-secondary" numberOfLines={1}>{props.subtitle}</Text>
        )}
      </View>
      {props.trailing != null
        ? <View className="ml-2">{props.trailing}</View>
        : (
          <>
            {props.value != null && (
              <Text className="ml-2 text-[15px] text-content-secondary" numberOfLines={1}>{props.value}</Text>
            )}
            {showChevron && <ChevronRight size={20} color={chevronColor} />}
          </>
        )}
    </Pressable>
  );
}

interface ISwitchRowProps {
  readonly title: string;
  readonly description?: string;
  readonly leading?: ReactNode;
  readonly value: boolean;
  readonly onValueChange: (next: boolean) => void;
  readonly disabled?: boolean;
}

export function SwitchRow(props: ISwitchRowProps) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center px-4 py-3">
      {props.leading != null && <View className="mr-3">{props.leading}</View>}
      <View className="mr-3 flex-1">
        <Text className="text-[16px] text-content">{props.title}</Text>
        {props.description != null && (
          <Text className="mt-0.5 text-[13px] leading-[18px] text-content-secondary">{props.description}</Text>
        )}
      </View>
      <Switch
        value={props.value}
        onValueChange={props.onValueChange}
        disabled={props.disabled}
        trackColor={{ false: colors.divider, true: colors.accent }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

interface IValueRowProps {
  readonly title: string;
  readonly value: string;
  readonly leading?: ReactNode;
}

export function ValueRow(props: IValueRowProps) {
  return (
    <View className="flex-row items-center px-4 py-3.5">
      {props.leading != null && <View className="mr-3">{props.leading}</View>}
      <Text className="flex-1 text-[16px] text-content">{props.title}</Text>
      <Text className="ml-2 text-[15px] text-content-secondary" numberOfLines={1}>{props.value}</Text>
    </View>
  );
}
