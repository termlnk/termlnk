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
import { Button, cn, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, FieldContent, FieldGroup, FieldLabel, Input, useDependency } from '@termlnk/design';
import { useCallback, useMemo, useState } from 'react';

interface IAddSkillRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (repository: ISkillRepository) => void | Promise<void>;
}

export function AddSkillRepositoryDialog({ open, onOpenChange, onAdded }: IAddSkillRepositoryDialogProps) {
  const localeService = useDependency(LocaleService);
  const skillService = useDependency(ISkillService);

  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState('');
  const [subdirectory, setSubdirectory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => repository.trim().length > 0, [repository]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setRepository('');
      setBranch('');
      setSubdirectory('');
      setSaving(false);
      setError('');
    }
  }, [onOpenChange]);

  const handleAddRepository = useCallback(async () => {
    if (!canSubmit || saving) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const addedRepository = await skillService.addRepository({
        repository: repository.trim(),
        branch: branch.trim() || undefined,
        subdirectory: subdirectory.trim() || undefined,
      });

      handleOpenChange(false);
      await onAdded(addedRepository);
    } catch (err) {
      setError(err instanceof Error ? err.message : localeService.t('settings-ui.skill.add-repository-error'));
    } finally {
      setSaving(false);
    }
  }, [branch, canSubmit, handleOpenChange, localeService, onAdded, repository, saving, skillService, subdirectory]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader className="tm:gap-1">
          <DialogTitle className="tm:text-base">
            {localeService.t('settings-ui.skill.add-repository')}
          </DialogTitle>
          <DialogDescription className="tm:text-xs tm:text-light-grey">
            {localeService.t('settings-ui.skill.add-repository-description')}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="tm:gap-4">
          <Field>
            <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
              {localeService.t('settings-ui.skill.repository')}
            </FieldLabel>
            <FieldContent>
              <Input
                className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                value={repository}
                onChange={(event) => setRepository(event.target.value)}
                placeholder={localeService.t('settings-ui.skill.repository-placeholder')}
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
              {localeService.t('settings-ui.skill.repository-branch')}
            </FieldLabel>
            <FieldContent>
              <Input
                className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                placeholder={localeService.t('settings-ui.skill.repository-branch-placeholder')}
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel className={cn('tm:text-xs tm:font-medium tm:text-white')}>
              {localeService.t('settings-ui.skill.repository-subdirectory')}
            </FieldLabel>
            <FieldContent>
              <Input
                className={cn('tm:h-8 tm:px-2 tm:py-1 tm:text-xs')}
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
          <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
            {localeService.t('settings-ui.skill.cancel')}
          </Button>
          <Button variant="primary" size="sm" disabled={!canSubmit || saving} onClick={() => void handleAddRepository()}>
            {localeService.t('settings-ui.skill.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
