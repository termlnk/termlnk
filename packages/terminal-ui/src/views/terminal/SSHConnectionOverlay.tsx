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
import type { IHopState } from './use-ssh-connection';
import { LocaleService } from '@termlnk/core';
import { Button, Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle, cn, InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, Switch, useDependency } from '@termlnk/design';
import { Check, Eye, EyeOff, FingerprintPattern, KeyRound, Loader2, Network, PlugZap, ShieldAlert, Terminal } from 'lucide-react';
import { Fragment, useCallback, useMemo, useState } from 'react';

type OverlayMode = 'progress' | 'password' | 'fingerprint' | 'error';

export interface ISSHConnectionOverlayProps {
  hostName: string;
  hostAddress?: string;
  mode: OverlayMode;
  sessionStatus: TerminalSessionStatus;
  statusText?: string;
  /** Hop label to surface in the password prompt when authenticating against a chain hop. */
  viaHopLabel?: string;
  /**
   * Per-hop progress accumulated by use-ssh-connection. When non-empty, a
   * "chain" step is inserted into the progress bar and the derived hop
   * status text supersedes `statusText`.
   */
  hopStates: IHopState[];
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

interface IStepDef {
  id: 'connect' | 'chain' | 'verify' | 'shell';
  icon: typeof PlugZap;
}

const baseSteps: ReadonlyArray<IStepDef> = [
  { id: 'connect', icon: PlugZap },
  { id: 'verify', icon: FingerprintPattern },
  { id: 'shell', icon: Terminal },
];

const chainStep: IStepDef = { id: 'chain', icon: Network };

const outlineBtnClass = `
  tm:border-one-bg tm:text-light-grey tm:shadow-none
  tm:hover:border-blue tm:hover:text-blue
`;

interface IStepProgress {
  steps: ReadonlyArray<IStepDef>;
  /** Index of the active step. -1 = not started; steps.length = all done. */
  activeStep: number;
  hasError: boolean;
  errorStep: number;
}

/**
 * Derive the visible step sequence and active index. The "chain" step is
 * inserted only when hopStates is non-empty.
 *
 * Error attribution:
 * - any failed hop  → chain
 * - auth_failed     → verify
 * - otherwise       → active step
 */
function deriveStepProgress(
  sessionStatus: TerminalSessionStatus,
  hopStates: IHopState[]
): IStepProgress {
  const hasChain = hopStates.length > 0;
  const steps: ReadonlyArray<IStepDef> = hasChain
    ? [baseSteps[0], chainStep, baseSteps[1], baseSteps[2]]
    : baseSteps;

  const failedHop = hopStates.find((h) => h.status === 'failed');
  const allHopsReady = hasChain && hopStates.length === (hopStates[0]?.hopCount ?? 0)
    && hopStates.every((h) => h.status === 'ready');
  const firstHop = hopStates[0];

  // Steps: hasChain ? [connect, chain, verify, shell] : [connect, verify, shell]
  let activeStep = 0;
  if (hasChain) {
    if (allHopsReady) {
      activeStep = sessionStatus === 'opening_shell' || sessionStatus === 'ready' ? 3 : 2;
    } else if (firstHop && firstHop.status !== 'connecting') {
      activeStep = 1;
    }
  } else if (sessionStatus === 'authenticating') {
    activeStep = 1;
  } else if (sessionStatus === 'opening_shell' || sessionStatus === 'ready') {
    activeStep = 2;
  }

  const hasError = sessionStatus === 'error'
    || sessionStatus === 'auth_failed'
    || sessionStatus === 'closed'
    || !!failedHop;
  let errorStep = activeStep;
  if (failedHop) {
    errorStep = 1;
  } else if (sessionStatus === 'auth_failed') {
    errorStep = hasChain ? 2 : 1;
  }

  return { steps, activeStep, hasError, errorStep };
}

function getStepStateClass(hasError: boolean, isErrorStep: boolean, isActive: boolean, isDone: boolean): string {
  if (hasError && isErrorStep) {
    return 'tm:border-red tm:bg-red/15 tm:text-red';
  }
  if (isDone || isActive) {
    return 'tm:border-blue tm:bg-blue/20 tm:text-blue';
  }
  return 'tm:border-one-bg3 tm:bg-one-bg2 tm:text-grey-fg';
}

function getStepIcon(Icon: typeof PlugZap, hasError: boolean, isErrorStep: boolean, isActive: boolean, isDone: boolean) {
  if (hasError && isErrorStep) {
    return <ShieldAlert size={14} strokeWidth={1.7} />;
  }
  if (isActive && !hasError) {
    return <Loader2 size={14} strokeWidth={1.7} className="tm:animate-spin" />;
  }
  if (isDone) {
    return <Check size={14} strokeWidth={1.7} />;
  }
  return <Icon size={14} strokeWidth={1.7} />;
}

export function SSHConnectionOverlay(props: ISSHConnectionOverlayProps) {
  const {
    hostName,
    hostAddress,
    mode,
    sessionStatus,
    statusText,
    viaHopLabel,
    hopStates,
    onClose,
    onRetry,
    onPasswordSubmit,
    fingerprint,
    onFingerprintReplace,
    onFingerprintAdd,
    onFingerprintCancel,
  } = props;

  const localeService = useDependency(LocaleService);
  const { steps, activeStep, hasError, errorStep } = useMemo(
    () => deriveStepProgress(sessionStatus, hopStates),
    [sessionStatus, hopStates]
  );
  const segmentCount = steps.length - 1;

  // Hop-derived status text supersedes props.statusText so the message
  // always reflects the in-flight or failed hop.
  const hopStatusText = useMemo(() => {
    if (hopStates.length === 0) {
      return null;
    }
    const failedHop = hopStates.find((h) => h.status === 'failed');
    if (failedHop) {
      return localeService.t(
        'terminal-ui.connection.hop.failed',
        failedHop.hopLabel,
        failedHop.message ?? ''
      );
    }
    const inFlight = hopStates.find((h) => h.status !== 'ready');
    if (!inFlight) {
      return null;
    }
    const hopNum = String(inFlight.hopIndex + 1);
    const hopTotal = String(inFlight.hopCount);
    if (inFlight.status === 'authenticating') {
      return localeService.t(
        'terminal-ui.connection.hop.authenticating',
        inFlight.hopLabel,
        hopNum,
        hopTotal
      );
    }
    return localeService.t(
      'terminal-ui.connection.hop.connecting',
      inFlight.hopLabel,
      hopNum,
      hopTotal
    );
  }, [hopStates, localeService]);

  const effectiveStatusText = hopStatusText ?? statusText;

  const [passwordValue, setPasswordValue] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [savePassword, setSavePassword] = useState(true);

  const handlePasswordSubmit = useCallback(() => {
    if (!passwordValue) {
      return;
    }
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
        <div
          className={cn('tm:grid tm:items-center tm:gap-2', {
            'tm:grid-cols-[2rem_1fr_2rem_1fr_2rem]': steps.length === 3,
            'tm:grid-cols-[2rem_1fr_2rem_1fr_2rem_1fr_2rem]': steps.length === 4,
          })}
        >
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === activeStep;
            const isDone = index < activeStep;
            const isErrorStep = hasError && index === errorStep;

            return (
              <Fragment key={step.id}>
                <div className="tm:flex tm:w-8 tm:items-center tm:justify-center">
                  <div
                    className={cn(
                      'tm:flex tm:size-8 tm:items-center tm:justify-center tm:rounded-full tm:border',
                      getStepStateClass(hasError, isErrorStep, isActive, isDone)
                    )}
                  >
                    {getStepIcon(Icon, hasError, isErrorStep, isActive, isDone)}
                  </div>
                </div>

                {index < segmentCount && (
                  <div className="tm:relative tm:h-0.5 tm:overflow-hidden tm:rounded-full tm:bg-black2">
                    {(isDone || (hasError && isErrorStep)) && (
                      <div
                        className={cn(
                          'tm:absolute tm:top-0 tm:left-0 tm:h-0.5 tm:w-full tm:rounded-full',
                          {
                            'tm:bg-red': hasError && isErrorStep,
                            'tm:bg-blue': !(hasError && isErrorStep),
                          }
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

        <div
          className={cn('tm:mt-1 tm:grid tm:items-center tm:text-center', {
            'tm:grid-cols-[2rem_1fr_2rem_1fr_2rem]': steps.length === 3,
            'tm:grid-cols-[2rem_1fr_2rem_1fr_2rem_1fr_2rem]': steps.length === 4,
          })}
        >
          {steps.map((step, index) => (
            <Fragment key={`${step.id}-label`}>
              <span className="tm:text-[12px] tm:text-light-grey">
                {localeService.t(`terminal-ui.connection.step.${step.id}`)}
              </span>
              {index < segmentCount && <span />}
            </Fragment>
          ))}
        </div>

        {effectiveStatusText && mode !== 'progress' && mode !== 'error' && (
          <div
            className={cn(
              'tm:mt-3 tm:text-[12px] tm:leading-[1.4]',
              {
                'tm:text-red': hasError,
                'tm:text-white': !hasError,
              }
            )}
          >
            {effectiveStatusText}
          </div>
        )}

        {mode === 'password' && (
          <div className="tm:mt-4 tm:space-y-3">
            <div className="tm:text-[14px] tm:font-medium tm:text-light-grey">
              {localeService.t('terminal-ui.connection.password.title')}
              {viaHopLabel && (
                <span className="tm:ml-2 tm:text-[12px] tm:font-normal tm:text-blue">
                  {localeService.t('terminal-ui.connection.password.viaHop', viaHopLabel)}
                </span>
              )}
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
                {
                  'tm:text-red': hasError,
                  'tm:text-light-grey': !hasError,
                }
              )}
            >
              <span
                className={cn(
                  'tm:inline-flex tm:size-2 tm:rounded-full',
                  {
                    'tm:bg-red': hasError,
                    'tm:animate-pulse tm:bg-blue': !hasError,
                  }
                )}
              />
              {effectiveStatusText || (
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
