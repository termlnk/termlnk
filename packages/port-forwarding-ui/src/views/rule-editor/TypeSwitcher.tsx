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

import { LocaleService } from '@termlnk/core';
import { ToggleGroup, ToggleGroupItem, useDependency } from '@termlnk/design';
import { PortForwardingType } from '@termlnk/rpc';

export interface ITypeSwitcherProps {
  value: PortForwardingType;
  onChange: (value: PortForwardingType) => void;
}

const OPTIONS: Array<{ value: PortForwardingType; i18nKey: string }> = [
  { value: PortForwardingType.LOCAL, i18nKey: 'port-forwarding-ui.editor.typeLocal' },
  { value: PortForwardingType.REMOTE, i18nKey: 'port-forwarding-ui.editor.typeRemote' },
  { value: PortForwardingType.DYNAMIC, i18nKey: 'port-forwarding-ui.editor.typeDynamic' },
];

export function TypeSwitcher({ value, onChange }: ITypeSwitcherProps) {
  const localeService = useDependency(LocaleService);
  return (
    <ToggleGroup
      type="single"
      value={value}
      spacing={2}
      // Ignore empty value so a segment is always selected.
      onValueChange={(next) => next && onChange(next as PortForwardingType)}
      className="tm:w-full tm:border tm:border-line tm:bg-one-bg3 tm:p-0.5"
    >
      {OPTIONS.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          size="sm"
          className={`
            tm:h-8 tm:flex-1 tm:rounded-md tm:text-[12px] tm:text-grey-fg2
            tm:hover:bg-one-bg2 tm:hover:text-light-grey
            tm:data-[state=on]:bg-blue tm:data-[state=on]:text-white
          `}
        >
          {localeService.t(opt.i18nKey)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
