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

import { Pressable, Text } from 'react-native';

interface ITextLinkButtonProps {
  readonly title: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

// Centered accent-text action (e.g. "Discover local devices", "Create snippet").
export function TextLinkButton({ title, onPress, disabled }: ITextLinkButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`items-center py-3 active:opacity-60 ${disabled ? 'opacity-40' : ''}`}
    >
      <Text className="text-[16px] font-semibold text-accent">{title}</Text>
    </Pressable>
  );
}
