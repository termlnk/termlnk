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

import type { IChatMessage, IImagePart, IMessagePart, ITextPart } from '@termlnk/agent';
import { ICommandService, LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { Hourglass, X } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { EditUserMessageCommand } from '../../../commands/edit-user-message.command';
import { ImagePart } from '../parts/ImagePart';
import { MessageActions } from './MessageActions';

interface IUserMessageBubbleProps {
  message: IChatMessage;
  isPending: boolean;
  onCancelPending: () => void;
}

const EDITOR_MIN_ROWS = 2;
const EDITOR_MAX_ROWS = 8;

function getMessageText(parts: IMessagePart[]): string {
  return parts
    .filter((p): p is ITextPart => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n');
}

function getMessageImages(parts: IMessagePart[]): IImagePart[] {
  return parts.filter((p): p is IImagePart => p.type === 'image');
}

export const UserMessageBubble = memo(function UserMessageBubble({
  message,
  isPending,
  onCancelPending,
}: IUserMessageBubbleProps) {
  const localeService = useDependency(LocaleService);
  const commandService = useDependency(ICommandService);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const text = getMessageText(message.parts);
  const images = getMessageImages(message.parts);

  const handleStartEdit = useCallback(() => {
    setEditValue(text);
    setEditing(true);
  }, [text]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setEditValue('');
  }, []);

  const handleSubmitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      return;
    }
    commandService.executeCommand(EditUserMessageCommand.id, {
      messageId: message.id,
      content: trimmed,
    });
    setEditing(false);
    setEditValue('');
  }, [commandService, editValue, message.id]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  }, [handleCancelEdit, handleSubmitEdit]);

  useEffect(() => {
    if (editing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.setSelectionRange(editValue.length, editValue.length);
    }
  }, [editing]);

  if (editing) {
    const canSubmit = editValue.trim().length > 0;
    const rows = Math.min(EDITOR_MAX_ROWS, Math.max(EDITOR_MIN_ROWS, editValue.split('\n').length));
    return (
      <div
        className="
          tm:group
          tm:flex tm:flex-col tm:items-end tm:gap-1
        "
      >
        <div className="tm:flex tm:w-full tm:flex-col tm:items-end tm:gap-1">
          <textarea
            ref={editTextareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            rows={rows}
            placeholder={localeService.t('agent-ui.chat.edit-placeholder')}
            className={`
              tm:w-full tm:resize-none tm:rounded-lg tm:bg-one-bg tm:px-3 tm:py-2 tm:text-sm tm:text-white
              tm:outline-none
              tm:focus:ring-1 tm:focus:ring-blue
            `}
          />
          <div className="tm:flex tm:items-center tm:gap-1.5">
            <button
              type="button"
              onClick={handleCancelEdit}
              className={`
                tm:rounded-sm tm:px-2 tm:py-1 tm:text-xs tm:text-grey-fg tm:transition-colors
                tm:hover:bg-one-bg2 tm:hover:text-light-grey
              `}
            >
              {localeService.t('agent-ui.chat.action-cancel-edit')}
            </button>
            <button
              type="button"
              onClick={handleSubmitEdit}
              disabled={!canSubmit}
              className={cn(
                `
                  tm:rounded-sm tm:bg-nord-blue tm:px-2.5 tm:py-1 tm:text-xs tm:font-medium tm:text-white
                  tm:transition-colors
                  tm:hover:bg-blue
                `,
                { 'tm:cursor-not-allowed tm:opacity-50': !canSubmit }
              )}
            >
              {localeService.t('agent-ui.chat.action-save')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        tm:group
        tm:flex tm:flex-col tm:items-end tm:gap-1
      "
    >
      <div
        className={cn(
          'tm:max-w-[85%] tm:rounded-xl tm:rounded-br-sm tm:px-3 tm:py-2 tm:text-sm tm:text-white tm:transition-colors',
          {
            'tm:bg-one-bg2': !isPending,
            'tm:bg-one-bg tm:opacity-80 tm:ring-1 tm:ring-blue/40': isPending,
          }
        )}
      >
        {images.length > 0 && (
          <div className="tm:mb-2 tm:flex tm:flex-wrap tm:gap-1.5">
            {images.map((img, i) => (
              <ImagePart key={`img-${i}`} part={img} />
            ))}
          </div>
        )}
        <p className="tm:wrap-break-word tm:whitespace-pre-wrap">{text}</p>
      </div>
      {!isPending && (
        <MessageActions
          copyText={text}
          onEdit={handleStartEdit}
        />
      )}
      {isPending && (
        <div className="tm:flex tm:items-center tm:gap-1 tm:text-[0.68rem] tm:text-blue">
          <Hourglass size={10} className="tm:animate-pulse" />
          <span>{localeService.t('agent-ui.chat.pending-queued')}</span>
          <button
            type="button"
            onClick={onCancelPending}
            className={`
              tm:ml-1 tm:flex tm:items-center tm:gap-0.5 tm:rounded-sm tm:bg-one-bg tm:px-1.5 tm:py-0.5
              tm:text-[0.66rem] tm:text-grey-fg tm:transition-colors
              tm:hover:bg-one-bg2 tm:hover:text-white
            `}
            title={localeService.t('agent-ui.chat.pending-cancel')}
          >
            <X size={10} />
            <span>{localeService.t('agent-ui.chat.pending-cancel')}</span>
          </button>
        </div>
      )}
    </div>
  );
});
