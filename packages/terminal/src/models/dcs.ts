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

/**
 * XTVERSION response data
 */
export interface IXtVersionData {
  /** Terminal name */
  name: string;
  /** Terminal version */
  version: string;
}

/**
 * XTGETTCAP request data
 */
export interface IXtGetTcapData {
  /** Hex-encoded capability names */
  names: string[];
}

/**
 * DECRQSS request settings
 */
export type DecrqssSetting = 'sgr' | 'decstbm' | 'decslrm' | 'decscusr';

/**
 * DECRQSS request data
 */
export interface IDecrqssData {
  /** The setting being requested */
  setting: DecrqssSetting;
  /** Raw setting string from the sequence */
  rawSetting: string;
}

/**
 * Discriminated union of all DCS commands
 */
export type DcsCommand =
  | IDcsXtVersionCommand
  | IDcsXtGetTcapCommand
  | IDcsDecrqssCommand
  | IDcsUnknownCommand;

export interface IDcsXtVersionCommand {
  type: 'XTVERSION';
}

export interface IDcsXtGetTcapCommand {
  type: 'XTGETTCAP';
  data: IXtGetTcapData;
}

export interface IDcsDecrqssCommand {
  type: 'DECRQSS';
  data: IDecrqssData;
}

export interface IDcsUnknownCommand {
  type: 'UNKNOWN';
  rawData: string;
}
