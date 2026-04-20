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
 * This enum defines multiple lifecycle stages in termlnk SDK.
 */
export enum LifecycleStages {
  /**
   * Register plugins to termlnk.
   */
  Starting = 0,

  /**
   * Termlnk business instances are created and services or controllers provided by
   * plugins get initialized. The application is ready to do the first-time rendering.
   */
  Ready = 1,

  /**
   * First-time rendering is completed.
   */
  Rendered = 2,

  /**
   * All lazy tasks are completed. The application is fully ready to provide features to users.
   */
  Steady = 3,
}

export const LifecycleNameMap = {
  [LifecycleStages.Starting]: 'Starting',
  [LifecycleStages.Ready]: 'Ready',
  [LifecycleStages.Rendered]: 'Rendered',
  [LifecycleStages.Steady]: 'Steady',
};
