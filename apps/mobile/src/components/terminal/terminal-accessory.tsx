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
import { ALL_THEMES, THEME_MAP } from '@termlnk/themes';
import { useRouter } from 'expo-router';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Braces, ChevronDown, ChevronLeft, ChevronRight, CircleX, Clock, Keyboard, LayoutGrid, Minus, Palette, Plus, Search, Settings, TerminalSquare } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, TextInput, useColorScheme, View } from 'react-native';
import { useObservable, usePreferencesService, useSnippetRepository } from '../../core/core-context';
import { filterSnippets, groupSnippets } from '../../lib/snippet-utils';
import { ARROW_KEYS, KEY_GRID } from '../../lib/terminal-keys';
import { resolveEffectiveMode } from '../../theme/theme-resolver';
import { KeyboardHideIcon } from './keyboard-hide-icon';
import { ThemeMiniCard } from './theme-mini-card';

interface ITermColors {
  readonly bg: string;
  readonly key: string;
  readonly keyActive: string;
  readonly text: string;
  readonly muted: string;
  readonly accent: string;
  readonly pillBg: string;
  readonly border: string;
}

const TERM_FALLBACK: ITermColors = {
  bg: '#161a23',
  key: '#252b37',
  keyActive: '#30374a',
  text: '#c8ccd4',
  muted: '#6b727f',
  accent: '#61afef',
  pillBg: '#61afef26',
  border: '#2a3140',
};

const TermColorsContext = createContext<ITermColors>(TERM_FALLBACK);

function useTermColors(): ITermColors {
  return useContext(TermColorsContext);
}

function colorsFromThemeName(name: string): ITermColors {
  const theme = THEME_MAP.get(name);
  if (!theme) {
    return TERM_FALLBACK;
  }
  const b = theme.base_30;
  return {
    bg: b.darker_black,
    key: b.one_bg,
    keyActive: b.one_bg2,
    text: b.white,
    muted: b.grey,
    accent: b.blue,
    pillBg: `${b.blue}26`,
    border: b.line,
  };
}

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
  const prefsService = usePreferencesService();
  const prefs = useObservable(prefsService.prefs$, DEFAULT_PREFERENCES);
  const osScheme = useColorScheme();
  const activeSlot = resolveEffectiveMode(prefs.themeMode, osScheme === 'dark' ? 'dark' : 'light');
  const effectiveThemeName = activeSlot === 'dark' ? prefs.darkThemeName : prefs.lightThemeName;
  const termColors = useMemo(() => colorsFromThemeName(effectiveThemeName), [effectiveThemeName]);

  const onToggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <TermColorsContext.Provider value={termColors}>
      <View style={{ backgroundColor: termColors.bg, borderTopColor: termColors.border, borderTopWidth: 1 }}>
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
              {panel === 'snippets' && <SnippetsPanel onKey={props.onKey} />}
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
    </TermColorsContext.Provider>
  );
}

