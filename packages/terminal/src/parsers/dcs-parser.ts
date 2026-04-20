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

import type { DcsCommand } from '../models/dcs';
import type { IDcsSequence } from './dcs-stream-parser';

/**
 * Parse an extracted DCS sequence into a typed command
 *
 * Supported DCS sequences:
 * - XTGETTCAP: DCS + q <hex-names> ST
 * - DECRQSS: DCS $ q <setting> ST
 * - XTVERSION response: DCS > | <name>(<version>) ST
 *
 * @param seq - The extracted DCS sequence
 * @returns Parsed DCS command
 */
export function parseDcs(seq: IDcsSequence): DcsCommand {
  const data = seq.data;

  // XTGETTCAP: starts with "+q"
  if (data.startsWith('+q')) {
    const hexNames = data.substring(2).split(';').filter(Boolean);
    return {
      type: 'XTGETTCAP',
      data: { names: hexNames },
    };
  }

  // DECRQSS: starts with "$q"
  if (data.startsWith('$q')) {
    const rawSetting = data.substring(2);
    const setting = parseDecrqssSetting(rawSetting);
    return {
      type: 'DECRQSS',
      data: {
        setting,
        rawSetting,
      },
    };
  }

  // XTVERSION response: starts with ">|"
  if (data.startsWith('>|')) {
    return { type: 'XTVERSION' };
  }

  return { type: 'UNKNOWN', rawData: data };
}

function parseDecrqssSetting(raw: string): 'sgr' | 'decstbm' | 'decslrm' | 'decscusr' {
  switch (raw) {
    case 'm': return 'sgr';
    case 'r': return 'decstbm';
    case 's': return 'decslrm';
    case ' q': return 'decscusr';
    default: return 'sgr';
  }
}
