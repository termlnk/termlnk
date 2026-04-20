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

import type { VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { useMemo } from 'react';
import { cn } from '../../common/cn';
import { Label } from '../label';
import { Separator } from '../separator';

function FieldSet({ className, ...props }: ComponentProps<'fieldset'>) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        'tm:flex tm:flex-col tm:gap-6',
        `
          tm:has-[>[data-slot=checkbox-group]]:gap-3
          tm:has-[>[data-slot=radio-group]]:gap-3
        `,
        className
      )}
      {...props}
    />
  );
}

function FieldLegend({
  className,
  variant = 'legend',
  ...props
}: ComponentProps<'legend'> & { variant?: 'legend' | 'label' }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        'tm:mb-3 tm:font-medium',
        'tm:data-[variant=legend]:text-base',
        'tm:data-[variant=label]:text-sm',
        className
      )}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        `
          tm:group/field-group
          tm:@container/field-group tm:flex tm:w-full tm:flex-col tm:gap-7
          tm:data-[slot=checkbox-group]:gap-3
          tm:*:data-[slot=field-group]:gap-4
        `,
        className
      )}
      {...props}
    />
  );
}

const fieldVariants = cva(
  `
    tm:group/field
    tm:flex tm:gap-3
    tm:data-[invalid=true]:text-red
  `,
  {
    variants: {
      orientation: {
        vertical: [`
          tm:flex-col
          tm:*:w-full
          tm:[&>.sr-only]:w-auto
        `],
        horizontal: [
          'tm:flex-row tm:items-center',
          'tm:*:data-[slot=field-label]:flex-auto',
          `
            tm:has-[>[data-slot=field-content]]:items-start
            tm:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px
          `,
        ],
        responsive: [
          `
            tm:flex-col
            tm:*:w-full
            tm:@md/field-group:flex-row tm:@md/field-group:items-center
            tm:@md/field-group:*:w-auto
            tm:[&>.sr-only]:w-auto
          `,
          'tm:@md/field-group:*:data-[slot=field-label]:flex-auto',
          `
            tm:@md/field-group:has-[>[data-slot=field-content]]:items-start
            tm:@md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px
          `,
        ],
      },
    },
    defaultVariants: {
      orientation: 'vertical',
    },
  }
);

function Field({
  className,
  orientation = 'vertical',
  ...props
}: ComponentProps<'div'> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

function FieldContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        `
          tm:group/field-content
          tm:flex tm:flex-1 tm:flex-col tm:gap-1.5 tm:leading-snug
        `,
        className
      )}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        `
          tm:group/field-label tm:peer/field-label
          tm:flex tm:w-fit tm:gap-2 tm:leading-snug tm:text-white
          tm:group-data-[disabled=true]/field:opacity-50
        `,
        `
          tm:has-[>[data-slot=field]]:w-full tm:has-[>[data-slot=field]]:flex-col tm:has-[>[data-slot=field]]:rounded-md
          tm:has-[>[data-slot=field]]:border
          tm:*:data-[slot=field]:p-4
        `,
        'tm:has-data-[state=checked]:border-blue tm:has-data-[state=checked]:bg-blue/10',
        className
      )}
      {...props}
    />
  );
}

function FieldTitle({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        `
          tm:flex tm:w-fit tm:items-center tm:gap-2 tm:text-sm/snug tm:font-medium
          tm:group-data-[disabled=true]/field:opacity-50
        `,
        className
      )}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        `
          tm:text-sm/normal tm:font-normal tm:text-grey-fg
          tm:group-has-data-[orientation=horizontal]/field:text-balance
        `,
        `
          tm:last:mt-0
          tm:nth-last-2:-mt-1
          tm:[[data-variant=legend]+&]:-mt-1.5
        `,
        `
          tm:[&>a]:underline tm:[&>a]:underline-offset-4
          tm:[&>a:hover]:text-blue
        `,
        className
      )}
      {...props}
    />
  );
}

function FieldSeparator({
  children,
  className,
  ...props
}: ComponentProps<'div'> & {
  children?: ReactNode;
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        `
          tm:relative tm:-my-2 tm:h-5 tm:text-sm
          tm:group-data-[variant=outline]/field-group:-mb-2
        `,
        className
      )}
      {...props}
    >
      <Separator className="tm:absolute tm:inset-0 tm:top-1/2" />
      {children && (
        <span
          className="tm:relative tm:mx-auto tm:block tm:w-fit tm:bg-black tm:px-2 tm:text-light-grey"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  );
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: ComponentProps<'div'> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors?.length) {
      return null;
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ];

    if (uniqueErrors?.length === 1) {
      return uniqueErrors[0]?.message;
    }

    return (
      <ul className="tm:ml-4 tm:flex tm:list-disc tm:flex-col tm:gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn('tm:text-xs tm:font-normal tm:text-red', className)}
      {...props}
    >
      {content}
    </div>
  );
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};
