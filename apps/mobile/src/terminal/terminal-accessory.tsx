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
import { DEFAULT_PREFERENCES } from '@termlnk/database-mobile';
import { ALL_THEMES } from '@termlnk/themes';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Braces, ChevronLeft, CircleX, Clock, Keyboard, LayoutGrid, Minus, Palette, Plus, Settings, TerminalSquare } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useObservable, usePreferencesService } from '../core/core-context';
import { KeyboardHideIcon } from './keyboard-hide-icon';
import { ARROW_KEYS, KEY_GRID } from './terminal-keys';
import { ThemeMiniCard } from './theme-mini-card';

// The terminal keeps its own dark identity independent of the OS chrome theme
// (it sits next to the always-dark xterm WebView), so its palette is fixed here.
const TERM = {
  bg: '#161a23',
  key: '#252b37',
  keyActive: '#30374a',
  text: '#c8ccd4',
  muted: '#6b727f',
  green: '#34d399',
  pillBg: '#15392b',
  border: '#2a3140',
};

type Panel = 'keys' | 'snippets' | 'history' | 'theme';

interface ITerminalAccessoryProps {
  readonly onKey: (seq: string) => void;
  readonly hostLabel: string;
  readonly onBack: () => void;
  readonly onClose: () => void;
  readonly onToggleKeyboard: () => void;
  readonly fontSize: number;
  readonly onFontDelta: (delta: number) => void;
  readonly onSetThemeLive?: (themeName: string) => void;
}

const ARROW_ICONS: Record<string, LucideIcon> = {
  left: ArrowLeft,
  up: ArrowUp,
  down: ArrowDown,
  right: ArrowRight,
};

export function TerminalAccessory(props: ITerminalAccessoryProps) {
  const [panel, setPanel] = useState<Panel>('keys');
  const [collapsed, setCollapsed] = useState(false);

  const onToggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <View style={{ backgroundColor: TERM.bg, borderTopColor: TERM.border, borderTopWidth: 1 }}>
      <HostBar
        hostLabel={props.hostLabel}
        onBack={props.onBack}
        onClose={props.onClose}
        onToggleKeyboard={props.onToggleKeyboard}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />

      {!collapsed && (
        <>
          <View style={{ height: 320 }}>
            {panel === 'keys' && <KeysPanel onKey={props.onKey} />}
            {panel === 'snippets' && <SnippetsPanel />}
            {panel === 'history' && <PlaceholderPanel title="No history yet" subtitle="Commands you run will appear here." />}
            {panel === 'theme' && (
              <ThemePanel
                fontSize={props.fontSize}
                onFontDelta={props.onFontDelta}
                onSetThemeLive={props.onSetThemeLive}
              />
            )}
          </View>

          <BottomToolbar panel={panel} onSelect={setPanel} onToggleCollapse={onToggleCollapse} />
        </>
      )}
    </View>
  );
}

function HostBar({ hostLabel, onBack, onClose, onToggleKeyboard, collapsed, onToggleCollapse }: { hostLabel: string; onBack: () => void; onClose: () => void; onToggleKeyboard: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <View className="flex-row items-center px-3 py-1.5" style={collapsed ? { paddingBottom: 20 } : undefined}>
      <ToolButton icon={ChevronLeft} onPress={onBack} />
      <View
        className="mx-2 h-9 flex-1 flex-row items-center rounded-lg px-3"
        style={{ backgroundColor: TERM.pillBg }}
      >
        <TerminalSquare size={16} color={TERM.green} />
        <Text className="ml-2 flex-1 text-[14px] font-medium" style={{ color: TERM.green }} numberOfLines={1}>{hostLabel}</Text>
        <Pressable onPress={onClose} hitSlop={8} className="active:opacity-60">
          <CircleX size={16} color={TERM.green} />
        </Pressable>
      </View>
      <ToolButton icon={Plus} onPress={() => Alert.alert('New session', 'Opening additional sessions is coming soon.')} />
      <View className="w-1.5" />
      <ToolButton icon={Keyboard} onPress={collapsed ? onToggleCollapse : onToggleKeyboard} />
    </View>
  );
}

