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

import type { ISkillRepository } from '@termlnk/agent';
import { ISkillService } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, FieldContent, FieldGroup, FieldLabel, Input, useDependency } from '@termlnk/design';
import { useCallback, useEffect, useMemo, useState } from 'react';

const compactInputCls = 'tm:h-8 tm:px-2 tm:py-1 tm:text-xs';
const inputLabelCls = 'tm:text-xs tm:font-medium tm:text-white';

interface IEditSkillRepositoryDialogProps {
  open: boolean;
  repository: ISkillRepository | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (repository: ISkillRepository, previousRepositoryId: string) => void | Promise<void>;
}

export function EditSkillRepositoryDialog(props: IEditSkillRepositoryDialogProps) {
  const { open, repository, onOpenChange, onUpdated } = props;
  const localeService = useDependency(LocaleService);
  const skillService = useDependency(ISkillService);

  const [repositoryValue, setRepositoryValue] = useState('');
  const [branch, setBranch] = useState('');
  const [subdirectory, setSubdirectory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !repository) {
      return;
    }

    setRepositoryValue(`${repository.owner}/${repository.repo}`);
    setBranch(repository.branch ?? '');
    setSubdirectory(repository.subdirectory ?? '');
    setSaving(false);
    setError('');
  }, [open, repository]);

  const canSubmit = useMemo(() => repositoryValue.trim().length > 0 && !!repository, [repository, repositoryValue]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setSaving(false);
      setError('');
    }
  }, [onOpenChange]);

  const handleUpdateRepository = useCallback(async () => {
    if (!repository || !canSubmit || saving) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const updatedRepository = await skillService.updateRepository({
        id: repository.id,
        repository: repositoryValue.trim(),
        branch: branch.trim() || undefined,
        subdirectory: subdirectory.trim() || undefined,
      });

      handleOpenChange(false);
      await onUpdated(updatedRepository, repository.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : localeService.t('settings-ui.skill.edit-repository-error'));
    } finally {
      setSaving(false);
    }
  }, [branch, canSubmit, handleOpenChange, localeService, onUpdated, repository, repositoryValue, saving, skillService, subdirectory]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader className="tm:gap-1">
          <DialogTitle className="tm:text-base">
            {localeService.t('settings-ui.skill.edit-repository')}
          </DialogTitle>
          <DialogDescription className="tm:text-xs/relaxed tm:text-light-grey">
            {localeService.t('settings-ui.skill.edit-repository-description')}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="tm:gap-4">
          <Field>
            <FieldLabel className={inputLabelCls}>
              {localeService.t('settings-ui.skill.repository')}
            </FieldLabel>
            <FieldContent>
              <Input
                className={compactInputCls}
                value={repositoryValue}
                onChange={(event) => setRepositoryValue(event.target.value)}
                placeholder={localeService.t('settings-ui.skill.repository-placeholder')}
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel className={inputLabelCls}>
              {localeService.t('settings-ui.skill.repository-branch')}
            </FieldLabel>
            <FieldContent>
              <Input
                className={compactInputCls}
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                placeholder={localeService.t('settings-ui.skill.repository-branch-placeholder')}
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel className={inputLabelCls}>
              {localeService.t('settings-ui.skill.repository-subdirectory')}
            </FieldLabel>
            <FieldContent>
              <Input
                className={compactInputCls}
                value={subdirectory}
                onChange={(event) => setSubdirectory(event.target.value)}
                placeholder={localeService.t('settings-ui.skill.repository-subdirectory-placeholder')}
              />
            </FieldContent>
          </Field>

          {error && (
            <div
              className="tm:rounded-xl tm:border tm:border-red/25 tm:bg-red/10 tm:px-3 tm:py-2 tm:text-xs tm:text-red"
            >
              {error}
            </div>
          )}
        </FieldGroup>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            {localeService.t('settings-ui.skill.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSubmit || saving}
            onClick={() => handleUpdateRepository()}
          >
            {localeService.t('settings-ui.skill.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
