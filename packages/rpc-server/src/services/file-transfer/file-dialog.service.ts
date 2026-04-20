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

import { createIdentifier } from '@termlnk/core';

export interface IFileDialogService {
  showSaveDialog(options: { defaultFileName?: string; title?: string }): Promise<string | null>;
  showOpenDialog(options: { title?: string; directory?: boolean; multiple?: boolean }): Promise<string[]>;
}
export const IFileDialogService = createIdentifier<IFileDialogService>('rpc-server.file-dialog-service');

export class NoopFileDialogService implements IFileDialogService {
  async showSaveDialog(): Promise<string | null> {
    return null;
  }

  async showOpenDialog(): Promise<string[]> {
    return [];
  }
}
