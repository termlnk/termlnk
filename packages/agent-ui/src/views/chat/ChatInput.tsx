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

import type { IImageAttachment } from '@termlnk/agent';
import type { IAttachedFile } from './ChatFilePreview';
import type { IChatSlashCommandPanelHandle } from './ChatSlashCommandPanel';
import { generateRandomId, LocaleService } from '@termlnk/core';
import { Button, cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, useDependency, useObservable } from '@termlnk/design';
import { IAIAgentClientService, IProviderConfigClientService } from '@termlnk/rpc-client';
import { Gauge, Paperclip, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { map } from 'rxjs';
import { ChatFilePreview } from './ChatFilePreview';
import { ChatModelSelector } from './ChatModelSelector';
import { ChatPermissionModeSelector } from './ChatPermissionModeSelector';
import { ChatSkillSelector } from './ChatSkillSelector';
import { ChatSlashCommandPanel } from './ChatSlashCommandPanel';
import { ChatThinkingLevelSelector } from './ChatThinkingLevelSelector';
import { ChatToolSelector } from './ChatToolSelector';
import { useSlashCommand } from './use-slash-command';

const DEFAULT_CONTEXT_WINDOW = 262144;
const TOKEN_FORMATTER = new Intl.NumberFormat('en-US');
const MIN_TEXTAREA_HEIGHT = 60;
const AUTO_MAX_TEXTAREA_HEIGHT = 170;
const MANUAL_MAX_TEXTAREA_HEIGHT = 420;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.svg';

function clampHeight(height: number): number {
  return Math.min(MANUAL_MAX_TEXTAREA_HEIGHT, Math.max(MIN_TEXTAREA_HEIGHT, height));
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:image/...;base64," prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const COMPACT_COMMAND_PATTERN = /^\/compact(?:\s+([\s\S]*))?$/;

export function ChatInput() {
  const aiAgentService = useDependency(IAIAgentClientService);
  const providerConfigService = useDependency(IProviderConfigClientService);
  const localeService = useDependency(LocaleService);
  const activeModel = useObservable(providerConfigService.activeModel$, null);
  const messages = useObservable(aiAgentService.messages$, []);
  const isStreaming = useObservable(
    useMemo(() => aiAgentService.status$.pipe(map((s) => s === 'streaming' || s === 'thinking' || s === 'tool_calling')), [aiAgentService]),
    false
  );
  const isCompacting = useObservable(aiAgentService.isCompacting$, false);

  const [value, setValue] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [manualHeight, setManualHeight] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizeHover, setIsResizeHover] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<IAttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slashPanelRef = useRef<IChatSlashCommandPanelHandle>(null);
  const isResizingRef = useRef(false);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(MIN_TEXTAREA_HEIGHT);
  const attachedFilesRef = useRef(attachedFiles);
  attachedFilesRef.current = attachedFiles;

  const slashState = useSlashCommand(value, cursorPosition);

  // Cleanup ObjectURLs on unmount
  useEffect(() => {
    return () => {
      attachedFilesRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
  }, []);

  const processFiles = useCallback((files: File[]) => {
    const newAttachments: IAttachedFile[] = [];
    for (const file of files) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        console.warn(`[ChatInput] Rejected file type: ${file.type}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`[ChatInput] File too large: ${file.name} (${file.size} bytes)`);
        continue;
      }
      newAttachments.push({
        id: generateRandomId(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (newAttachments.length > 0) {
      setAttachedFiles((prev) => [...prev, ...newAttachments]);
    }
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setAttachedFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles([...e.target.files]);
    }
    // Reset so the same file can be selected again
    e.target.value = '';
  }, [processFiles]);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    if (manualHeight !== null) {
      textarea.style.height = `${clampHeight(manualHeight)}px`;
      return;
    }
    textarea.style.height = '0px';
    const nextHeight = Math.min(AUTO_MAX_TEXTAREA_HEIGHT, Math.max(textarea.scrollHeight, MIN_TEXTAREA_HEIGHT));
    textarea.style.height = `${nextHeight}px`;
  }, [manualHeight]);

  const updateResizeHeight = useCallback((clientY: number) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const delta = resizeStartYRef.current - clientY;
    const nextHeight = clampHeight(resizeStartHeightRef.current + delta);
    setManualHeight(nextHeight);
    textarea.style.height = `${nextHeight}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    const hasFiles = attachedFiles.length > 0;
    if ((!trimmed && !hasFiles) || isCompacting) {
      return;
    }

    const compactMatch = trimmed.match(COMPACT_COMMAND_PATTERN);
    if (compactMatch) {
      const instructions = compactMatch[1]?.trim() || undefined;
      setValue('');
      setAttachedFiles((prev) => {
        prev.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        return [];
      });
      if (textareaRef.current) {
        textareaRef.current.style.height = manualHeight === null ? 'auto' : `${clampHeight(manualHeight)}px`;
      }
      aiAgentService.compactConversation({ trigger: 'manual', instructions }).catch((err) => {
        console.error('[ChatInput] compactConversation failed:', err);
      });
      return;
    }

    let images: IImageAttachment[] | undefined;
    if (hasFiles) {
      try {
        images = await Promise.all(
          attachedFiles.map(async (f) => ({
            data: await readFileAsBase64(f.file),
            mimeType: f.file.type,
          }))
        );
      } catch (err) {
        console.error('[ChatInput] Failed to read files:', err);
        return;
      }
    }

    // Clear state immediately for responsive feel
    setValue('');
    setAttachedFiles((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      return [];
    });
    if (textareaRef.current) {
      textareaRef.current.style.height = manualHeight === null ? 'auto' : `${clampHeight(manualHeight)}px`;
    }

    aiAgentService.sendMessage(trimmed || ' ', { images }).catch((err) => {
      console.error('[ChatInput] sendMessage failed:', err);
    });
  }, [value, attachedFiles, isCompacting, aiAgentService, manualHeight]);

  const handleStop = useCallback(() => {
    aiAgentService.stopStreaming();
  }, [aiAgentService]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Forward to slash command panel when active
      if (slashPanelRef.current?.handleKeyDown(e)) {
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      setCursorPosition(e.target.selectionStart ?? 0);
      adjustHeight();
    },
    [adjustHeight]
  );

  const handleSelect = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      setCursorPosition(target.selectionStart ?? 0);
    },
    []
  );

  const handleSlashSelect = useCallback(
    (item: { name: string }) => {
      if (!slashState.active) {
        return;
      }
      const before = value.slice(0, slashState.slashIndex);
      const after = value.slice(cursorPosition);
      const replacement = `${item.name} `;
      const nextValue = before + replacement + after;
      const nextCursor = before.length + replacement.length;
      setValue(nextValue);
      setCursorPosition(nextCursor);
      // Restore focus and set cursor position
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(nextCursor, nextCursor);
        }
      });
    },
    [slashState.active, slashState.slashIndex, value, cursorPosition]
  );

  const handleSlashClose = useCallback(() => {
    setCursorPosition(0);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.files;
      if (!items || items.length === 0) {
        return;
      }
      const imageFiles = [...items].filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
      if (imageFiles.length > 0) {
        e.preventDefault();
        processFiles(imageFiles);
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      processFiles([...e.dataTransfer.files]);
    }
  }, [processFiles]);

  const handleResizePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = textarea.getBoundingClientRect().height;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!isResizingRef.current) {
        return;
      }
      e.preventDefault();
      updateResizeHeight(e.clientY);
    },
    [updateResizeHeight]
  );

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!isResizingRef.current) {
        return;
      }
      e.preventDefault();
      isResizingRef.current = false;
      setIsResizing(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    []
  );

  const canSend = (value.trim().length > 0 || attachedFiles.length > 0) && !isCompacting;
  const contextWindowTokens = activeModel?.contextWindow && activeModel.contextWindow > 0
    ? activeModel.contextWindow
    : DEFAULT_CONTEXT_WINDOW;
  const draftTokens = useMemo(() => Math.ceil(value.length / 3.8), [value.length]);
  // LLMs are stateless: every request packs the entire conversation history
  // (including the previous assistant reply) into the next prompt. So the
  // next request's input ≈ the previous request's totalTokens (input+output).
  // Using totalTokens here keeps the indicator aligned with what the model
  // will actually receive on the next turn, and matches the auto-compact
  // trigger (see getLatestContextTokens in agent-core/compact-token).
  const latestContextTokens = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const totalTokens = messages[i]?.usage?.totalTokens;
      if (typeof totalTokens === 'number' && totalTokens > 0) {
        return totalTokens;
      }
    }
    return 0;
  }, [messages]);
  const usedContextTokens = latestContextTokens + draftTokens;
  const contextUsagePercent = useMemo(() => {
    if (contextWindowTokens <= 0) {
      return 0;
    }
    const ratio = (usedContextTokens / contextWindowTokens) * 100;
    return Math.max(0, Math.min(100, Math.round(ratio)));
  }, [usedContextTokens, contextWindowTokens]);
  const contextUsageText = useMemo(() => {
    return `${TOKEN_FORMATTER.format(usedContextTokens)} / ${TOKEN_FORMATTER.format(contextWindowTokens)} tokens`;
  }, [usedContextTokens, contextWindowTokens]);
  const contextUsageTitle = localeService.t('agent-ui.chat.context-usage');
  const contextUsageHint = localeService.t('agent-ui.chat.context-usage-hint');

  return (
    <div className="tm:bg-black tm:px-2 tm:pt-1 tm:pb-2">
      <div
        className={cn(
          `
            tm:relative tm:rounded-2xl tm:border tm:border-blue/30 tm:bg-linear-to-b tm:from-blue/5 tm:to-black tm:p-1
            tm:transition-colors
            tm:focus-within:border-blue/55
          `,
          {
            'tm:border-blue/60 tm:bg-blue/5': isDragOver,
          }
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Button
          variant="ghost"
          size="sm"
          className={cn(`
            tm:absolute tm:inset-x-2 tm:top-0 tm:z-10 tm:flex tm:h-2 tm:cursor-row-resize tm:items-start
            tm:justify-center tm:rounded-t-2xl
          `)}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          onPointerEnter={() => setIsResizeHover(true)}
          onPointerLeave={() => setIsResizeHover(false)}
          aria-label="Resize input area"
          title="Resize input area"
        >
          <span
            className={cn(
              'tm:mt-px tm:h-0.5 tm:w-10 tm:rounded-full tm:bg-white/35 tm:transition-all tm:duration-150',
              {
                'tm:opacity-100': isResizeHover || isResizing,
                'tm:opacity-0': !isResizeHover && !isResizing,
                'tm:bg-blue/60': isResizing,
              }
            )}
          />
        </Button>
        <ChatFilePreview files={attachedFiles} onRemove={handleRemoveFile} />
        <ChatSlashCommandPanel
          ref={slashPanelRef}
          slashState={slashState}
          onSelect={handleSlashSelect}
          onClose={handleSlashClose}
          textareaRef={textareaRef}
        />
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onPaste={handlePaste}
          disabled={isCompacting}
          placeholder={isCompacting
            ? localeService.t('agent-ui.chat.compacting-placeholder')
            : isStreaming
              ? localeService.t('agent-ui.chat.placeholder-streaming')
              : localeService.t('agent-ui.chat.placeholder')}
          className={`
            tm:min-h-[3.8rem] tm:w-full tm:resize-none tm:overflow-y-auto tm:bg-transparent tm:p-1 tm:text-[0.86rem]/5
            tm:text-white tm:outline-hidden
            tm:selection:bg-blue/30
            tm:placeholder:text-[0.64rem] tm:placeholder:font-medium tm:placeholder:text-white/55
            tm:sm:placeholder:text-[0.68rem]
            tm:lg:placeholder:text-[0.74rem]
          `}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          className="tm:hidden"
          onChange={handleFileInputChange}
        />
        <div className="tm:@container/chat-toolbar tm:mt-1 tm:flex tm:items-center tm:justify-between">
          <div className="tm:flex tm:min-w-0 tm:flex-1 tm:items-center tm:gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              className={`
                tm:flex tm:size-7 tm:shrink-0 tm:text-light-grey
                tm:hover:text-white
              `}
              onClick={handleAttachClick}
              title={localeService.t('agent-ui.chat.attach')}
            >
              <Paperclip size={12} />
            </Button>
            <ChatToolSelector />
            <ChatSkillSelector />
            <ChatThinkingLevelSelector />
            <ChatPermissionModeSelector />
            <ChatModelSelector
              className="tm:inline-flex tm:max-w-full tm:min-w-0"
              triggerClassName={`
                tm:h-7 tm:w-full tm:gap-1 tm:rounded-md tm:border-0 tm:bg-transparent tm:px-1.5 tm:pr-1
                tm:text-[0.72rem] tm:text-light-grey
                tm:hover:bg-one-bg2/45
                tm:aria-expanded:bg-one-bg2/45 tm:aria-expanded:text-white
              `}
              showModelTag
            />
            <TooltipProvider delay={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    className={`
                      tm:inline-flex tm:h-7 tm:shrink-0 tm:gap-1 tm:rounded-md tm:px-1.5 tm:text-light-grey
                      tm:hover:bg-one-bg2/45 tm:hover:text-white
                      tm:@max-[260px]/chat-toolbar:hidden
                    `}
                    aria-label={contextUsageTitle}
                  >
                    <Gauge size={12} />
                    <span>
                      {contextUsagePercent}
                      %
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  <div className="tm:space-y-0.5">
                    <div className="tm:text-[0.7rem] tm:font-medium tm:text-white">{contextUsageTitle}</div>
                    <div className="tm:text-[0.66rem] tm:text-white/80">{contextUsageText}</div>
                    <div className="tm:text-[0.62rem] tm:text-white/60">{contextUsageHint}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="tm:flex tm:items-center">
            {isStreaming && (
              <Button
                variant="ghost"
                size="icon-xs"
                className={`
                  tm:group
                  tm:flex tm:size-7 tm:shrink-0 tm:cursor-pointer tm:items-center tm:justify-center tm:transition-colors
                  tm:hover:bg-transparent
                `}
                onClick={handleStop}
                title={localeService.t('agent-ui.chat.stop')}
                aria-label={localeService.t('agent-ui.chat.stop')}
              >
                <span
                  className={`
                    tm:flex tm:size-4 tm:items-center tm:justify-center tm:rounded-full tm:bg-red tm:transition-colors
                    tm:group-hover:bg-red/90
                  `}
                >
                  <span className="tm:size-2 tm:rounded-[2px] tm:bg-white" />
                </span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn(
                `
                  tm:flex tm:size-7 tm:shrink-0 tm:text-light-grey tm:transition-colors
                  tm:hover:text-white
                  tm:disabled:cursor-default
                  tm:disabled:hover:bg-transparent tm:disabled:hover:text-light-grey
                `,
                {
                  'tm:opacity-70': !canSend,
                }
              )}
              onClick={handleSend}
              disabled={!canSend}
              title={localeService.t('agent-ui.chat.send')}
            >
              <Send size={13} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
