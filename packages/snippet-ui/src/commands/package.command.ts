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

import type { IAccessor, ICommand } from '@termlnk/core';
import { IConfirmService, LocaleService } from '@termlnk/core';
import { ISnippetService } from '@termlnk/snippet';
import { ISnippetContextService } from '../services/snippet-context/snippet-context.service';

export const RenamePackageCommand: ICommand = {
  id: 'snippet-ui.command.rename-package',
  handler: (accessor: IAccessor): boolean => {
    const ctx = accessor.get(ISnippetContextService);
    const pkg = ctx.packageTarget;
    if (!pkg) {
      return false;
    }
    ctx.requestPackageRename(pkg.id);
    return true;
  },
};

export const DeletePackageCommand: ICommand = {
  id: 'snippet-ui.command.delete-package',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const ctx = accessor.get(ISnippetContextService);
    const pkg = ctx.packageTarget;
    if (!pkg) {
      return false;
    }
    const confirmService = accessor.get(IConfirmService);
    const localeService = accessor.get(LocaleService);
    const confirmed = await confirmService.confirm({
      id: `delete-package-${pkg.id}`,
      title: { title: 'snippet-ui.contextMenu.deletePackage' },
      description: { title: localeService.t('snippet-ui.confirm.deletePackageDesc', pkg.label) },
      confirmText: localeService.t('snippet-ui.confirm.delete'),
      confirmVariant: 'destructive',
      cancelText: localeService.t('snippet-ui.confirm.cancel'),
    });
    if (!confirmed) {
      return false;
    }
    await accessor.get(ISnippetService).deletePackage(pkg.id);
    return true;
  },
};
