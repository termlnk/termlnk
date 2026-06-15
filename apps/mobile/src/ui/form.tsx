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

import type { VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useThemeColors } from '../theme/theme-provider';
import { cn } from './cn';
import { hapticError, hapticLight, hapticSelection } from './haptics';

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
        <Text className="mt-2 px-4 text-[12px] leading-4 text-content-secondary">{footer}</Text>
      )}
    </View>
  );
}

export function FieldRow({ children, last }: { children: ReactNode; last?: boolean }) {
  return (
    <View>
      {children}
      {!last && <View className="mx-4 h-px bg-divider/50" />}
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
  readonly autoCorrect?: boolean;
  readonly multiline?: boolean;
  readonly last?: boolean;
}

export function TextField(props: ITextFieldProps) {
  const colors = useThemeColors();
  return (
    <FieldRow last={props.last}>
      <View className="px-4 py-2.5">
        <Text className="mb-1 text-[12px] font-medium text-content-tertiary">
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
          autoCorrect={props.autoCorrect}
          multiline={props.multiline}
          className={cn('text-[15px] leading-[20px] text-content', { 'min-h-[88px]': props.multiline })}
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
  readonly autoCorrect?: boolean;
  readonly trailing?: ReactNode;
}

export function InlineField(props: IInlineFieldProps) {
  const colors = useThemeColors();
  const hasLabel = props.label != null;
  return (
    <View className="flex-row items-center px-4 py-3.5">
      {hasLabel && <Text className="mr-3 text-[15px] leading-[20px] text-content">{props.label}</Text>}
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.contentTertiary}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={props.autoCorrect}
        className="flex-1 text-[15px] leading-[20px] text-content"
        style={hasLabel ? fieldStyles.textAlignRight : undefined}
      />
      {props.trailing != null && <View className="ml-3">{props.trailing}</View>}
    </View>
  );
}

export function SwitchField({ label, value, onValueChange, last }: { label: string; value: boolean; onValueChange: (v: boolean) => void; last?: boolean }) {
  const colors = useThemeColors();
  const handleChange = (next: boolean) => {
    hapticLight();
    onValueChange(next);
  };
  return (
    <FieldRow last={last}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-[15px] leading-[20px] text-content">{label}</Text>
        <Switch
          value={value}
          onValueChange={handleChange}
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

export function SegmentedField<T extends string>({ label, value, options, onChange, last }: { label: string; value: T; options: readonly ISelectOption<T>[]; onChange: (v: T) => void; last?: boolean }) {
  const handleChange = (v: T) => {
    hapticSelection();
    onChange(v);
  };
  return (
    <FieldRow last={last}>
      <View className="px-4 py-2.5">
        <Text className="mb-1.5 text-[12px] font-medium text-content-tertiary">
          {label}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => handleChange(opt.value)}
                className={cn('rounded-lg px-3 py-1.5', {
                  'bg-accent': active,
                  'bg-surface-sunken': !active,
                })}
              >
                <Text
                  className={cn('text-[13px] leading-[18px]', {
                    'font-medium text-accent-content': active,
                    'text-content-secondary': !active,
                  })}
                >
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

export function NavField({ label, value, onPress, last }: { label: string; value: string; onPress: () => void; last?: boolean }) {
  const colors = useThemeColors();
  return (
    <FieldRow last={last}>
      <Pressable onPress={onPress} className="flex-row items-center justify-between px-4 py-3.5 active:bg-surface-sunken">
        <Text className="text-[15px] leading-[20px] text-content">{label}</Text>
        <View className="ml-2 flex-row items-center">
          <Text className="text-[14px] leading-[18px] text-content-tertiary" numberOfLines={1}>{value}</Text>
          <ChevronRight size={18} color={colors.contentTertiary} style={{ marginLeft: 4 }} />
        </View>
      </Pressable>
    </FieldRow>
  );
}

interface IPasswordFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (v: string) => void;
  readonly placeholder?: string;
  readonly last?: boolean;
}

export function PasswordField(props: IPasswordFieldProps) {
  const colors = useThemeColors();
  const [revealed, setRevealed] = useState(false);
  const toggleRevealed = () => {
    hapticLight();
    setRevealed((prev) => !prev);
  };
  return (
    <FieldRow last={props.last}>
      <View className="flex-row items-end px-4 py-2.5">
        <View className="flex-1">
          <Text className="mb-1 text-[12px] font-medium text-content-tertiary">
            {props.label}
          </Text>
          <TextInput
            value={props.value}
            onChangeText={props.onChangeText}
            placeholder={props.placeholder}
            placeholderTextColor={colors.contentTertiary}
            secureTextEntry={!revealed}
            autoCapitalize="none"
            autoCorrect={false}
            className="text-[15px] leading-[20px] text-content"
          />
        </View>
        <Pressable onPress={toggleRevealed} className="mb-0.5 ml-3">
          <Text className="text-[13px] font-medium text-accent">
            {revealed ? 'HIDE' : 'SHOW'}
          </Text>
        </Pressable>
      </View>
    </FieldRow>
  );
}

interface ISelectFieldProps {
  readonly label: string;
  readonly displayValue: string;
  readonly onPress: () => void;
  readonly last?: boolean;
}

export function SelectField(props: ISelectFieldProps) {
  const colors = useThemeColors();
  return (
    <FieldRow last={props.last}>
      <Pressable onPress={props.onPress} className="flex-row items-center px-4 py-2.5 active:bg-surface-sunken">
        <View className="flex-1">
          <Text className="mb-1 text-[12px] font-medium text-content-tertiary">
            {props.label}
          </Text>
          <Text className="text-[15px] leading-[20px] text-content">
            {props.displayValue}
          </Text>
        </View>
        <ChevronDown size={18} color={colors.contentTertiary} />
      </Pressable>
    </FieldRow>
  );
}

const primaryButtonVariants = cva(
  'flex-row items-center justify-center rounded-2xl py-3.5',
  {
    variants: {
      state: {
        enabled: 'bg-accent active:opacity-80',
        disabled: 'bg-surface-sunken',
      },
    },
    defaultVariants: { state: 'enabled' },
  }
);

interface IPrimaryButtonProps extends VariantProps<typeof primaryButtonVariants> {
  readonly title: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly className?: string;
}

export function PrimaryButton({ title, onPress, disabled, busy, className }: IPrimaryButtonProps) {
  const colors = useThemeColors();
  const isDisabled = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={cn(
        primaryButtonVariants({ state: isDisabled ? 'disabled' : 'enabled' }),
        className
      )}
    >
      {busy
        ? <ActivityIndicator color={colors.accentContent} />
        : (
          <Text
            className={cn('text-[15px] font-semibold leading-[20px]', {
              'text-content-tertiary': isDisabled,
              'text-accent-content': !isDisabled,
            })}
          >
            {title}
          </Text>
        )}
    </Pressable>
  );
}

export function DangerButton({ title, onPress, className }: { title: string; onPress: () => void; className?: string }) {
  const handlePress = () => {
    hapticError();
    onPress();
  };
  return (
    <Pressable
      onPress={handlePress}
      className={cn('flex-row items-center justify-center rounded-2xl border border-divider py-3.5 active:bg-surface-sunken', className)}
    >
      <Text className="text-[15px] font-medium leading-[20px] text-danger">{title}</Text>
    </Pressable>
  );
}

const fieldStyles = StyleSheet.create({
  textAlignRight: { textAlign: 'right' },
});
