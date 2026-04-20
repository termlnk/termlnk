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

import { LocaleService } from '@termlnk/core';
import { Button, Dialog, Input, Spinner, useDependency } from '@termlnk/design';
import { IExtensionService } from '@termlnk/extension';
import { TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface IInstallFromNpmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallFromNpmDialog({ open, onOpenChange }: IInstallFromNpmDialogProps) {
  const localeService = useDependency(LocaleService);
  const extensionService = useDependency(IExtensionService);

  const [extensionId, setExtensionId] = useState('');
  const [npmPackage, setNpmPackage] = useState('');
  const [version, setVersion] = useState('latest');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setExtensionId('');
      setNpmPackage('');
      setVersion('latest');
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  const canSubmit = extensionId.trim().length > 0 && npmPackage.trim().length > 0 && version.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await extensionService.installRemoteExtension({
        extensionId: extensionId.trim(),
        npmPackage: npmPackage.trim(),
        version: version.trim(),
      });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, extensionId, extensionService, npmPackage, onOpenChange, version]);

  const footer = (
    <div className="tm:flex tm:justify-end tm:gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={submitting}
        onClick={() => onOpenChange(false)}
      >
        {localeService.t('extension-ui.dialog.installFromNpm.cancel')}
      </Button>
      <Button
        variant="primary"
        size="sm"
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {submitting && <Spinner className="tm:size-3" />}
        {localeService.t('extension-ui.dialog.installFromNpm.submit')}
      </Button>
    </div>
  );

  return (
    <Dialog
      open={open}
      width={420}
      title={localeService.t('extension-ui.dialog.installFromNpm.title')}
      footer={footer}
      onOpenChange={onOpenChange}
    >
      <div className="tm:flex tm:flex-col tm:gap-3 tm:py-2">
        <div className="tm:flex tm:flex-col tm:gap-1">
          <label className="tm:text-xs tm:text-light-grey">
            {localeService.t('extension-ui.dialog.installFromNpm.extensionId')}
          </label>
          <Input
            className="tm:h-8 tm:text-xs"
            placeholder="publisher.extension-name"
            value={extensionId}
            disabled={submitting}
            onChange={(event) => setExtensionId(event.target.value)}
          />
        </div>

        <div className="tm:flex tm:flex-col tm:gap-1">
          <label className="tm:text-xs tm:text-light-grey">
            {localeService.t('extension-ui.dialog.installFromNpm.packageName')}
          </label>
          <Input
            className="tm:h-8 tm:text-xs"
            placeholder="@scope/termlnk-ext-name"
            value={npmPackage}
            disabled={submitting}
            onChange={(event) => setNpmPackage(event.target.value)}
          />
        </div>

        <div className="tm:flex tm:flex-col tm:gap-1">
          <label className="tm:text-xs tm:text-light-grey">
            {localeService.t('extension-ui.dialog.installFromNpm.version')}
          </label>
          <Input
            className="tm:h-8 tm:text-xs"
            placeholder="latest"
            value={version}
            disabled={submitting}
            onChange={(event) => setVersion(event.target.value)}
          />
        </div>

        {error && (
          <div
            className="
              tm:flex tm:items-start tm:gap-1.5 tm:rounded-md tm:bg-red/10 tm:px-2 tm:py-1.5 tm:text-xs tm:text-red
            "
          >
            <TriangleAlert className="tm:mt-0.5 tm:size-3 tm:shrink-0" />
            <span className="tm:wrap-break-word">{error}</span>
          </div>
        )}
      </div>
    </Dialog>
  );
}
