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
import { Button, Field, FieldContent, FieldLabel, useDependency, useObservable } from '@termlnk/design';
import { Check, Copy } from 'lucide-react';
import { useCallback, useState } from 'react';
import { IKnownHostDetailDialogService } from '../../services/known-hosts/known-host-detail-dialog.service';

const valueCls = `
  tm:rounded-md tm:border tm:border-line tm:bg-one-bg3 tm:px-2.5 tm:py-1.5 tm:text-[12px] tm:break-all
  tm:text-light-grey
`;

export function KnownHostDetailDialog() {
  const localeService = useDependency(LocaleService);
  const detailDialogService = useDependency(IKnownHostDetailDialogService);
  const t = useCallback((k: string) => localeService.t(k), [localeService]);

  const state = useObservable(detailDialogService.state$, detailDialogService.getState());
  const host = state.host;

  if (!host) {
    return null;
  }

  return (
    <div className="tm:flex tm:flex-col tm:gap-4">
      <div className="tm:flex tm:gap-3">
        <Field className="tm:flex-1">
          <FieldLabel>{t('terminal-ui.knownHosts.detail.host')}</FieldLabel>
          <FieldContent><div className={valueCls}>{host.host}</div></FieldContent>
        </Field>
        <Field className="tm:w-24">
          <FieldLabel>{t('terminal-ui.knownHosts.detail.port')}</FieldLabel>
          <FieldContent><div className={valueCls}>{host.port}</div></FieldContent>
        </Field>
      </div>

      <Field>
        <FieldLabel>{t('terminal-ui.knownHosts.detail.keyType')}</FieldLabel>
        <FieldContent><div className={valueCls}>{host.keyType}</div></FieldContent>
      </Field>

      <Field>
        <FieldLabel>{t('terminal-ui.knownHosts.detail.fingerprint')}</FieldLabel>
        <FieldContent><CopyableValue value={host.fingerprint} /></FieldContent>
      </Field>

      {host.publicKey && (
        <Field>
          <FieldLabel>{t('terminal-ui.knownHosts.detail.publicKey')}</FieldLabel>
          <FieldContent>
            <CopyableValue value={`${host.keyType} ${host.publicKey}`} mono />
          </FieldContent>
        </Field>
      )}

      <div className="tm:flex tm:justify-end">
        <Button variant="outline" size="sm" onClick={() => detailDialogService.close()}>
          {t('terminal-ui.knownHosts.detail.close')}
        </Button>
      </div>
    </div>
  );
}

function CopyableValue({ value, mono }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(setCopied, 1200, false);
    }).catch(() => {});
  }, [value]);

  return (
    <div className="tm:flex tm:items-start tm:gap-1.5">
      <div
        className={`
          tm:min-w-0 tm:flex-1 tm:rounded-md tm:border tm:border-line tm:bg-one-bg3 tm:px-2.5 tm:py-1.5 tm:text-[12px]
          tm:break-all tm:text-light-grey
          ${mono ? 'tm:font-mono tm:text-[11px]' : ''}
        `}
      >
        {value}
      </div>
      <Button variant="ghost" size="icon-sm" onClick={copy}>
        {copied ? <Check size={14} className="tm:text-green" /> : <Copy size={14} />}
      </Button>
    </div>
  );
}
