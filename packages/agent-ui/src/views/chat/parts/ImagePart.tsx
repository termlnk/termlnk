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

import type { IImagePart } from '@termlnk/agent';
import { memo } from 'react';

interface IImagePartProps {
  part: IImagePart;
}

export const ImagePart = memo(function ImagePart({ part }: IImagePartProps) {
  return (
    <img
      src={`data:${part.mimeType};base64,${part.data}`}
      alt=""
      className="tm:max-h-32 tm:max-w-full tm:rounded-sm tm:object-contain"
    />
  );
});
