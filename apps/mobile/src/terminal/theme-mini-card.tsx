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

import type { ITheme } from '@termlnk/themes';
import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { cn } from '../ui/cn';

export interface IThemeMiniCardProps {
  readonly theme: ITheme;
  readonly selected: boolean;
  readonly width?: number;
  readonly onPress: () => void;
}

export function ThemeMiniCard({ theme, selected, width, onPress }: IThemeMiniCardProps) {
  const { base_30, base_16 } = theme;
  const bg = base_16.base00 ?? base_30.black;
  const fg = base_16.base05 ?? base_30.white;

  return (
    <Pressable onPress={onPress} style={width != null ? { width } : undefined} className={cn('active:opacity-80', { 'flex-1': width == null })}>
      <View className="relative">
        <View
          className={cn('h-[55px] overflow-hidden rounded-lg p-1.5', {
            'border-2 border-accent': selected,
            'border border-divider/30': !selected,
          })}
          style={{ backgroundColor: bg }}
        >
          <TerminalLine color={base_30.green} fg={fg} text="$ ssh root@host" />
          <TerminalLine color={base_30.blue} fg={fg} text="Last login: Mon" />
          <TerminalLine color={base_30.red} fg={fg} text="$ ls -la" />
          <TerminalLine color={base_30.yellow} fg={fg} text="drwxr-xr-x 5" />
        </View>
        {selected && (
          <View className="absolute -bottom-1.5 -right-1.5 h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-accent">
            <Check size={10} color="#ffffff" strokeWidth={3} />
          </View>
        )}
      </View>
      <Text
        className="mt-1 text-center text-[11px] text-content-secondary"
        numberOfLines={1}
      >
        {theme.name.replace(/-/g, ' ')}
      </Text>
    </Pressable>
  );
}

function TerminalLine({ color, fg, text }: { color: string; fg: string; text: string }) {
  return (
    <View className="flex-row">
      <Text style={{ color, fontSize: 7, lineHeight: 14, fontFamily: 'Menlo' }} numberOfLines={1}>
        {text.slice(0, 2)}
      </Text>
      <Text style={{ color: fg, fontSize: 7, lineHeight: 14, fontFamily: 'Menlo' }} numberOfLines={1}>
        {text.slice(2)}
      </Text>
    </View>
  );
}