function HostBar({ hostLabel, onBack, onClose, onToggleKeyboard, collapsed, onToggleCollapse }: { hostLabel: string; onBack: () => void; onClose: () => void; onToggleKeyboard: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  const TERM = useTermColors();
  return (
    <View className="flex-row items-center px-3 py-1.5" style={collapsed ? { paddingBottom: 20 } : undefined}>
      <ToolButton icon={ChevronLeft} onPress={onBack} />
      <View
        className="mx-2 h-9 flex-1 flex-row items-center rounded-lg px-3"
        style={{ backgroundColor: TERM.pillBg }}
      >
        <TerminalSquare size={16} color={TERM.accent} />
        <Text className="ml-2 flex-1 text-[14px] font-medium" style={{ color: TERM.accent }} numberOfLines={1}>{hostLabel}</Text>
        <Pressable onPress={onClose} hitSlop={8} className="active:opacity-60">
          <CircleX size={16} color={TERM.accent} />
        </Pressable>
      </View>
      <ToolButton icon={Plus} onPress={() => Alert.alert('New session', 'Opening additional sessions is coming soon.')} />
      <View className="w-1.5" />
      <ToolButton icon={Keyboard} onPress={collapsed ? onToggleCollapse : onToggleKeyboard} />
    </View>
  );
}

function ToolButton({ icon: Icon, onPress }: { icon: LucideIcon; onPress: () => void }) {
  const TERM = useTermColors();
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
  const TERM = useTermColors();
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
  const TERM = useTermColors();
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

function SnippetsPanel({ onKey }: { onKey: (seq: string) => void }) {
  const router = useRouter();
  const snippetRepo = useSnippetRepository();
  const TERM = useTermColors();
  const snippets = useObservable(snippetRepo.snippets$, []);
  const packages = useObservable(snippetRepo.packages$, []);
  const [search, setSearch] = useState('');
  const expandedPkgs = useMemo(() => {
    const set = new Set<string>();
    for (const p of packages) {
      if (p.expanded) {
        set.add(p.id);
      }
    }
    return set;
  }, [packages]);

  useEffect(() => {
    void snippetRepo.ready();
  }, [snippetRepo]);

  const filtered = useMemo(() => filterSnippets(snippets, search), [snippets, search]);

  const grouped = useMemo(() => groupSnippets(filtered), [filtered]);

  const executeSnippet = useCallback((content: string | null) => {
    if (!content) {
      return;
    }
    onKey(`${content}\r`);
  }, [onKey]);

  const togglePackage = useCallback((id: string) => {
    const next = new Set(expandedPkgs);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    void snippetRepo.setExpandedPackageIds([...next]);
  }, [expandedPkgs, snippetRepo]);

  const hasContent = snippets.length > 0 || packages.length > 0;

  if (!hasContent) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <View className="h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: TERM.key }}>
          <Braces size={28} color={TERM.accent} />
        </View>
        <Text className="mt-4 text-center text-[16px] font-semibold" style={{ color: TERM.accent }}>There are no snippets</Text>
        <Text className="mt-2 text-center text-[13px] leading-5" style={{ color: TERM.muted }}>
          Save your frequently used commands as Snippets for easy execution in the future.
        </Text>
        <Pressable
          onPress={() => router.push('/vault/snippet-edit')}
          className="mt-5 w-full items-center rounded-xl py-3 active:opacity-70"
          style={{ backgroundColor: TERM.key }}
        >
          <Text className="text-[15px] font-medium" style={{ color: TERM.accent }}>Create snippet</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 }} keyboardShouldPersistTaps="always">
      {/* Search */}
      <View className="mb-2 flex-row items-center rounded-xl px-3" style={{ backgroundColor: TERM.key, height: 40 }}>
        <Search size={16} color={TERM.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          placeholderTextColor={TERM.muted}
          autoCapitalize="none"
          autoCorrect={false}
          className="ml-2 flex-1 text-[14px]"
          style={{ color: TERM.text }}
        />
      </View>

      {/* Package rows */}
      {packages.map((pkg) => {
        const pkgSnippets = grouped.byPackage.get(pkg.id) ?? [];
        const expanded = expandedPkgs.has(pkg.id);
        return (
          <View key={pkg.id}>
            <Pressable
              onPress={() => togglePackage(pkg.id)}
              className="flex-row items-center justify-between border-b py-3 active:opacity-70"
              style={{ borderColor: TERM.border }}
            >
              <Text className="text-[15px]" style={{ color: TERM.text }}>{pkg.label}</Text>
              <View className="flex-row items-center">
                <Text className="mr-1 text-[14px]" style={{ color: TERM.muted }}>{pkgSnippets.length}</Text>
                {expanded
                  ? <ChevronDown size={16} color={TERM.muted} />
                  : <ChevronRight size={16} color={TERM.muted} />}
              </View>
            </Pressable>
            {expanded && pkgSnippets.map((snippet) => (
              <Pressable
                key={snippet.id}
                onPress={() => executeSnippet(snippet.content)}
                className="flex-row items-center border-b py-3 pl-2 active:opacity-70"
                style={{ borderColor: TERM.border }}
              >
                <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: TERM.key }}>
                  <Braces size={16} color={TERM.muted} />
                </View>
                <View className="flex-1">
                  <Text className="text-[14px]" style={{ color: TERM.text }} numberOfLines={1}>{snippet.label}</Text>
                  <Text className="mt-0.5 text-[12px]" style={{ color: TERM.muted }} numberOfLines={1}>{snippet.content}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        );
      })}

      {/* Ungrouped snippets */}
      {grouped.ungrouped.map((snippet) => (
        <Pressable
          key={snippet.id}
          onPress={() => executeSnippet(snippet.content)}
          className="flex-row items-center border-b py-3 active:opacity-70"
          style={{ borderColor: TERM.border }}
        >
          <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: TERM.key }}>
            <Braces size={16} color={TERM.muted} />
          </View>
          <View className="flex-1">
            <Text className="text-[14px]" style={{ color: TERM.text }} numberOfLines={1}>{snippet.label}</Text>
            <Text className="mt-0.5 text-[12px]" style={{ color: TERM.muted }} numberOfLines={1}>{snippet.content}</Text>
          </View>
        </Pressable>
      ))}

      {/* Add new snippet */}
      <Pressable
        onPress={() => router.push('/vault/snippet-edit')}
        className="flex-row items-center py-3 active:opacity-70"
      >
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: TERM.key }}>
          <Plus size={16} color={TERM.muted} />
        </View>
        <Text className="text-[14px]" style={{ color: TERM.muted }}>Add new snippet</Text>
      </Pressable>
    </ScrollView>
  );
}