function ToolButton({ icon: Icon, onPress }: { icon: LucideIcon; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-xl active:opacity-70"
      style={{ backgroundColor: TERM.key }}
    >
      <Icon size={18} color={TERM.text} />
    </Pressable>
  );
}

function KeysPanel({ onKey }: { onKey: (seq: string) => void }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 8 }} keyboardShouldPersistTaps="always">
      <View className="mb-2 flex-row gap-2">
        <WideButton icon={Settings} label="Customize" onPress={() => Alert.alert('Customize', 'Keyboard customization is coming soon.')} />
        <WideButton icon={Keyboard} label="Password" onPress={() => Alert.alert('Password', 'Credential autofill is coming soon.')} />
      </View>

      <View className="mb-2 flex-row gap-1.5">
        {ARROW_KEYS.map((arrow) => {
          const Icon = ARROW_ICONS[arrow.dir]!;
          return (
            <Pressable
              key={arrow.dir}
              onPress={() => onKey(arrow.seq)}
              className="h-10 flex-1 items-center justify-center rounded-lg active:opacity-70"
              style={{ backgroundColor: TERM.key }}
            >
              <Icon size={16} color={TERM.text} />
            </Pressable>
          );
        })}
      </View>

      {KEY_GRID.map((row) => {
        const rowKey = row.map((cap) => cap.label).join(',');
        return (
          <View key={rowKey} className="mb-1.5 flex-row gap-1.5">
            {row.map((cap) => (
              <Pressable
                key={`${rowKey}:${cap.label}`}
                onPress={() => (cap.seq != null ? onKey(cap.seq) : undefined)}
                disabled={cap.placeholder}
                className="h-11 flex-1 items-center justify-center rounded-lg active:opacity-70"
                style={{ backgroundColor: TERM.key, opacity: cap.placeholder ? 0.4 : 1 }}
              >
                <Text className="text-center text-[13px]" style={{ color: TERM.text }}>{cap.label}</Text>
              </Pressable>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function WideButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-10 flex-1 flex-row items-center justify-center rounded-lg active:opacity-70"
      style={{ backgroundColor: TERM.key }}
    >
      <Icon size={16} color={TERM.muted} />
      <Text className="ml-2 text-[14px]" style={{ color: TERM.text }}>{label}</Text>
    </Pressable>
  );
}

function SnippetsPanel() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: TERM.key }}>
        <Braces size={28} color={TERM.green} />
      </View>
      <Text className="mt-4 text-center text-[16px] font-semibold" style={{ color: TERM.green }}>There are no snippets</Text>
      <Text className="mt-2 text-center text-[13px] leading-5" style={{ color: TERM.muted }}>
        Save your frequently used commands as Snippets for easy execution in the future.
      </Text>
      <Pressable
        onPress={() => Alert.alert('Snippets', 'Creating snippets is coming soon.')}
        className="mt-5 w-full items-center rounded-xl py-3 active:opacity-70"
        style={{ backgroundColor: TERM.key }}
      >
        <Text className="text-[15px] font-medium" style={{ color: TERM.green }}>Create snippet</Text>
      </Pressable>
    </View>
  );
}

function PlaceholderPanel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Clock size={28} color={TERM.muted} />
      <Text className="mt-4 text-center text-[16px] font-semibold" style={{ color: TERM.text }}>{title}</Text>
      <Text className="mt-2 text-center text-[13px] leading-5" style={{ color: TERM.muted }}>{subtitle}</Text>
    </View>
  );
}

