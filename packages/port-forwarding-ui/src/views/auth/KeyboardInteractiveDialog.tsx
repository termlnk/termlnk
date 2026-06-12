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
import { Button, cn, Input, useDependency } from '@termlnk/design';
import { useCallback, useState } from 'react';
import { AuthEventController } from '../../controllers/auth-event.controller';
import { useAuthEvent } from '../hooks/use-auth-event';

export function KeyboardInteractiveDialog() {
  const localeService = useDependency(LocaleService);
  const controller = useDependency(AuthEventController);
  const pending = useAuthEvent();
  const [responses, setResponses] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');

  const ruleId = pending?.ruleId ?? '';
  const connectionFailed = pending?.connectionFailed ?? false;
  const connectionError = pending?.error;
  const eventType = pending?.event.type;
  const kbEvent = eventType === 'keyboard_interactive' ? pending!.event : null;
  const cpEvent = eventType === 'change_password' ? pending!.event : null;

  const handleChange = useCallback((index: number, value: string) => {
    setResponses((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!ruleId) {
      return;
    }
    if (cpEvent) {
      controller.respondChangePassword(ruleId, newPassword);
      setNewPassword('');
    } else {
      controller.respondKeyboardInteractive(ruleId, responses);
      setResponses([]);
    }
  }, [controller, ruleId, cpEvent, newPassword, responses]);

  const handleCancel = useCallback(() => {
    if (!ruleId) {
      return;
    }
    if (cpEvent) {
      controller.respondChangePassword(ruleId, '');
      setNewPassword('');
    } else {
      controller.respondKeyboardInteractive(ruleId, []);
      setResponses([]);
    }
  }, [controller, ruleId, cpEvent]);

  if (!kbEvent && !cpEvent) {
    return null;
  }

  return (
    <div className={cn('tm:space-y-4 tm:p-1')}>
      {kbEvent && kbEvent.instructions && (
        <div className={cn('tm:text-[12px] tm:text-light-grey')}>
          {kbEvent.instructions}
        </div>
      )}
      {cpEvent && cpEvent.message && (
        <div className={cn('tm:text-[12px] tm:text-light-grey')}>
          {cpEvent.message}
        </div>
      )}

      {kbEvent && kbEvent.prompts.map((prompt, index) => (
        <div key={index} className={cn('tm:space-y-1')}>
          <label className={cn('tm:text-[12px] tm:text-grey-fg2')}>
            {prompt.prompt}
          </label>
          <Input
            type={prompt.echo ? 'text' : 'password'}
            value={responses[index] ?? ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit();
              }
            }}
            autoFocus={index === 0}
          />
        </div>
      ))}

      {cpEvent && (
        <div className={cn('tm:space-y-1')}>
          <Input
            type="password"
            value={newPassword}
            placeholder={localeService.t('port-forwarding-ui.auth.changePassword.placeholder')}
            onChange={(e) => setNewPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit();
              }
            }}
            autoFocus
          />
        </div>
      )}

      {connectionFailed && (
        <div className={cn('tm:rounded-xl tm:border tm:border-red/40 tm:bg-red/10 tm:p-3 tm:text-[12px] tm:text-red')}>
          {connectionError || localeService.t('port-forwarding-ui.auth.connectionFailed')}
        </div>
      )}

      <div className={cn('tm:flex tm:items-center tm:gap-2')}>
        {!connectionFailed && (
          <Button variant="primary" size="sm" onClick={handleSubmit}>
            {localeService.t('port-forwarding-ui.auth.keyboardInteractive.submit')}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className={cn(`
            tm:border-one-bg tm:text-light-grey tm:shadow-none
            tm:hover:border-blue tm:hover:text-blue
          `)}
          onClick={handleCancel}
        >
          {localeService.t('port-forwarding-ui.auth.keyboardInteractive.cancel')}
        </Button>
      </div>
    </div>
  );
}