function PlaceholderPanel({ title, subtitle }: { title: string; subtitle: string }) {
  const TERM = useTermColors();
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Clock size={28} color={TERM.muted} />
      <Text className="mt-4 text-center text-[16px] font-semibold" style={{ color: TERM.text }}>{title}</Text>
      <Text className="mt-2 text-center text-[13px] leading-5" style={{ color: TERM.muted }}>{subtitle}</Text>
    </View>
  );
}

function ThemePanel({ fontSize, onFontDelta, onSetThemeLive }: { fontSize: number; onFontDelta: (delta: number) => void; onSetThemeLive?: (themeName: string) => void }) {
  const TERM = useTermColors();
  const prefsService = usePreferencesService();
  const prefs = useObservable(prefsService.prefs$, DEFAULT_PREFERENCES);
  const osScheme = useColorScheme();
  const activeSlot = resolveEffectiveMode(prefs.themeMode, osScheme === 'dark' ? 'dark' : 'light');
  const currentThemeName = activeSlot === 'dark' ? prefs.darkThemeName : prefs.lightThemeName;
  const slotThemes = useMemo(
    () => ALL_THEMES.filter((t) => t.type === activeSlot),
    [activeSlot]
  );

  const handleThemeSelect = useCallback((themeName: string) => {
    if (onSetThemeLive) {
      onSetThemeLive(themeName);
    }
  }, [onSetThemeLive]);

  const paddedThemes = useMemo(() => {
    const remainder = slotThemes.length % 3;
    if (remainder === 0) {
      return slotThemes;
    }
    const placeholders = Array.from({ length: 3 - remainder }, (_, i) => ({
      _placeholder: true as const,
      key: `__pad_${i}`,
    }));
    return [...slotThemes, ...placeholders] as ((typeof ALL_THEMES)[number] | { _placeholder: true; key: string })[];
  }, [slotThemes]);

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
  ), [fontSize, onFontDelta, TERM]);

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
  const TERM = useTermColors();
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
        <KeyboardHideIcon size={24} color={TERM.text} />
      </Pressable>
    </View>
  );
}

function TabIcon({ icon: Icon, active, onPress }: { icon: LucideIcon; active: boolean; onPress: () => void }) {
  const TERM = useTermColors();
  return (
    <Pressable
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70"
      style={{ backgroundColor: active ? TERM.keyActive : 'transparent' }}
    >
      <Icon size={20} color={active ? TERM.accent : TERM.text} />
    </Pressable>
  );
}
