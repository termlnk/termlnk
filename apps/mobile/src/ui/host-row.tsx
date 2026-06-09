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

import type { IMenuAnchor } from './host-action-menu';
import { ChevronRight, MoreHorizontal } from 'lucide-react-native';
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../theme/theme-provider';
import { HostAvatar } from './host-avatar';

interface IHostRowProps {
  readonly id: string;
  readonly label: string;
  readonly type: 'host' | 'group' | 'unknown';
  readonly subtitle?: string; // e.g. "addr:port" for hosts, "5 items" for groups
  readonly trailing?: string; // e.g. "2m ago" for recent sessions
  readonly onPress: () => void;
  // When provided, long-pressing the row (and tapping the host "…" button) requests the
  // action menu, anchored to the measured row rect.
  readonly onRequestMenu?: (anchor: IMenuAnchor) => void;
  // Swaps the subtitle for "Connecting…" and spins the avatar ring while connecting.
  readonly connecting?: boolean;
}

export function HostRow(props: IHostRowProps) {
  const colors = useThemeColors();
  const rowRef = useRef<View>(null);

  const requestMenu = () => {
    const node = rowRef.current;
    if (props.onRequestMenu == null || node == null) {
      return;
    }
    node.measureInWindow((x, y, width, height) => props.onRequestMenu?.({ x, y, width, height }));
  };

  const subtitle = props.connecting ? 'Connecting…' : props.subtitle;
  const showMenuButton = props.onRequestMenu != null && props.type !== 'group';

  return (
    <Pressable
      ref={rowRef}
      onPress={props.onPress}
      onLongPress={props.onRequestMenu != null ? requestMenu : undefined}
      className="flex-row items-center px-4 py-3 active:bg-surface-sunken"
    >
      <HostAvatar id={props.id} label={props.label} type={props.type} connecting={props.connecting} />
      <View className="ml-3 flex-1">
        <Text
          numberOfLines={1}
          className="text-[16px] font-medium text-content"
        >
          {props.label}
        </Text>
        {subtitle != null && (
          <Text
            numberOfLines={1}
            className="mt-0.5 text-[13px] text-content-secondary"
          >
            {subtitle}
          </Text>
        )}
      </View>
      {props.trailing != null && (
        <Text className="ml-2 text-[12px] text-content-tertiary">{props.trailing}</Text>
      )}
      {showMenuButton
        ? (
          <Pressable onPress={requestMenu} hitSlop={10} className="ml-1 p-1 active:opacity-60">
            <MoreHorizontal size={20} color={colors.contentSecondary} />
          </Pressable>
        )
        : <ChevronRight size={18} color={colors.contentTertiary} />}
    </Pressable>
  );
}
