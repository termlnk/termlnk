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

import { useCallback, useRef } from 'react';

export function useEvent<T extends (...params: any[]) => any>(func: T | undefined) {
  const funcRef = useRef(func);

  funcRef.current = func;
  return useCallback<T>(
    // eslint-disable-next-line react-hooks/use-memo
    ((...params) => {
      return funcRef.current?.(...params);
    }) as T,
    []
  );
}
