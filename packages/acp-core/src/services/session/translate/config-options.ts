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

import type { SessionConfigOption, SessionConfigSelectOption } from '@agentclientprotocol/sdk';
import type { IACPSessionModel } from '@termlnk/acp';

export interface IACPModelSelection {
  currentModelId?: string;
  availableModels?: IACPSessionModel[];
}

/**
 * ACP exposes the model picker as a session config option rather than a
 * dedicated field: `session/new` returns `configOptions`, and selecting a model
 * is `session/set_config_option` with that option's id (see
 * ACPConnection.setModel). Agents disagree on how they identify it, so match on
 * the semantic `category` first and fall back to the conventional `model` id.
 */
export function translateModelSelection(
  options: readonly SessionConfigOption[] | null | undefined
): IACPModelSelection {
  const option = findModelOption(options);
  if (!option || option.type !== 'select') {
    return {};
  }
  return {
    currentModelId: option.currentValue,
    availableModels: flattenSelectOptions(option.options).map((o) => ({
      id: o.value,
      name: o.name,
    })),
  };
}

/** The config option id to drive `session/set_config_option` with, if any. */
export function findModelConfigId(
  options: readonly SessionConfigOption[] | null | undefined
): string | undefined {
  return findModelOption(options)?.id;
}

function findModelOption(
  options: readonly SessionConfigOption[] | null | undefined
): SessionConfigOption | undefined {
  if (!options?.length) {
    return undefined;
  }
  return options.find((o) => o.category === 'model') ?? options.find((o) => o.id === 'model');
}

/** Select options are either a flat list or grouped; the UI shows one flat list. */
function flattenSelectOptions(
  options: Extract<SessionConfigOption, { type: 'select' }>['options']
): SessionConfigSelectOption[] {
  return options.flatMap((entry) => ('group' in entry ? entry.options : [entry]));
}
