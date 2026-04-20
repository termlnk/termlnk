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

import type { TerminalSessionStatus } from '../../services/terminal/terminal-ui.service';
import { LocaleService } from '@termlnk/core';
import { Button, Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle, cn, InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, Switch, useDependency } from '@termlnk/design';
import { Check, Eye, EyeOff, FingerprintPattern, KeyRound, Loader2, PlugZap, ShieldAlert, Terminal } from 'lucide-react';
import { Fragment, useCallback, useState } from 'react';

type OverlayMode = 'progress' | 'password' | 'fingerprint' | 'error';

export interface ISSHConnectionOverlayProps {
  hostName: string;
  hostAddress?: string;
  mode: OverlayMode;
  sessionStatus: TerminalSessionStatus;
  statusText?: string;
  onClose: () => void;
  onRetry?: () => void;
  onPasswordSubmit?: (password: string, savePassword: boolean) => void;
  fingerprint?: {
    title?: string;
    subtitle?: string;
    label?: string;
    value?: string;
  };
  onFingerprintReplace?: () => void;
  onFingerprintAdd?: () => void;
  onFingerprintCancel?: () => void;
}

const steps = [
  { id: 'connect', icon: PlugZap },
  { id: 'verify', icon: FingerprintPattern },
  { id: 'shell', icon: Terminal },
];

const outlineBtnClass = `
  tm:border-one-bg tm:text-light-grey tm:shadow-none
  tm:hover:border-blue tm:hover:text-blue
`;

function getActiveStep(sessionStatus?: TerminalSessionStatus): number {
  switch (sessionStatus) {
    case 'opening_shell':
    case 'ready':
      return 2;
    case 'authenticating':
      return 1;
    default:
      return 0;
  }
}

function getStepStateClass(hasError: boolean, isActive: boolean, isDone: boolean): string {
  if (hasError && isActive) {
    return 'tm:border-red tm:bg-red/15 tm:text-red';
  }
  if (isDone || isActive) {
    return 'tm:border-blue tm:bg-blue/20 tm:text-blue';
  }
  return 'tm:border-one-bg3 tm:bg-one-bg2 tm:text-grey-fg';
}

function getStepIcon(Icon: typeof PlugZap, hasError: boolean, isActive: boolean, isDone: boolean) {
  if (hasError && isActive) return <ShieldAlert size={14} strokeWidth={1.7} />;
  if (isActive) return <Loader2 size={14} strokeWidth={1.7} className="tm:animate-spin" />;
  if (isDone) return <Check size={14} strokeWidth={1.7} />;
  return <Icon size={14} strokeWidth={1.7} />;
}

