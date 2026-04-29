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

import type { IErrorPart } from '@termlnk/agent';
import { memo } from 'react';

interface IErrorPartProps {
  part: IErrorPart;
}

export const ErrorPart = memo(function ErrorPart({ part }: IErrorPartProps) {
  return (
    <div className="tm:rounded-lg tm:border tm:border-red/20 tm:bg-red/5 tm:px-3 tm:py-2 tm:text-sm tm:text-red">
      {part.message}
    </div>
  );
});
