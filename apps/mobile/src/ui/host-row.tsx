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

import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { HostAvatar } from './host-avatar';

interface IHostRowProps {
  readonly id: string;
  readonly label: string;
  readonly type: 'host' | 'group' | 'unknown';
  readonly subtitle?: string; // e.g. "addr:port" for hosts, "5 items" for groups
  readonly trailing?: string; // e.g. "2m ago" for recent sessions
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
}

export function HostRow(props: IHostRowProps) {
  return (
    <Pressable
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      className="flex-row items-center px-4 py-3 active:bg-one-bg"
    >
      <HostAvatar id={props.id} label={props.label} type={props.type} />
      <View className="ml-3 flex-1">
        <Text
          numberOfLines={1}
          className="text-[15px] font-medium text-light-grey"
        >
          {props.label}
        </Text>
        {props.subtitle != null && (
          <Text
            numberOfLines={1}
            className="mt-0.5 text-[12px] text-grey-fg2"
          >
            {props.subtitle}
          </Text>
        )}
      </View>
      {props.trailing != null && (
        <Text className="ml-2 text-[11px] text-grey-fg">{props.trailing}</Text>
      )}
      <ChevronRight size={18} color="#42464e" />
    </Pressable>
  );
}
