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

import { useMemo } from 'react';

export interface ISlashCommandState {
  active: boolean;
  query: string;
  slashIndex: number;
}

const INACTIVE: ISlashCommandState = { active: false, query: '', slashIndex: -1 };

export function useSlashCommand(value: string, cursorPosition: number): ISlashCommandState {
  return useMemo(() => {
    if (cursorPosition <= 0 || cursorPosition > value.length) {
      return INACTIVE;
    }

    // Scan backward from cursor to find the nearest `/`
    let slashIndex = -1;
    for (let i = cursorPosition - 1; i >= 0; i -= 1) {
      const ch = value[i];
      if (ch === '/') {
        slashIndex = i;
        break;
      }
      // Stop scanning if we hit a newline
      if (ch === '\n') {
        return INACTIVE;
      }
    }

    if (slashIndex === -1) {
      return INACTIVE;
    }

    // Ensure `/` is at line start or preceded by whitespace
    if (slashIndex > 0) {
      const prev = value[slashIndex - 1];
      if (prev !== '\n' && prev !== ' ' && prev !== '\t') {
        return INACTIVE;
      }
    }

    // Extract query text between `/` and cursor
    const query = value.slice(slashIndex + 1, cursorPosition);

    // If query contains whitespace, slash command is inactive
    if (/\s/.test(query)) {
      return INACTIVE;
    }

    return { active: true, query, slashIndex };
  }, [value, cursorPosition]);
}