function ThemePanel({ fontSize, onFontDelta, onSetThemeLive }: { fontSize: number; onFontDelta: (delta: number) => void; onSetThemeLive?: (themeName: string) => void }) {
  const prefsService = usePreferencesService();
  const prefs = useObservable(prefsService.prefs$, DEFAULT_PREFERENCES);
  const currentThemeName = prefs.terminalThemeName;

  const handleThemeSelect = useCallback((themeName: string) => {
    if (onSetThemeLive) {
      onSetThemeLive(themeName);
    }
  }, [onSetThemeLive]);

  const paddedThemes = useMemo(() => {
    const remainder = ALL_THEMES.length % 3;
    if (remainder === 0) {
      return ALL_THEMES;
    }
    const placeholders = Array.from({ length: 3 - remainder }, (_, i) => ({
      _placeholder: true as const,
      key: `__pad_${i}`,
    }));
    return [...ALL_THEMES, ...placeholders] as ((typeof ALL_THEMES)[number] | { _placeholder: true; key: string })[];
  }, []);

  const renderItem = useCallback(({ item }: { item: (typeof ALL_THEMES)[number] | { _placeholder: true; key: string } }) => {
    if ('_placeholder' in item) {
      return <View className="flex-1" />;
    }
    return (
      <ThemeMiniCard
        theme={item}
        selected={item.name === currentThemeName}
        onPress={() => handleThemeSelect(item.name)}
      />
    );
  }, [currentThemeName, handleThemeSelect]);

  const keyExtractor = useCallback((t: (typeof ALL_THEMES)[number] | { _placeholder: true; key: string }) => {
    if ('_placeholder' in t) {
      return t.key;
    }
    return t.name;
  }, []);

  const listHeader = useMemo(() => (
    <>
      <View className="flex-row gap-2">
        <View className="flex-1 flex-row items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: TERM.key }}>
          <Pressable onPress={() => onFontDelta(-1)} hitSlop={8} className="active:opacity-60"><Minus size={18} color={TERM.text} /></Pressable>
          <Text className="text-[15px] font-medium" style={{ color: TERM.text }}>
            {fontSize}
            pt
          </Text>
          <Pressable onPress={() => onFontDelta(1)} hitSlop={8} className="active:opacity-60"><Plus size={18} color={TERM.text} /></Pressable>
        </View>
      </View>
      <Text className="mt-2 text-[12px]" style={{ color: TERM.muted }}>Font size and theme changes are live.</Text>
    </>
  ), [fontSize, onFontDelta]);

  return (
    <FlatList
      numColumns={3}
      showsVerticalScrollIndicator={false}
      data={paddedThemes}
      keyExtractor={keyExtractor}
      columnWrapperStyle={{ gap: 8, marginTop: 10 }}
      contentContainerStyle={{ padding: 12 }}
      ListHeaderComponent={listHeader}
      renderItem={renderItem}
    />
  );
}

function BottomToolbar({ panel, onSelect, onToggleCollapse }: { panel: Panel; onSelect: (p: Panel) => void; onToggleCollapse: () => void }) {
  return (
    <View className="flex-row items-center justify-around border-t px-2 py-2" style={{ borderColor: TERM.border, paddingBottom: 20 }}>
      <TabIcon icon={LayoutGrid} active={panel === 'keys'} onPress={() => onSelect('keys')} />
      <TabIcon icon={Braces} active={panel === 'snippets'} onPress={() => onSelect('snippets')} />
      <TabIcon icon={Clock} active={panel === 'history'} onPress={() => onSelect('history')} />
      <TabIcon icon={Palette} active={panel === 'theme'} onPress={() => onSelect('theme')} />
      <Pressable
        onPress={onToggleCollapse}
        className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70"
      >
        <KeyboardHideIcon size={24} color={TERM.muted} />
      </Pressable>
    </View>
  );
}

function TabIcon({ icon: Icon, active, onPress }: { icon: LucideIcon; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70"
      style={{ backgroundColor: active ? TERM.keyActive : 'transparent' }}
    >
      <Icon size={20} color={active ? TERM.green : TERM.muted} />
    </Pressable>
  );
}
