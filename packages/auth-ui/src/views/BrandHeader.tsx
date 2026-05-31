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

import { cn, LogoIcon } from '@termlnk/design';

export interface IBrandHeaderProps {
  readonly title: string;
  readonly subtitle: string;
}

export function BrandHeader(props: IBrandHeaderProps) {
  return (
    <div className={cn('tm:flex tm:flex-col tm:items-center tm:gap-3 tm:py-1 tm:text-center')}>
      <LogoIcon className={cn('tm:size-11')} />
      <div className={cn('tm:flex tm:flex-col tm:gap-1.5')}>
        <h2 className={cn('tm:text-lg tm:font-semibold tm:text-white')}>
          {props.title}
        </h2>
        <p className={cn('tm:text-sm tm:text-grey-fg')}>
          {props.subtitle}
        </p>
      </div>
    </div>
  );
}