export function SSHConnectionOverlay(props: ISSHConnectionOverlayProps) {
  const {
    hostName,
    hostAddress,
    mode,
    sessionStatus,
    statusText,
    onClose,
    onRetry,
    onPasswordSubmit,
    fingerprint,
    onFingerprintReplace,
    onFingerprintAdd,
    onFingerprintCancel,
  } = props;

  const localeService = useDependency(LocaleService);
  const activeStep = getActiveStep(sessionStatus);
  const hasError = mode === 'error' || sessionStatus === 'error';
  const segmentCount = steps.length - 1;

  const [passwordValue, setPasswordValue] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [savePassword, setSavePassword] = useState(true);

  const handlePasswordSubmit = useCallback(() => {
    if (!passwordValue) return;
    onPasswordSubmit?.(passwordValue, savePassword);
    setPasswordValue('');
  }, [passwordValue, savePassword, onPasswordSubmit]);

  return (
    <Card className="tm:w-full tm:max-w-180">
      <CardHeader className="tm:border-b tm:border-b-line tm:pb-2">
        <CardTitle>{hostName}</CardTitle>
        <CardDescription className="tm:text-[12px]">
          SSH
          {' '}
          {hostAddress || '--'}
        </CardDescription>
        <CardAction>
          <Button
            variant="default"
            size="sm"
            className={outlineBtnClass}
            onClick={onClose}
          >
            {localeService.t('terminal-ui.connection.action.close')}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="tm:mt-4">
        <div className="tm:grid tm:grid-cols-[2rem_1fr_2rem_1fr_2rem] tm:items-center tm:gap-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === activeStep;
            const isDone = index < activeStep;

            return (
              <Fragment key={step.id}>
                <div className="tm:flex tm:w-8 tm:items-center tm:justify-center">
                  <div
                    className={cn(
                      'tm:flex tm:size-8 tm:items-center tm:justify-center tm:rounded-full tm:border',
                      getStepStateClass(hasError, isActive, isDone)
                    )}
                  >
                    {getStepIcon(Icon, hasError, isActive, isDone)}
                  </div>
                </div>

                {index < segmentCount && (
                  <div className="tm:relative tm:h-0.5 tm:overflow-hidden tm:rounded-full tm:bg-black2">
                    {(isDone || (hasError && isActive)) && (
                      <div
                        className={cn(
                          'tm:absolute tm:top-0 tm:left-0 tm:h-0.5 tm:w-full tm:rounded-full',
                          hasError && isActive ? 'tm:bg-red' : 'tm:bg-blue'
                        )}
                      />
                    )}
                    {!hasError && isActive && mode === 'progress' && (
                      <div
                        className={`
                          tm:absolute tm:top-0 tm:left-0 tm:h-0.5 tm:w-[35%]
                          tm:animate-[tm-ssh-progress_1.6s_linear_infinite] tm:rounded-full tm:bg-blue/40
                        `}
                      />
                    )}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>

        <div className="tm:mt-1 tm:grid tm:grid-cols-[2rem_1fr_2rem_1fr_2rem] tm:items-center tm:text-center">
          {steps.map((step, index) => (
            <Fragment key={`${step.id}-label`}>
              <span className="tm:text-[12px] tm:text-light-grey">
                {localeService.t(`terminal-ui.connection.step.${step.id}`)}
              </span>
              {index < segmentCount && <span />}
            </Fragment>
          ))}
        </div>

        {statusText && mode !== 'progress' && mode !== 'error' && (
          <div
            className={cn(
              'tm:mt-3 tm:text-[12px] tm:leading-[1.4]',
              hasError ? 'tm:text-red' : 'tm:text-white'
            )}
          >
            {statusText}
          </div>
        )}

        {mode === 'password' && (
          <div className="tm:mt-4 tm:space-y-3">
            <div className="tm:text-[14px] tm:font-medium tm:text-light-grey">
              {localeService.t('terminal-ui.connection.password.title')}
            </div>
            <InputGroup className="tm:h-10 tm:rounded-lg tm:border-line tm:bg-one-bg3">
              <InputGroupAddon>
                <KeyRound size={16} strokeWidth={1.6} />
              </InputGroupAddon>
              <InputGroupInput
                type={passwordVisible ? 'text' : 'password'}
                value={passwordValue}
                placeholder={localeService.t('terminal-ui.connection.password.placeholder')}
                onChange={(e) => setPasswordValue(e.target.value)}
              />
              <InputGroupButton
                size="icon-sm"
                variant="ghost"
                onClick={() => setPasswordVisible((v) => !v)}
              >
                {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </InputGroupButton>
            </InputGroup>
            <div className="tm:flex tm:items-center tm:justify-between">
              <label className="tm:flex tm:items-center tm:gap-2 tm:text-[12px] tm:text-grey-fg2">
                <Switch
                  checked={savePassword}
                  onCheckedChange={setSavePassword}
                />
                {localeService.t('terminal-ui.connection.password.remember')}
              </label>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePasswordSubmit}
                disabled={!passwordValue}
              >
                {localeService.t('terminal-ui.connection.action.continue')}
              </Button>
            </div>
          </div>
        )}

        {mode === 'fingerprint' && (
          <div className="tm:mt-4 tm:space-y-3">
            <div className="tm:rounded-xl tm:border tm:border-red/40 tm:bg-red/10 tm:p-4">
              <div className="tm:text-[14px] tm:font-semibold tm:text-red">
                {fingerprint?.title}
              </div>
              <div className="tm:mt-1 tm:text-[12px] tm:text-light-grey">
                {fingerprint?.subtitle}
              </div>
              {fingerprint?.value && (
                <div className="tm:mt-3 tm:text-[12px] tm:text-light-grey">
                  {fingerprint?.label}
                  {' '}
                  {fingerprint.value}
                </div>
              )}
            </div>
            <div className="tm:flex tm:flex-wrap tm:items-center tm:gap-2">
              <Button variant="primary" size="sm" onClick={onFingerprintReplace}>
                {localeService.t('terminal-ui.connection.action.replace')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={outlineBtnClass}
                onClick={onFingerprintAdd}
              >
                {localeService.t('terminal-ui.connection.action.addNew')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={outlineBtnClass}
                onClick={onFingerprintCancel}
              >
                {localeService.t('terminal-ui.connection.action.cancel')}
              </Button>
            </div>
          </div>
        )}

        {(mode === 'progress' || mode === 'error') && (
          <div
            className="
              tm:mt-4 tm:flex tm:items-center tm:justify-between tm:gap-3 tm:border-t tm:border-line/70 tm:pt-4
            "
          >
            <div
              className={cn(
                'tm:flex tm:items-center tm:gap-2 tm:text-[12px]',
                hasError ? 'tm:text-red' : 'tm:text-light-grey'
              )}
            >
              <span
                className={cn(
                  'tm:inline-flex tm:size-2 tm:rounded-full',
                  hasError ? 'tm:bg-red' : 'tm:animate-pulse tm:bg-blue'
                )}
              />
              {statusText || (
                hasError
                  ? localeService.t('terminal-ui.connection.status.error')
                  : localeService.t('terminal-ui.connection.status.connecting')
              )}
            </div>
            {mode === 'error' && onRetry && (
              <Button
                variant="outline"
                size="sm"
                className={outlineBtnClass}
                onClick={onRetry}
              >
                {localeService.t('terminal-ui.connection.action.retry')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
