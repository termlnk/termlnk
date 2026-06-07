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
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from 'react-native';

// Shared form primitives for the mobile CRUD surfaces. Termius-style grouped rows on a
// one-bg card with a line divider, Base46 palette throughout.

export function FormSection({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  return (
    <View className="mt-5">
      {title != null && (
        <Text className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-grey-fg">
          {title}
        </Text>
      )}
      <View className="mx-4 overflow-hidden rounded-xl border border-line bg-one-bg">
        {children}
      </View>
      {footer != null && (
        <Text className="mt-2 px-4 text-[12px] text-grey-fg">{footer}</Text>
      )}
    </View>
  );
}

export function FieldRow({ children, last }: { children: ReactNode; last?: boolean }) {
  return (
    <View className={last ? '' : 'border-b border-line'}>
      {children}
    </View>
  );
}

interface ITextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (v: string) => void;
  readonly placeholder?: string;
  readonly secureTextEntry?: boolean;
  readonly keyboardType?: 'default' | 'numeric' | 'email-address' | 'url';
  readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  readonly multiline?: boolean;
  readonly last?: boolean;
}

export function TextField(props: ITextFieldProps) {
  return (
    <FieldRow last={props.last}>
      <View className="px-4 py-2.5">
        <Text className="mb-1 text-[11px] font-medium uppercase tracking-wide text-grey-fg">
          {props.label}
        </Text>
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor="#42464e"
          secureTextEntry={props.secureTextEntry}
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          autoCorrect={false}
          multiline={props.multiline}
          className={`text-[15px] text-light-grey ${props.multiline ? 'min-h-[88px]' : ''}`}
          style={props.multiline ? { textAlignVertical: 'top' } : undefined}
        />
      </View>
    </FieldRow>
  );
}

export function SwitchField({ label, value, onValueChange, last }: { label: string; value: boolean; onValueChange: (v: boolean) => void; last?: boolean }) {
  return (
    <FieldRow last={last}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-[15px] text-light-grey">{label}</Text>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#353b45', true: '#61afef' }}
          thumbColor="#6f737b"
        />
      </View>
    </FieldRow>
  );
}

export interface ISelectOption<T extends string> {
  readonly label: string;
  readonly value: T;
}

// Segmented selector — compact inline option pills, fine for small option sets (auth type,
// algorithm, proxy type). Larger lists should use a dedicated picker screen.
export function SegmentedField<T extends string>({ label, value, options, onChange, last }: { label: string; value: T; options: readonly ISelectOption<T>[]; onChange: (v: T) => void; last?: boolean }) {
  return (
    <FieldRow last={last}>
      <View className="px-4 py-2.5">
        <Text className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-grey-fg">
          {label}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => onChange(opt.value)}
                className={`rounded-md px-3 py-1.5 ${active ? 'bg-nord-blue' : 'bg-one-bg2'}`}
              >
                <Text className={`text-[13px] ${active ? 'font-medium text-black' : 'text-grey-fg2'}`}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </FieldRow>
  );
}

// Tappable row that navigates to a picker / sub-screen, showing the current selection.
export function NavField({ label, value, onPress, last }: { label: string; value: string; onPress: () => void; last?: boolean }) {
  return (
    <FieldRow last={last}>
      <Pressable onPress={onPress} className="flex-row items-center justify-between px-4 py-3 active:bg-one-bg2">
        <Text className="text-[15px] text-light-grey">{label}</Text>
        <Text className="ml-2 text-[14px] text-grey-fg2" numberOfLines={1}>{value}</Text>
      </Pressable>
    </FieldRow>
  );
}

export function PrimaryButton({ title, onPress, disabled, busy }: { title: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      className={`flex-row items-center justify-center rounded-xl py-3.5 ${disabled || busy ? 'bg-one-bg2' : 'bg-nord-blue active:opacity-80'}`}
    >
      {busy
        ? <ActivityIndicator color="#1e222a" />
        : <Text className={`text-[15px] font-semibold ${disabled ? 'text-grey-fg' : 'text-black'}`}>{title}</Text>}
    </Pressable>
  );
}

export function DangerButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-center rounded-xl border border-line py-3.5 active:bg-one-bg"
    >
      <Text className="text-[15px] font-medium text-red">{title}</Text>
    </Pressable>
  );
}
