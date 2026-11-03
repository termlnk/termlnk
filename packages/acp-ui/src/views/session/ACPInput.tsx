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

import type { KeyboardEvent } from 'react';
import { LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { ArrowUp } from 'lucide-react';
import { useCallback, useState } from 'react';

export interface IACPInputProps {
  disabled?: boolean;
  onSubmit: (text: string) => Promise<void> | void;
}

export function ACPInput({ disabled, onSubmit }: IACPInputProps) {
  const localeService = useDependency(LocaleService);
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  const submit = useCallback(async () => {
    const text = value.trim();
    if (!text || sending || disabled) {
      return;
    }
    setSending(true);
    try {
      await onSubmit(text);
      setValue('');
    } finally {
      setSending(false);
    }
  }, [value, sending, disabled, onSubmit]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div
      className={cn('tm:flex tm:shrink-0 tm:items-end tm:gap-2 tm:border-t tm:border-line tm:bg-one-bg tm:p-2')}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled || sending}
        rows={1}
        placeholder={localeService.t('acp-ui.session.message-placeholder')}
        className={cn(`
          tm:max-h-32 tm:min-h-[36px] tm:flex-1 tm:resize-none tm:rounded-md tm:border tm:border-line tm:bg-black
          tm:px-2.5 tm:py-2 tm:text-xs tm:text-light-grey tm:outline-none
          tm:placeholder:text-grey
          tm:focus:border-nord-blue
        `)}
      />
      <button
        type="button"
        disabled={disabled || sending || !value.trim()}
        onClick={() => void submit()}
        className={cn(
          'tm:flex tm:size-9 tm:shrink-0 tm:items-center tm:justify-center tm:rounded-md tm:transition-colors',
          value.trim() && !disabled && !sending
            ? `
              tm:bg-nord-blue tm:text-white
              tm:hover:opacity-90
            `
            : 'tm:bg-one-bg2 tm:text-grey'
        )}
      >
        <ArrowUp size={14} />
      </button>
    </div>
  );
}
