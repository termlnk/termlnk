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

// Styled wrapper around @rn-primitives/dropdown-menu, adapted from the
// multica/shadcn-rn pattern to use termlnk semantic tokens.

import type { StyleProp, ViewStyle } from 'react-native';
import * as DropdownMenuPrimitive from '@rn-primitives/dropdown-menu';
import { Platform } from 'react-native';
import { cn } from '../../lib/cn';
import { TextClassContext } from '../../lib/text-class-context';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;

function DropdownMenuOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Overlay>) {
  return (
    <DropdownMenuPrimitive.Overlay
      style={Platform.OS !== 'web' ? ABSOLUTE_FILL : undefined}
      className={cn('z-50', className)}
      closeOnPress
      {...props}
    />
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  side = 'bottom',
  align = 'end',
  portalHost,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  readonly portalHost?: string;
  readonly overlayClassName?: string;
}) {
  return (
    <DropdownMenuPrimitive.Portal hostName={portalHost}>
      <DropdownMenuOverlay className={overlayClassName} />
      <DropdownMenuPrimitive.Content
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-2xl bg-surface-raised p-1.5 shadow-md shadow-black/10',
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  readonly variant?: 'default' | 'destructive';
}) {
  return (
    <TextClassContext.Provider
      value={cn(
        'text-[16px]',
        {
          'text-danger': variant === 'destructive',
          'text-content': variant !== 'destructive',
        }
      )}
    >
      <DropdownMenuPrimitive.Item
        className={cn(
          'group flex-row items-center gap-3 rounded-xl px-4 py-3 active:bg-surface-sunken',
          { 'active:bg-danger/10': variant === 'destructive' },
          className
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('-mx-1 my-1.5 h-px bg-divider', className)}
      {...props}
    />
  );
}

const ABSOLUTE_FILL: StyleProp<ViewStyle> = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
