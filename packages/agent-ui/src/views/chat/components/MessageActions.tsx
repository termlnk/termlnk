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

import type { ReactNode } from 'react';
import { LocaleService } from '@termlnk/core';
import { cn, toast, useDependency } from '@termlnk/design';
import { TooltipWrapper } from '@termlnk/ui';
import { Check, Copy, Pencil, RefreshCw } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

interface IMessageActionsProps {
  copyText?: string;
  onRetry?: () => void;
  onEdit?: () => void;
  className?: string;
}

interface IActionButtonProps {
  labelKey: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

function ActionButton({ labelKey, icon, onClick, disabled }: IActionButtonProps) {
  return (
    <TooltipWrapper side="top" labelKey={labelKey}>
      <button
        type="button"
        aria-label={labelKey}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          `
            tm:inline-flex tm:items-center tm:justify-center tm:rounded-sm tm:p-1 tm:text-white tm:transition-colors
            tm:hover:bg-one-bg
            tm:focus-visible:bg-one-bg tm:focus-visible:outline-none
          `,
          { 'tm:cursor-not-allowed tm:opacity-50': disabled }
        )}
      >
        {icon}
      </button>
    </TooltipWrapper>
  );
}

const COPY_FEEDBACK_MS = 1500;

export const MessageActions = memo(function MessageActions({ copyText, onRetry, onEdit, className }: IMessageActionsProps) {
  const localeService = useDependency(LocaleService);
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(() => {
    if (!copyText) {
      return;
    }
    navigator.clipboard.writeText(copyText).then(
      () => {
        toast.success(localeService.t('agent-ui.chat.copied'));
        setCopied(true);
        if (resetTimerRef.current) {
          clearTimeout(resetTimerRef.current);
        }
        resetTimerRef.current = setTimeout(() => {
          setCopied(false);
          resetTimerRef.current = null;
        }, COPY_FEEDBACK_MS);
      },
      () => {
        toast.error(localeService.t('agent-ui.chat.copy-failed'));
      }
    );
  }, [copyText, localeService]);

  return (
    <div
      className={cn(
        `
          tm:mt-1 tm:flex tm:items-center tm:gap-0.5 tm:opacity-0 tm:transition-opacity tm:duration-150
          tm:group-hover:opacity-100
          tm:focus-within:opacity-100
        `,
        className
      )}
    >
      {copyText !== undefined && (
        <ActionButton
          labelKey={copied ? 'agent-ui.chat.copied' : 'agent-ui.chat.action-copy'}
          icon={copied ? <Check size={12} /> : <Copy size={12} />}
          onClick={handleCopy}
          disabled={!copyText}
        />
      )}
      {onRetry && (
        <ActionButton
          labelKey="agent-ui.chat.action-retry"
          icon={<RefreshCw size={12} />}
          onClick={onRetry}
        />
      )}
      {onEdit && (
        <ActionButton
          labelKey="agent-ui.chat.action-edit"
          icon={<Pencil size={12} />}
          onClick={onEdit}
        />
      )}
    </div>
  );
});
