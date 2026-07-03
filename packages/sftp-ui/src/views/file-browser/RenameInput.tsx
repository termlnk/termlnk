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

import { Button, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogPrimitive, DialogTitle, Input } from '@termlnk/design';
import { useCallback, useEffect, useRef, useState } from 'react';

interface IRenameInputProps {
  currentName: string;
  onSubmit: (newName: string) => void;
  onCancel: () => void;
}

export function RenameInput({ currentName, onSubmit, onCancel }: IRenameInputProps) {
  const [value, setValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== currentName) {
      onSubmit(trimmed);
    } else {
      onCancel();
    }
  }, [value, currentName, onSubmit, onCancel]);

  return (
    <DialogPrimitive open onOpenChange={(open) => !open && onCancel()}>
      <DialogPortal>
        <DialogOverlay className="tm:bg-darker-black/70 tm:backdrop-blur-[1.5px]" />
        <DialogContent
          closable={false}
          className={`
            tm:w-[min(28rem,calc(100%-2rem))] tm:max-w-md tm:gap-3 tm:rounded-xl tm:border-line tm:bg-one-bg tm:p-5
            tm:shadow-[0_18px_52px_rgb(0_0_0/0.45)]
          `}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            onCancel();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            onCancel();
          }}
        >
          <DialogHeader className="tm:gap-1">
            <DialogTitle className="tm:text-[15px] tm:font-semibold tm:text-white">Rename</DialogTitle>
            <DialogDescription className="tm:text-[12px] tm:text-grey-fg">
              Enter a new name for
              {' '}
              <span className="tm:font-medium tm:text-light-grey">{currentName}</span>
            </DialogDescription>
          </DialogHeader>

          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit();
              }
              if (e.key === 'Escape') {
                onCancel();
              }
            }}
          />

          <DialogFooter
            className="
              tm:gap-2
              tm:sm:justify-end
            "
          >
            <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!value.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </DialogPrimitive>
  );
}
