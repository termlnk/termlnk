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

import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../common/cn';
import { Button } from '../button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../input';

const Combobox = ComboboxPrimitive.Root;

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn(`
        tm:cursor-pointer tm:items-center tm:transition-colors
        tm:hover:text-white
        tm:[&_svg:not([class*='size-'])]:size-4
      `, className)}
      {...props}
    >
      {children}
      <ChevronDownIcon
        className="tm:pointer-events-none tm:size-4 tm:text-grey-fg tm:opacity-50"
      />
    </ComboboxPrimitive.Trigger>
  );
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      className={cn(className)}
      {...props}
      render={(
        <InputGroupButton variant="ghost" size="icon-xs">
          <XIcon
            className="tm:pointer-events-none"
          />
        </InputGroupButton>
      )}
    />
  );
}

function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  ...props
}: ComboboxPrimitive.Input.Props & {
  showTrigger?: boolean;
  showClear?: boolean;
}) {
  return (
    <InputGroup
      className={cn(`
        tm:w-auto
        tm:hover:border-blue
      `, className)}
    >
      <ComboboxPrimitive.Input
        render={<InputGroupInput disabled={disabled} />}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            data-slot="input-group-button"
            className="
              tm:group-has-data-[slot=combobox-clear]/input-group:hidden
              tm:hover:bg-transparent
              tm:data-pressed:bg-transparent
            "
            disabled={disabled}
            asChild
          >
            <ComboboxTrigger />
          </InputGroupButton>
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  );
}

function ComboboxContent({
  className,
  side = 'bottom',
  sideOffset = 6,
  align = 'start',
  alignOffset = 0,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    'side' | 'align' | 'sideOffset' | 'alignOffset' | 'anchor'
  >) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="tm:isolate tm:z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={!!anchor}
          className={cn(`
            tm:group/combobox-content
            tm:relative tm:z-50 tm:max-h-(--available-height) tm:w-fit tm:max-w-[min(28rem,var(--available-width))]
            tm:min-w-(--anchor-width) tm:origin-(--transform-origin) tm:overflow-hidden tm:rounded-md tm:border
            tm:border-line tm:bg-black tm:text-white tm:shadow-lg
            tm:data-closed:animate-out tm:data-closed:fade-out-0 tm:data-closed:zoom-out-95
            tm:data-open:animate-in tm:data-open:fade-in-0 tm:data-open:zoom-in-95
            tm:data-[chips=true]:min-w-(--anchor-width)
            tm:data-[side=bottom]:slide-in-from-top-2
            tm:data-[side=inline-end]:slide-in-from-left-2
            tm:data-[side=inline-start]:slide-in-from-right-2
            tm:data-[side=left]:slide-in-from-right-2
            tm:data-[side=right]:slide-in-from-left-2
            tm:data-[side=top]:slide-in-from-bottom-2
            tm:*:data-[slot=input-group]:m-1 tm:*:data-[slot=input-group]:mb-0 tm:*:data-[slot=input-group]:h-8
            tm:*:data-[slot=input-group]:border-line tm:*:data-[slot=input-group]:bg-one-bg
            tm:*:data-[slot=input-group]:shadow-none
          `, className)}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        `
          tm:no-scrollbar
          tm:max-h-[min(18rem,calc(var(--available-height)-2.25rem))] tm:scroll-py-1 tm:overflow-y-auto
          tm:overscroll-contain tm:p-1
          tm:data-empty:p-0
        `,
        className
      )}
      {...props}
    />
  );
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        `
          tm:relative tm:flex tm:w-full tm:cursor-pointer tm:items-center tm:gap-2 tm:rounded-xs tm:py-1.5 tm:pr-8
          tm:pl-2 tm:text-sm tm:text-white tm:outline-hidden tm:select-none
          tm:hover:bg-one-bg2 tm:hover:text-white
          tm:focus:bg-one-bg3 tm:focus:text-white
          tm:data-disabled:pointer-events-none tm:data-disabled:opacity-50
          tm:data-highlighted:bg-one-bg3 tm:data-highlighted:text-white
          tm:[&_svg]:pointer-events-none tm:[&_svg]:shrink-0 tm:[&_svg]:text-white
          tm:[&_svg:not([class*='size-'])]:size-4
        `,
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={(
          <span
            className={`
              tm:pointer-events-none tm:absolute tm:right-2 tm:flex tm:size-4 tm:items-center tm:justify-center
            `}
          >
            <CheckIcon
              className="tm:pointer-events-none tm:text-white"
            />
          </span>
        )}
      />
    </ComboboxPrimitive.Item>
  );
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={cn(className)}
      {...props}
    />
  );
}

function ComboboxLabel({
  className,
  ...props
}: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn('tm:px-2 tm:py-1.5 tm:text-xs tm:text-grey-fg', className)}
      {...props}
    />
  );
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
  return (
    <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />
  );
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(`
        tm:hidden tm:w-full tm:justify-center tm:py-2 tm:text-center tm:text-sm tm:text-grey-fg
        tm:group-data-empty/combobox-content:flex
      `, className)}
      {...props}
    />
  );
}

function ComboboxSeparator({
  className,
  ...props
}: ComboboxPrimitive.Separator.Props) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn('tm:-mx-1 tm:my-1 tm:h-px tm:bg-line', className)}
      {...props}
    />
  );
}

function ComboboxChips({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
  ComboboxPrimitive.Chips.Props) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn(`
        tm:flex tm:min-h-8 tm:flex-wrap tm:items-center tm:gap-1 tm:rounded-lg tm:border tm:border-one-bg3 tm:bg-black
        tm:bg-clip-padding tm:px-2.5 tm:py-1 tm:text-sm tm:text-light-grey tm:transition-colors
        tm:focus-within:border-blue tm:focus-within:ring-[3px] tm:focus-within:ring-blue/50
        tm:has-aria-invalid:border-red tm:has-aria-invalid:ring-[3px] tm:has-aria-invalid:ring-red/20
        tm:has-data-[slot=combobox-chip]:px-1
      `, className)}
      {...props}
    />
  );
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: ComboboxPrimitive.Chip.Props & {
  showRemove?: boolean;
}) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        `
          tm:flex tm:h-6 tm:w-fit tm:items-center tm:justify-center tm:gap-1 tm:rounded-xs tm:bg-one-bg2 tm:px-1.5
          tm:text-xs tm:font-medium tm:whitespace-nowrap tm:text-light-grey
          tm:has-data-[slot=combobox-chip-remove]:pr-0
          tm:data-disabled:pointer-events-none tm:data-disabled:cursor-not-allowed tm:data-disabled:opacity-50
        `,
        className
      )}
      {...props}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          className={`
            tm:-ml-1 tm:opacity-50
            tm:hover:opacity-100
          `}
          data-slot="combobox-chip-remove"
          render={(
            <Button variant="ghost" size="icon-xs">
              <XIcon
                className="tm:pointer-events-none"
              />
            </Button>
          )}
        />
      )}
    </ComboboxPrimitive.Chip>
  );
}

function ComboboxChipsInput({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={cn(
        `
          tm:min-w-16 tm:flex-1 tm:bg-transparent tm:text-light-grey tm:outline-hidden
          tm:placeholder:text-grey-fg
        `,
        className
      )}
      {...props}
    />
  );
}

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null);
}

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
};
