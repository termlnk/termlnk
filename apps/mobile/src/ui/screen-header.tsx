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
import { Check, ChevronLeft, X } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoundButton } from './round-button';

interface IScreenHeaderProps {
  // 'modal' = X / title / confirm-check; 'nav' = back / title / right slot;
  // 'large' = big left-aligned title (tab landing pages).
  readonly variant: 'modal' | 'nav' | 'large';
  readonly title: string;
  readonly subtitle?: string;
  readonly onBack?: () => void;
  readonly onClose?: () => void;
  readonly onConfirm?: () => void;
  readonly confirmDisabled?: boolean;
  readonly right?: ReactNode;
}

export function ScreenHeader(props: IScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  if (props.variant === 'large') {
    return (
      <View style={{ paddingTop: insets.top + 8 }} className="px-5 pb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-[32px] font-bold text-content">{props.title}</Text>
          {props.right}
        </View>
      </View>
    );
  }

  const left = props.variant === 'modal'
    ? <RoundButton icon={X} onPress={props.onClose ?? (() => {})} accessibilityLabel="Close" />
    : props.onBack != null
      ? <RoundButton icon={ChevronLeft} onPress={props.onBack} accessibilityLabel="Back" />
      : <View className="h-11 w-11" />;

  const right = props.variant === 'modal'
    ? (
      <RoundButton
        icon={Check}
        variant="accent"
        onPress={props.onConfirm ?? (() => {})}
        disabled={props.confirmDisabled}
        accessibilityLabel="Save"
      />
    )
    : (props.right ?? <View className="h-11 w-11" />);

  return (
    <View style={{ paddingTop: insets.top + 6 }} className="px-4 pb-2">
      <View className="h-11 flex-row items-center justify-between">
        {left}
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <Text className="text-[17px] font-semibold text-content">{props.title}</Text>
          {props.subtitle != null && (
            <Text className="text-[13px] text-content-secondary">{props.subtitle}</Text>
          )}
        </View>
        {right}
      </View>
    </View>
  );
}
