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

import { cn } from './cn';

const borderBasicClassName = 'tm:border-line tm:border-solid';
export const borderClassName = cn(borderBasicClassName, 'tm:border');
export const borderLeftBottomClassName = cn(borderBasicClassName, 'tm:border-l tm:border-b tm:border-t-0 tm:border-r-0');
export const borderLeftClassName = cn(borderBasicClassName, 'tm:border-l tm:border-b-0 tm:border-t-0 tm:border-r-0');
export const borderTopClassName = cn(borderBasicClassName, 'tm:border-l-0 tm:border-b-0 tm:border-t tm:border-r-0');
export const borderBottomClassName = cn(borderBasicClassName, 'tm:border-l-0 tm:border-b tm:border-t-0 tm:border-r-0');
export const borderRightClassName = cn(borderBasicClassName, 'tm:border-l-0 tm:border-b-0 tm:border-t-0 tm:border-r');
export const divideYClassName = 'tm:divide-line tm:divide-y tm:divide-x-0 tm:divide-solid';
export const divideXClassName = 'tm:divide-line tm:divide-x tm:divide-y-0 tm:divide-solid';
