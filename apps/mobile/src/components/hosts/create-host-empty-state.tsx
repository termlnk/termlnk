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

import { Server } from 'lucide-react-native';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useThemeColors } from '../../theme/theme-provider';
import { TextLinkButton } from '../ui/buttons';
import { PrimaryButton } from '../ui/form';

interface ICreateHostEmptyStateProps {
  readonly onContinue: (addr: string) => void;
  readonly onDiscover: () => void;
}

// The "Create Host" landing shown when the Hosts vault is empty: a big tile, a
// quick IP entry, and a discover shortcut.
export function CreateHostEmptyState({ onContinue, onDiscover }: ICreateHostEmptyStateProps) {
  const colors = useThemeColors();
  const [addr, setAddr] = useState('');
  const trimmed = addr.trim();
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="h-20 w-20 items-center justify-center rounded-3xl bg-surface-raised">
        <Server size={36} color={colors.content} />
      </View>
      <Text className="mt-6 text-[22px] font-bold leading-[28px] text-content">Create Host</Text>
      <Text className="mt-2 px-6 text-center text-[14px] leading-5 text-content-secondary">
        Save your connection details as hosts to connect in one click.
      </Text>

      <TextInput
        value={addr}
        onChangeText={setAddr}
        placeholder="Type IP address or hostname"
        placeholderTextColor={colors.contentTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        onSubmitEditing={() => trimmed.length > 0 && onContinue(trimmed)}
        className="mt-9 w-full rounded-2xl border border-divider px-4 py-3.5 text-[15px] leading-[20px] text-content"
      />

      <View className="mt-4 w-full">
        <PrimaryButton title="Continue" onPress={() => onContinue(trimmed)} disabled={trimmed.length === 0} />
      </View>

      <View className="mt-3">
        <TextLinkButton title="Discover local devices" onPress={onDiscover} />
      </View>
    </View>
  );
}
