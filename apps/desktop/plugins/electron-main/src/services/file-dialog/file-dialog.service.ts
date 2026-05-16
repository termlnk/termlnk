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

import type { IFileDialogService } from '@termlnk/rpc-server';
import { dialog } from 'electron';

export class FileDialogService implements IFileDialogService {
  async showSaveDialog(options: { defaultFileName?: string; title?: string }): Promise<string | null> {
    const result = await dialog.showSaveDialog({
      title: options.title ?? 'Save file',
      defaultPath: options.defaultFileName,
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  }

  async showOpenDialog(options: { title?: string; directory?: boolean; multiple?: boolean }): Promise<string[]> {
    const properties: Array<'openFile' | 'openDirectory' | 'multiSelections'> = [];

    if (options.directory) {
      properties.push('openDirectory');
    } else {
      properties.push('openFile');
    }

    if (options.multiple) {
      properties.push('multiSelections');
    }

    const result = await dialog.showOpenDialog({
      title: options.title ?? 'Select files',
      properties,
    });

    if (result.canceled) {
      return [];
    }

    return result.filePaths;
  }
}
