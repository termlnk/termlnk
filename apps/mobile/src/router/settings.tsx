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

import type { TerminalCursorStyle } from '@termlnk/database-mobile';
import type { ITheme } from '@termlnk/themes';
import { DEFAULT_PREFERENCES } from '@termlnk/database-mobile';
import { SyncState } from '@termlnk/sync';
import { ALL_THEMES } from '@termlnk/themes';
import { useRouter } from 'expo-router';
import { Activity, Cpu, Eye, FlaskConical, Gauge, Hash, Keyboard, Languages, MapPin, Moon, RefreshCw, Rows3, Search, ShieldCheck, SquareChevronUp, TextCursor, Timer, Type, Vibrate } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSizePreviewRow } from '../components/terminal/font-size-preview-row';
import { ThemeMiniCard } from '../components/terminal/theme-mini-card';
import { Card } from '../components/ui/card';
import { IconTile } from '../components/ui/icon-tile';
import { NavRow, SwitchRow, ValueRow } from '../components/ui/rows';
import { ScreenContainer } from '../components/ui/screen-container';
import { ScreenHeader } from '../components/ui/screen-header';
import { SectionLabel } from '../components/ui/section-label';
import { SelectSheet } from '../components/ui/select-sheet';
import { useObservable, usePreferencesService, useSyncService } from '../core/core-context';
import { getFontLabel, getTerminalFonts, KEEP_ALIVE_OPTIONS, SCROLLBACK_OPTIONS } from '../lib/terminal-config';

const SYNC_STATE_LABEL: Record<SyncState, string> = {
  [SyncState.Disabled]: 'Disabled',
  [SyncState.Idle]: 'Up to date',
  [SyncState.Syncing]: 'Syncing…',
  [SyncState.Offline]: 'Offline',
  [SyncState.Error]: 'Error',
};

const CURSOR_STYLE_OPTIONS = [
  { label: 'Bar', value: 'bar' as const },
  { label: 'Block', value: 'block' as const },
  { label: 'Underline', value: 'underline' as const },
];

