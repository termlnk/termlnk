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
import { useRef } from 'react';
import { cn } from '../../common/cn';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../alert-dialog';
import { buttonVariants } from '../button';

export type IConfirmVariant = 'primary' | 'destructive';

export interface IConfirmProps {
  /** Whether the dialog is visible. Controlled. */
  open?: boolean;

  /** Called when the user dismisses without confirming (cancel button, esc, or outside interaction). */
  onCancel?: () => void;

  /** Called when the user confirms via the action button. */
  onConfirm?: () => void;

  /** Dialog title. */
  title?: ReactNode;

  /** Body content. Pass plain text for a single paragraph, or any ReactNode for richer layouts. */
  description?: ReactNode;

  /** Cancel button label. Falls back to the active locale's default cancel string. */
  cancelText?: ReactNode;

  /** Confirm button label. Falls back to the active locale's default confirm string. */
  confirmText?: ReactNode;

  /**
   * Visual treatment for the confirm action.
   * - 'primary' (default): blue, used for benign confirmations
   * - 'destructive': red, used for irreversible / data-loss actions (revoke device, delete host, …)
   */
  confirmVariant?: IConfirmVariant;
}

const DEFAULT_CANCEL_TEXT = 'Cancel';
const DEFAULT_CONFIRM_TEXT = 'Confirm';

export function Confirm(props: IConfirmProps) {
  const {
    open = false,
    onCancel,
    onConfirm,
    title,
    description,
    cancelText,
    confirmText,
    confirmVariant = 'primary',
  } = props;

  // Tracks why the dialog is closing on the current tick. Reset every render
  // cycle by Radix's own state changes; we only ever inspect it inside
  // `onOpenChange(false)` immediately after a click handler set it.
  const closeIntentRef = useRef<'confirm' | 'cancel' | null>(null);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          return;
        }
        const intent = closeIntentRef.current;
        closeIntentRef.current = null;
        if (intent === 'confirm') {
          // onConfirm was already invoked by the Action button's onClick;
          // do not double-fire and do not fall through to onCancel.
          return;
        }
        // 'cancel' (Cancel button) and null (esc / external dismiss) both
        // map to onCancel — the caller treats either as "user declined".
        onCancel?.();
      }}
    >
      <AlertDialogContent
        onEscapeKeyDown={() => {
          closeIntentRef.current = 'cancel';
        }}
      >
        <AlertDialogHeader>
          {title !== undefined && (
            <AlertDialogTitle className={cn('tm:text-white')}>{title}</AlertDialogTitle>
          )}
          {description !== undefined && (
            <AlertDialogDescription className={cn('tm:text-light-grey')}>
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              closeIntentRef.current = 'cancel';
            }}
          >
            {cancelText ?? DEFAULT_CANCEL_TEXT}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              closeIntentRef.current = 'confirm';
              onConfirm?.();
            }}
            className={cn(buttonVariants({ variant: confirmVariant }))}
          >
            {confirmText ?? DEFAULT_CONFIRM_TEXT}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
