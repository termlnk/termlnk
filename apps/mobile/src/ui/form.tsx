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
import { useThemeColors } from '../theme/theme-provider';

// Shared form primitives for the mobile CRUD surfaces. Termius-style grouped rows
// on a raised card with hairline dividers, driven by the semantic theme tokens so
// they adapt to the OS light/dark scheme.

export function FormSection({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  return (
    <View className="mt-5">
      {title != null && (
        <Text className="mb-2 px-4 text-[12px] font-semibold uppercase tracking-wider text-content-tertiary">
          {title}
        </Text>
      )}
      <View className="mx-4 overflow-hidden rounded-2xl bg-surface-raised">
        {children}
      </View>
      {footer != null && (
        <Text className="mt-2 px-4 text-[13px] leading-[18px] text-content-secondary">{footer}</Text>
      )}
    </View>
  );
}

export function FieldRow({ children, last }: { children: ReactNode; last?: boolean }) {
  return (
    <View className={last ? '' : 'border-b border-divider'}>
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

// Stacked label-over-input field (keychain, AI settings, proxy details).
export function TextField(props: ITextFieldProps) {
  const colors = useThemeColors();
  return (
    <FieldRow last={props.last}>
      <View className="px-4 py-2.5">
        <Text className="mb-1 text-[12px] font-medium uppercase tracking-wide text-content-tertiary">
          {props.label}
        </Text>
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor={colors.contentTertiary}
          secureTextEntry={props.secureTextEntry}
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          autoCorrect={false}
          multiline={props.multiline}
          className={`text-[16px] text-content ${props.multiline ? 'min-h-[88px]' : ''}`}
          style={props.multiline ? { textAlignVertical: 'top' } : undefined}
        />
      </View>
    </FieldRow>
  );
}

interface IInlineFieldProps {
  readonly label?: string;
  readonly value: string;
  readonly onChangeText: (v: string) => void;
  readonly placeholder?: string;
  readonly secureTextEntry?: boolean;
  readonly keyboardType?: 'default' | 'numeric' | 'email-address' | 'url';
  readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  readonly trailing?: ReactNode;
}

// Single-row field: optional left label, right-aligned input, optional trailing
// node. Matches the Termius New Host card (Label / IP / Port / Username rows).
export function InlineField(props: IInlineFieldProps) {
  const colors = useThemeColors();
  const hasLabel = props.label != null;
  return (
    <View className="flex-row items-center px-4 py-3.5">
      {hasLabel && <Text className="mr-3 text-[16px] text-content">{props.label}</Text>}
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.contentTertiary}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={false}
        className="flex-1 text-[16px] text-content"
        style={hasLabel ? { textAlign: 'right' } : undefined}
      />
      {props.trailing != null && <View className="ml-3">{props.trailing}</View>}
    </View>
  );
}

export function SwitchField({ label, value, onValueChange, last }: { label: string; value: boolean; onValueChange: (v: boolean) => void; last?: boolean }) {
  const colors = useThemeColors();
  return (
    <FieldRow last={last}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-[16px] text-content">{label}</Text>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.divider, true: colors.accent }}
          thumbColor="#ffffff"
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
        <Text className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-content-tertiary">
          {label}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => onChange(opt.value)}
                className={`rounded-lg px-3 py-1.5 ${active ? 'bg-accent' : 'bg-surface-sunken'}`}
              >
                <Text className={`text-[14px] ${active ? 'font-medium text-accent-content' : 'text-content-secondary'}`}>
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
      <Pressable onPress={onPress} className="flex-row items-center justify-between px-4 py-3.5 active:bg-surface-sunken">
        <Text className="text-[16px] text-content">{label}</Text>
        <Text className="ml-2 text-[15px] text-content-secondary" numberOfLines={1}>{value}</Text>
      </Pressable>
    </FieldRow>
  );
}

export function PrimaryButton({ title, onPress, disabled, busy }: { title: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      className={`flex-row items-center justify-center rounded-2xl py-4 ${disabled || busy ? 'bg-surface-sunken' : 'bg-accent active:opacity-80'}`}
    >
      {busy
        ? <ActivityIndicator color={colors.accentContent} />
        : <Text className={`text-[16px] font-semibold ${disabled ? 'text-content-tertiary' : 'text-accent-content'}`}>{title}</Text>}
    </Pressable>
  );
}

export function DangerButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-center rounded-2xl border border-divider py-4 active:bg-surface-sunken"
    >
      <Text className="text-[16px] font-medium text-danger">{title}</Text>
    </Pressable>
  );
}