const SOON = (title: string) => () => Alert.alert(title, 'This setting is coming soon.');

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const sync = useSyncService();
  const prefsService = usePreferencesService();
  const syncState = useObservable(sync.state$, SyncState.Disabled);
  const prefs = useObservable(prefsService.prefs$, DEFAULT_PREFERENCES);

  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [cursorStylePickerOpen, setCursorStylePickerOpen] = useState(false);
  const [scrollbackPickerOpen, setScrollbackPickerOpen] = useState(false);
  const [keepAlivePickerOpen, setKeepAlivePickerOpen] = useState(false);

  useEffect(() => {
    void prefsService.ready();
  }, [prefsService]);

  const toggle = (patch: Parameters<typeof prefsService.update>[0]) => () => void prefsService.update(patch);

  const fontDisplayName = useMemo(() => getFontLabel(prefs.terminalFontFamily), [prefs.terminalFontFamily]);
  const scrollbackLabel = useMemo(
    () => SCROLLBACK_OPTIONS.find((o) => o.value === String(prefs.terminalScrollback))?.label ?? String(prefs.terminalScrollback),
    [prefs.terminalScrollback]
  );
  const keepAliveLabel = useMemo(
    () => KEEP_ALIVE_OPTIONS.find((o) => o.value === String(prefs.terminalKeepAlive))?.label ?? `${prefs.terminalKeepAlive} sec`,
    [prefs.terminalKeepAlive]
  );
  const cursorStyleLabel = useMemo(
    () => CURSOR_STYLE_OPTIONS.find((o) => o.value === prefs.terminalCursorStyle)?.label ?? prefs.terminalCursorStyle,
    [prefs.terminalCursorStyle]
  );
  const fontOptions = useMemo(() => getTerminalFonts().map((f) => ({ label: f.label, value: f.value })), []);

  const THEME_GAP = 8;
  const THEME_PADDING = 16;
  const THEME_COUNT = 4;
  const themeCardWidth = Math.floor((screenWidth - 32 - THEME_PADDING * 2 - THEME_GAP * (THEME_COUNT - 1)) / THEME_COUNT);
  const themeItemLength = themeCardWidth + THEME_GAP;

  const themeListRef = useRef<FlatList<ITheme>>(null);

  const handleThemeSelect = useCallback((themeName: string) => {
    void prefsService.update({ terminalThemeName: themeName });
  }, [prefsService]);

  const handleFontSelect = useCallback((fontFamily: string) => {
    void prefsService.update({ terminalFontFamily: fontFamily });
  }, [prefsService]);

  const handleScrollbackSelect = useCallback((value: string) => {
    void prefsService.update({ terminalScrollback: Number(value) });
  }, [prefsService]);

  const handleKeepAliveSelect = useCallback((value: string) => {
    void prefsService.update({ terminalKeepAlive: Number(value) });
  }, [prefsService]);

  const handleFontSizeChange = useCallback((size: number) => {
    void prefsService.update({ terminalFontSize: size });
  }, [prefsService]);

  const handleCursorStyleSelect = useCallback((value: string) => {
    void prefsService.update({ terminalCursorStyle: value as TerminalCursorStyle });
  }, [prefsService]);

  const themeRenderItem = useCallback(({ item }: { item: (typeof ALL_THEMES)[number] }) => (
    <ThemeMiniCard
      theme={item}
      selected={item.name === prefs.terminalThemeName}
      width={themeCardWidth}
      onPress={() => handleThemeSelect(item.name)}
    />
  ), [prefs.terminalThemeName, handleThemeSelect, themeCardWidth]);

  const themeKeyExtractor = useCallback((t: (typeof ALL_THEMES)[number]) => t.name, []);

  return (
    <ScreenContainer>
      <ScreenHeader variant="nav" title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 5 }}>
        <SectionLabel title="Terminal" first />
        <Card>
          <View>
            <FontSizePreviewRow value={prefs.terminalFontSize} onChange={handleFontSizeChange} />
            <FlatList
              ref={themeListRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              data={ALL_THEMES}
              keyExtractor={themeKeyExtractor}
              contentContainerStyle={{ paddingHorizontal: THEME_PADDING, paddingBottom: 12, gap: THEME_GAP }}
              renderItem={themeRenderItem}
              initialScrollIndex={Math.max(0, ALL_THEMES.findIndex((t) => t.name === prefs.terminalThemeName))}
              getItemLayout={(_, index) => ({ length: themeItemLength, offset: themeItemLength * index, index })}
            />
          </View>
          <NavRow
            leading={<IconTile icon={Type} tone="host" size={30} />}
            title="Terminal Font"
            subtitle={fontDisplayName}
            onPress={() => setFontPickerOpen(true)}
          />
          <NavRow
            leading={<IconTile icon={TextCursor} tone="help" size={30} />}
            title="Cursor Style"
            subtitle={cursorStyleLabel}
            onPress={() => setCursorStylePickerOpen(true)}
          />
          <SwitchRow
            leading={<IconTile icon={Eye} tone="serial" size={30} />}
            title="Cursor Blink"
            value={prefs.terminalCursorBlink}
            onValueChange={(v) => void prefsService.update({ terminalCursorBlink: v })}
          />
          <NavRow
            leading={<IconTile icon={Rows3} tone="known" size={30} />}
            title="Scrollback Lines"
            subtitle={scrollbackLabel}
            onPress={() => setScrollbackPickerOpen(true)}
          />
          <NavRow
            leading={<IconTile icon={Timer} tone="keychain" size={30} />}
            title="Keep Alive Interval"
            subtitle={keepAliveLabel}
            onPress={() => setKeepAlivePickerOpen(true)}
          />
          <SwitchRow
            leading={<IconTile icon={Vibrate} tone="discover" size={30} />}
            title="Haptic Feedback"
            value={prefs.terminalHaptic}
            onValueChange={(v) => void prefsService.update({ terminalHaptic: v })}
          />
          <SwitchRow
            leading={<IconTile icon={Search} tone="sessions" size={30} />}
            title="Pinch to Zoom"
            value={prefs.terminalPinchToZoom}
            onValueChange={(v) => void prefsService.update({ terminalPinchToZoom: v })}
          />
          <SwitchRow
            leading={<IconTile icon={Moon} tone="host" size={30} />}
            title="Prevent Sleeping"
            description="Keep display active in terminal"
            value={prefs.terminalPreventSleeping}
            onValueChange={(v) => void prefsService.update({ terminalPreventSleeping: v })}
          />
        </Card>

        <SectionLabel title="Keyboard" />
        <Card>
          <SwitchRow
            leading={<IconTile icon={SquareChevronUp} tone="sshid" size={30} />}
            title="Use Option as Meta Key"
            value={prefs.useOptionAsMeta}
            onValueChange={(v) => void prefsService.update({ useOptionAsMeta: v })}
          />
          <SwitchRow
            leading={<IconTile icon={Languages} tone="sessions" size={30} />}
            title="CJK Input In Terminal"
            description="Turn on to support CJK input with a hardware keyboard"
            value={prefs.cjkInput}
            onValueChange={(v) => void prefsService.update({ cjkInput: v })}
          />
          <NavRow leading={<IconTile icon={SquareChevronUp} tone="neutral" size={30} />} title="Remap Caps Lock" subtitle="None" onPress={SOON('Remap Caps Lock')} />
          <NavRow leading={<IconTile icon={Hash} tone="help" size={30} />} title="Hotkey for F1-F10" subtitle="Alt+Shift+<number>" onPress={SOON('Hotkey for F1-F10')} />
          <NavRow leading={<IconTile icon={Keyboard} tone="keychain" size={30} />} title="Customize Keyboard" onPress={SOON('Customize Keyboard')} />
          <NavRow leading={<IconTile icon={Gauge} tone="serial" size={30} />} title="Cursor Speed" subtitle="Normal" onPress={SOON('Cursor Speed')} />
        </Card>

        <SectionLabel title="Sessions" />
        <Card>
          <NavRow leading={<IconTile icon={Activity} tone="sessions" size={30} />} title="Live Activity" subtitle="Show sessions on lock screen" onPress={SOON('Live Activity')} />
          <NavRow
            leading={<IconTile icon={Cpu} tone="neutral" size={30} />}
            title="Detect Host Operating System"
            subtitle={prefs.detectHostOs ? 'Enabled' : 'Disabled'}
            onPress={toggle({ detectHostOs: !prefs.detectHostOs })}
          />
          <SwitchRow
            leading={<IconTile icon={FlaskConical} tone="help" size={30} />}
            title="Experimental Connection Process"
            description="Recommended for issues with VPN and cellular, but it can cause issues with background work."
            value={prefs.experimentalConnection}
            onValueChange={(v) => void prefsService.update({ experimentalConnection: v })}
          />
          <SwitchRow
            leading={<IconTile icon={ShieldCheck} tone="sshid" size={30} />}
            title="Post-Quantum Key Exchange"
            description="Turn off if you're experiencing issues with legacy devices."
            value={prefs.postQuantumKex}
            onValueChange={(v) => void prefsService.update({ postQuantumKex: v })}
          />
          <SwitchRow
            leading={<IconTile icon={MapPin} tone="keychain" size={30} />}
            title="Save Location Data"
            value={prefs.saveLocationData}
            onValueChange={(v) => void prefsService.update({ saveLocationData: v })}
          />
        </Card>

        <SectionLabel title="Sync" />
        <Card>
          <ValueRow title="Status" value={SYNC_STATE_LABEL[syncState]} leading={<IconTile icon={RefreshCw} tone="known" size={30} />} />
        </Card>
        <Text className="mt-2 px-4 text-[13px] leading-[18px] text-content-secondary">
          Hosts, identities, and keys sync end-to-end encrypted across your devices.
        </Text>
      </ScrollView>

      {/* Pickers */}
      <SelectSheet
        visible={fontPickerOpen}
        title="Terminal Font"
        options={fontOptions}
        value={prefs.terminalFontFamily}
        onSelect={handleFontSelect}
        onClose={() => setFontPickerOpen(false)}
      />
      <SelectSheet
        visible={cursorStylePickerOpen}
        title="Cursor Style"
        options={CURSOR_STYLE_OPTIONS}
        value={prefs.terminalCursorStyle}
        onSelect={handleCursorStyleSelect}
        onClose={() => setCursorStylePickerOpen(false)}
      />
      <SelectSheet
        visible={scrollbackPickerOpen}
        title="Scrollback Lines"
        options={SCROLLBACK_OPTIONS}
        value={String(prefs.terminalScrollback)}
        onSelect={handleScrollbackSelect}
        onClose={() => setScrollbackPickerOpen(false)}
      />
      <SelectSheet
        visible={keepAlivePickerOpen}
        title="Keep Alive Interval"
        options={KEEP_ALIVE_OPTIONS}
        value={String(prefs.terminalKeepAlive)}
        onSelect={handleKeepAliveSelect}
        onClose={() => setKeepAlivePickerOpen(false)}
      />
    </ScreenContainer>
  );
}
