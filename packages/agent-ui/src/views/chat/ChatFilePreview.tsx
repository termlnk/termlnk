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
import { Button, cn, useDependency } from '@termlnk/design';
import { X } from 'lucide-react';

export interface IAttachedFile {
  id: string;
  file: File;
  previewUrl: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface IChatFilePreviewProps {
  files: IAttachedFile[];
  onRemove: (id: string) => void;
}

export function ChatFilePreview({ files, onRemove }: IChatFilePreviewProps) {
  const localeService = useDependency(LocaleService);

  if (files.length === 0) return null;

  return (
    <div className="tm:flex tm:gap-2 tm:overflow-x-auto tm:px-1 tm:py-1.5">
      {files.map((f) => (
        <div
          key={f.id}
          className={cn(
            `
              tm:group
              tm:relative tm:flex tm:shrink-0 tm:items-center tm:gap-2 tm:rounded-lg tm:border tm:border-line
              tm:bg-one-bg/30 tm:px-2 tm:py-1
            `
          )}
        >
          <img
            src={f.previewUrl}
            alt={f.file.name}
            className="tm:size-9 tm:rounded-md tm:object-cover"
          />
          <div className="tm:flex tm:max-w-30 tm:min-w-0 tm:flex-col">
            <span className="tm:truncate tm:text-xs tm:text-white">{f.file.name}</span>
            <span className="tm:text-[10px] tm:text-light-grey">{formatFileSize(f.file.size)}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className={cn(
              `
                tm:flex tm:size-5 tm:text-light-grey
                tm:hover:bg-one-bg3 tm:hover:text-white
              `
            )}
            onClick={() => onRemove(f.id)}
            title={localeService.t('agent-ui.chat.remove-file')}
          >
            <X size={10} />
          </Button>
        </div>
      ))}
    </div>
  );
}
