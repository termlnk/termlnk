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

import type { PortForwardingType } from '@termlnk/database-mobile';
import { PillTabBar } from '../ui/pill-tab-bar';

const TABS = [
  { label: 'Local', value: 'local' as const },
  { label: 'Remote', value: 'remote' as const },
  { label: 'Dynamic', value: 'dynamic' as const },
] as const;

interface ITypeTabBarProps {
  readonly value: PortForwardingType;
  readonly onChange: (type: PortForwardingType) => void;
}

export function TypeTabBar({ value, onChange }: ITypeTabBarProps) {
  return <PillTabBar tabs={TABS} value={value} onChange={onChange} className="mx-4 mt-4" />;
}
