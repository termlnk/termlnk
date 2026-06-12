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
import { Button, cn, useDependency } from '@termlnk/design';
import { AuthEventController } from '../../controllers/auth-event.controller';
import { useAuthEvent } from '../hooks/use-auth-event';

const outlineBtnClass = `
  tm:border-one-bg tm:text-light-grey tm:shadow-none
  tm:hover:border-blue tm:hover:text-blue
`;

export function HostKeyPromptDialog() {
  const localeService = useDependency(LocaleService);
  const controller = useDependency(AuthEventController);
  const pending = useAuthEvent();

  if (!pending || pending.event.type !== 'host_key_prompt') {
    return null;
  }

  const { ruleId, event, connectionFailed, error } = pending;
  const { algorithm, fingerprint, changed, knownFingerprint } = event;

  const title = localeService.t(
    changed
      ? 'port-forwarding-ui.auth.hostKey.changedTitle'
      : 'port-forwarding-ui.auth.hostKey.unknownTitle'
  );
  const subtitle = localeService.t(
    changed
      ? 'port-forwarding-ui.auth.hostKey.changedSubtitle'
      : 'port-forwarding-ui.auth.hostKey.unknownSubtitle'
  );

  return (
    <div className={cn('tm:space-y-4 tm:p-1')}>
      <div
        className={cn('tm:rounded-xl tm:border tm:p-4', {
          'tm:border-red/40 tm:bg-red/10': changed,
          'tm:border-yellow/40 tm:bg-yellow/10': !changed,
        })}
      >
        <div
          className={cn('tm:text-[14px] tm:font-semibold', {
            'tm:text-red': changed,
            'tm:text-yellow': !changed,
          })}
        >
          {title}
        </div>
        <div className={cn('tm:mt-1 tm:text-[12px] tm:text-light-grey')}>
          {subtitle}
        </div>
        <div className={cn('tm:mt-3 tm:space-y-1 tm:text-[12px] tm:text-light-grey')}>
          <div>
            {localeService.t('port-forwarding-ui.auth.hostKey.algorithm')}
            {': '}
            <span className={cn('tm:font-mono tm:text-white')}>{algorithm}</span>
          </div>
          <div>
            {localeService.t('port-forwarding-ui.auth.hostKey.fingerprint')}
            {': '}
            <span className={cn('tm:font-mono tm:break-all tm:text-white')}>{fingerprint}</span>
          </div>
          {changed && knownFingerprint && (
            <div>
              {localeService.t('port-forwarding-ui.auth.hostKey.previousFingerprint')}
              {': '}
              <span className={cn('tm:font-mono tm:break-all tm:text-grey-fg')}>{knownFingerprint}</span>
            </div>
          )}
        </div>
      </div>
      {connectionFailed && (
        <div className={cn('tm:rounded-xl tm:border tm:border-red/40 tm:bg-red/10 tm:p-3 tm:text-[12px] tm:text-red')}>
          {error || localeService.t('port-forwarding-ui.auth.connectionFailed')}
        </div>
      )}
      <div className={cn('tm:flex tm:flex-wrap tm:items-center tm:gap-2')}>
        {!connectionFailed && (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={() => controller.respondHostKeyPrompt(ruleId, 'accept_save')}
            >
              {localeService.t(
                changed
                  ? 'port-forwarding-ui.auth.hostKey.replace'
                  : 'port-forwarding-ui.auth.hostKey.addAndContinue'
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={outlineBtnClass}
              onClick={() => controller.respondHostKeyPrompt(ruleId, 'accept_once')}
            >
              {localeService.t('port-forwarding-ui.auth.hostKey.acceptOnce')}
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          className={outlineBtnClass}
          onClick={() => controller.respondHostKeyPrompt(ruleId, 'reject')}
        >
          {localeService.t('port-forwarding-ui.auth.hostKey.reject')}
        </Button>
      </div>
    </div>
  );
}
