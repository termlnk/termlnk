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
import { Search } from 'lucide-react-native';
import { TextInput, View } from 'react-native';
import { useThemeColors } from '../theme/theme-provider';

interface ISearchFieldProps {
  readonly value: string;
  readonly onChangeText: (next: string) => void;
  readonly placeholder?: string;
  // Optional trailing action (e.g. the Connections "CONNECT" button).
  readonly trailing?: ReactNode;
  readonly autoFocus?: boolean;
  readonly onSubmitEditing?: () => void;
}

// The rounded pill search bar at the top of list screens.
export function SearchField(props: ISearchFieldProps) {
  const colors = useThemeColors();
  return (
    <View
      className="flex-row items-center rounded-2xl bg-surface-raised px-4"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <Search size={18} color={colors.contentTertiary} />
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder ?? 'Search'}
        placeholderTextColor={colors.contentTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={props.autoFocus}
        onSubmitEditing={props.onSubmitEditing}
        returnKeyType={props.onSubmitEditing != null ? 'go' : 'search'}
        className="ml-2 flex-1 py-3 text-[15px] leading-[20px] text-content"
      />
      {props.trailing}
    </View>
  );
}
