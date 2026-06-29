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

// One-shot hand-off for the Package picker. expo-router cannot return a value
// through router.back(), so the picker stashes the choice here and the editor
// consumes it via useFocusEffect when it regains focus.
export interface IPackageSelection {
  readonly packageId: string;
  readonly label: string;
}

let _pending: IPackageSelection | null = null;

export function setPendingPackageSelection(selection: IPackageSelection): void {
  _pending = selection;
}

export function takePendingPackageSelection(): IPackageSelection | null {
  const value = _pending;
  _pending = null;
  return value;
}
