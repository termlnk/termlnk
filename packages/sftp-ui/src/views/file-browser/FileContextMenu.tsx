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

import type { IFileListEntry } from './FileList';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@termlnk/design';
import { Download, Edit3, Lock, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface IFileContextMenuProps {
  x: number;
  y: number;
  entry: IFileListEntry;
  onClose: () => void;
  onDownload?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onPermissions?: () => void;
}

export function FileContextMenu(props: IFileContextMenuProps) {
  const { x, y, entry, onClose, onDownload, onRename, onDelete, onPermissions } = props;
  const [open, setOpen] = useState(true);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      onClose();
    }
  };

  const runAction = (action?: () => void) => {
    if (!action) return;
    action();
    onClose();
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="tm:pointer-events-none tm:fixed tm:size-px tm:opacity-0"
          style={{ left: x, top: y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="tm:max-w-[280px] tm:min-w-[196px]">
        <DropdownMenuItem disabled={!onDownload} onSelect={() => runAction(onDownload)}>
          <Download size={14} />
          {entry.isDirectory ? 'Download folder' : 'Download'}
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!onRename} onSelect={() => runAction(onRename)}>
          <Edit3 size={14} />
          Rename
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!onPermissions} onSelect={() => runAction(onPermissions)}>
          <Lock size={14} />
          Permissions
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={!onDelete} onSelect={() => runAction(onDelete)}>
          <Trash2 size={14} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
