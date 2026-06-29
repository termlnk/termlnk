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
import { View } from 'react-native';

// Termius keeps these category tiles vivid in both light and dark mode, so the
// palette is fixed (not theme-switched). fg defaults to white; the AI tile uses
// dark text on a light lavender fill.
export interface ITileTone {
  readonly bg: string;
  readonly fg: string;
}

export const TILE_TONES = {
  host: { bg: '#3b7bf6', fg: '#ffffff' },
  sftp: { bg: '#34a853', fg: '#ffffff' },
  discover: { bg: '#a855f7', fg: '#ffffff' },
  serial: { bg: '#f59e0b', fg: '#ffffff' },
  keychain: { bg: '#ef4444', fg: '#ffffff' },
  portfwd: { bg: '#14b8a6', fg: '#ffffff' },
  snippets: { bg: '#6366f1', fg: '#ffffff' },
  known: { bg: '#0ea5e9', fg: '#ffffff' },
  logs: { bg: '#64748b', fg: '#ffffff' },
  ai: { bg: '#de98fd', fg: '#1e222a' },
  keyboard: { bg: '#475569', fg: '#ffffff' },
  sessions: { bg: '#16a34a', fg: '#ffffff' },
  sshid: { bg: '#7c5cff', fg: '#ffffff' },
  settings: { bg: '#8b5cf6', fg: '#ffffff' },
  help: { bg: '#22c7b8', fg: '#ffffff' },
  discord: { bg: '#5865f2', fg: '#ffffff' },
  neutral: { bg: '#0f1b2d', fg: '#ffffff' },
} as const satisfies Record<string, ITileTone>;

export type ITileToneName = keyof typeof TILE_TONES;

interface IIconTileProps {
  readonly icon: LucideIcon;
  readonly tone: ITileToneName;
  readonly size?: number;
}

export function IconTile({ icon: Icon, tone, size = 36 }: IIconTileProps) {
  const { bg, fg } = TILE_TONES[tone];
  return (
    <View
      className="items-center justify-center rounded-xl"
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      <Icon size={Math.round(size * 0.55)} color={fg} />
    </View>
  );
}
