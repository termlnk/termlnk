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

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

// Special-keys accessory bar over the on-screen keyboard. Sends raw escape sequences /
// control bytes straight to the shell — the device keyboard handles printable input via
// xterm; this covers the keys a touch keyboard lacks (Esc, Tab, arrows, Ctrl combos).

interface ITerminalKeyBarProps {
  readonly onKey: (seq: string) => void;
}

const ESC = '\x1b';
const NAV_KEYS: { label: string; seq: string }[] = [
  { label: 'Esc', seq: ESC },
  { label: 'Tab', seq: '\t' },
  { label: '~', seq: '~' },
  { label: '/', seq: '/' },
  { label: '-', seq: '-' },
  { label: '|', seq: '|' },
  { label: 'Home', seq: `${ESC}[H` },
  { label: 'End', seq: `${ESC}[F` },
  { label: 'PgUp', seq: `${ESC}[5~` },
  { label: 'PgDn', seq: `${ESC}[6~` },
];

const CTRL_KEYS: { label: string; seq: string }[] = [
  { label: '^C', seq: '\x03' },
  { label: '^D', seq: '\x04' },
  { label: '^Z', seq: '\x1a' },
  { label: '^L', seq: '\x0c' },
  { label: '^R', seq: '\x12' },
  { label: '^A', seq: '\x01' },
  { label: '^E', seq: '\x05' },
  { label: '^U', seq: '\x15' },
  { label: '^K', seq: '\x0b' },
  { label: '^W', seq: '\x17' },
];

const ARROWS = [
  { Icon: ArrowLeft, seq: `${ESC}[D` },
  { Icon: ArrowUp, seq: `${ESC}[A` },
  { Icon: ArrowDown, seq: `${ESC}[B` },
  { Icon: ArrowRight, seq: `${ESC}[C` },
];

function KeyCap({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mr-1.5 min-w-[40px] items-center justify-center rounded-md bg-one-bg2 px-2.5 py-2 active:bg-one-bg3"
    >
      <Text className="text-[13px] font-medium text-light-grey">{label}</Text>
    </Pressable>
  );
}

export function TerminalKeyBar({ onKey }: ITerminalKeyBarProps) {
  return (
    <View className="border-t border-line bg-black">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-2 py-1.5" keyboardShouldPersistTaps="always">
        {NAV_KEYS.map((k) => <KeyCap key={k.label} label={k.label} onPress={() => onKey(k.seq)} />)}
      </ScrollView>
      <View className="flex-row items-center px-2 pb-1.5">
        <View className="flex-row">
          {ARROWS.map(({ Icon, seq }, i) => (
            <Pressable
              key={i}
              onPress={() => onKey(seq)}
              className="mr-1.5 h-9 w-10 items-center justify-center rounded-md bg-one-bg2 active:bg-one-bg3"
            >
              <Icon size={16} color="#6f737b" />
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="ml-1 flex-1" keyboardShouldPersistTaps="always">
          {CTRL_KEYS.map((k) => <KeyCap key={k.label} label={k.label} onPress={() => onKey(k.seq)} />)}
        </ScrollView>
      </View>
    </View>
  );
}
