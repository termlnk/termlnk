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

import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useThemeColors } from '../../theme/theme-provider';

export interface IAuthFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly icon: LucideIcon;
  readonly editable: boolean;
  readonly secureTextEntry?: boolean;
  readonly trailing?: ReactNode;
  readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  readonly keyboardType?: 'default' | 'email-address';
  readonly textContentType?: 'emailAddress' | 'password' | 'newPassword' | 'name';
}

export function AuthField(props: IAuthFieldProps) {
  const colors = useThemeColors();
  const Icon = props.icon;
  return (
    <View className="rounded-2xl border border-divider bg-field px-4 py-3.5">
      <View className="mb-2 flex-row items-center">
        <Icon size={17} color={colors.contentSecondary} />
        <Text className="ml-2 text-[13px] font-semibold text-content-secondary">
          {props.label}
        </Text>
      </View>
      <View className="flex-row items-center">
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          autoCorrect={false}
          keyboardType={props.keyboardType}
          textContentType={props.textContentType}
          editable={props.editable}
          secureTextEntry={props.secureTextEntry}
          placeholder={props.placeholder}
          placeholderTextColor={colors.contentTertiary}
          className="min-h-[28px] flex-1 p-0 text-[17px] font-medium text-content"
        />
        {props.trailing != null && <View className="ml-2">{props.trailing}</View>}
      </View>
    </View>
  );
}
