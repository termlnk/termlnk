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
import { Button, cn, Field, FieldContent, FieldLabel, Switch, useDependency } from '@termlnk/design';
import { Play } from 'lucide-react';

interface ISoundEventRowProps {
  id: string;
  labelKey: string;
  descriptionKey: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onPlay: () => void;
}

export function SoundEventRow({ id, labelKey, descriptionKey, checked, onCheckedChange, onPlay }: ISoundEventRowProps) {
  const localeService = useDependency(LocaleService);

  return (
    <Field orientation="horizontal" className="tm:items-start">
      <FieldLabel htmlFor={id} className="tm:min-w-0 tm:flex-1 tm:flex-col tm:items-start tm:gap-1 tm:text-white">
        <span className="tm:text-sm tm:font-medium">
          {localeService.t(labelKey)}
        </span>
        <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
          {localeService.t(descriptionKey)}
        </span>
      </FieldLabel>
      <FieldContent className="tm:flex-none tm:flex-row tm:items-center tm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            `
              tm:size-7 tm:rounded-full tm:text-grey-fg
              tm:hover:bg-one-bg2 tm:hover:text-white
            `
          )}
          aria-label={localeService.t('settings-ui.island.sound-enable')}
          onClick={onPlay}
        >
          <Play className="tm:size-3.5" />
        </Button>
        <Switch
          id={id}
          size="sm"
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </FieldContent>
    </Field>
  );
}
