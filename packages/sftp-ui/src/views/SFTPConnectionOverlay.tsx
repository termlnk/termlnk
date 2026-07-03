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

import type { SFTPPageConnectionState } from './hooks/use-sftp-page-connection';
import { Button, cn, InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@termlnk/design';
import { Eye, EyeOff, FolderOpen, KeyRound, Loader2, PlugZap, ShieldAlert } from 'lucide-react';
import { useCallback, useState } from 'react';

interface ISFTPConnectionOverlayProps {
  hostName: string;
  hostAddress?: string;
  state: SFTPPageConnectionState;
  onClose: () => void;
  onRetry?: (password: string) => void;
  onPasswordSubmit?: (password: string) => void;
}

const steps = [
  { id: 'connect', icon: PlugZap },
  { id: 'auth', icon: KeyRound },
  { id: 'sftp', icon: FolderOpen },
];

export function SFTPConnectionOverlay(props: ISFTPConnectionOverlayProps) {
  const { hostName, hostAddress, state, onClose, onRetry, onPasswordSubmit } = props;

  const [passwordValue, setPasswordValue] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  const activeStep = getActiveStep(state);
  const hasError = state.phase === 'error';

  const handlePasswordSubmit = useCallback(() => {
    if (!passwordValue) {
      return;
    }
    onPasswordSubmit?.(passwordValue);
    setPasswordValue('');
  }, [passwordValue, onPasswordSubmit]);

  const handleRetry = useCallback(() => {
    if (!passwordValue) {
      return;
    }
    onRetry?.(passwordValue);
    setPasswordValue('');
  }, [passwordValue, onRetry]);

  return (
    <div className="tm:flex tm:h-full tm:items-center tm:justify-center tm:bg-black">
      <div className="tm:w-full tm:max-w-[520px] tm:rounded-2xl tm:border tm:border-line tm:bg-one-bg tm:p-5">
        {/* Header */}
        <div className="tm:flex tm:items-start tm:justify-between tm:gap-3">
          <div className="tm:flex tm:items-start tm:gap-3">
            <div
              className="tm:flex tm:size-10 tm:items-center tm:justify-center tm:rounded-xl tm:bg-one-bg3 tm:text-blue"
            >
              <FolderOpen size={20} strokeWidth={1.6} />
            </div>
            <div className="tm:flex tm:flex-col tm:justify-center tm:leading-[1.2]">
              <div className="tm:text-[15px] tm:font-semibold tm:text-light-grey">{hostName}</div>
              <div className="tm:text-[12px] tm:text-grey-fg2">
                SFTP
                {' '}
                {hostAddress || '--'}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>

        <div className="tm:mt-4 tm:h-px tm:bg-line/70" />

        {/* Steps */}
        <div className="tm:mt-4">
          <div className="tm:grid tm:grid-cols-[2rem_1fr_2rem_1fr_2rem] tm:items-center tm:gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === activeStep;
              const isDone = index < activeStep;

              return (
                <div key={step.id} className={index < steps.length - 1 ? 'tm:contents' : ''}>
                  <div className="tm:flex tm:w-8 tm:items-center tm:justify-center">
                    <div
                      className={cn(
                        'tm:flex tm:size-8 tm:items-center tm:justify-center tm:rounded-full tm:border',
                        getStepClassName(hasError, isActive, isDone)
                      )}
                    >
                      {getStepIcon(hasError, isActive, Icon)}
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="tm:relative tm:h-0.5 tm:rounded-full tm:bg-black2">
                      {isDone && <div className="tm:absolute tm:inset-0 tm:rounded-full tm:bg-blue" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Password prompt / Error with retry */}
        {(state.phase === 'password' || state.phase === 'error') && (
          <div className="tm:mt-4 tm:space-y-3">
            {state.phase === 'password' && (
              <div className="tm:text-[14px] tm:font-medium tm:text-light-grey">Password Required</div>
            )}
            {state.phase === 'error' && (
              <div className="tm:text-[12px] tm:text-red">{state.message}</div>
            )}
            <InputGroup className="tm:h-10 tm:rounded-lg tm:border-line tm:bg-one-bg3">
              <InputGroupAddon>
                <KeyRound size={16} strokeWidth={1.6} />
              </InputGroupAddon>
              <InputGroupInput
                type={passwordVisible ? 'text' : 'password'}
                value={passwordValue}
                placeholder={hasError ? 'Enter password to retry' : 'Enter password'}
                onChange={(e) => setPasswordValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    hasError ? handleRetry() : handlePasswordSubmit();
                  }
                }}
              />
              <InputGroupButton
                size="icon-sm"
                variant="ghost"
                onClick={() => setPasswordVisible((v) => !v)}
              >
                {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </InputGroupButton>
            </InputGroup>
            <div className="tm:flex tm:justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={hasError ? handleRetry : handlePasswordSubmit}
                disabled={!passwordValue}
              >
                {hasError ? 'Retry' : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* Connecting status */}
        {state.phase === 'connecting' && (
          <div className="tm:mt-4 tm:flex tm:items-center tm:gap-2 tm:text-[12px] tm:text-light-grey">
            <span className="tm:inline-flex tm:size-2 tm:animate-pulse tm:rounded-full tm:bg-blue" />
            Connecting...
          </div>
        )}
      </div>
    </div>
  );
}

function getActiveStep(state: SFTPPageConnectionState): number {
  if (state.phase === 'ready') {
    return 3;
  }
  if (state.phase === 'connecting') {
    const status = state.status;
    if (status === 'opening_sftp') {
      return 2;
    }
    if (status === 'authenticating') {
      return 1;
    }
    return 0;
  }
  if (state.phase === 'password') {
    return 1;
  }
  if (state.phase === 'error') {
    return 0;
  }
  return 0;
}

function getStepClassName(hasError: boolean, isActive: boolean, isDone: boolean): string {
  if (hasError && isActive) {
    return 'tm:border-red tm:bg-red/20 tm:text-red';
  }
  if (isDone || isActive) {
    return 'tm:border-blue tm:bg-blue/20 tm:text-blue';
  }
  return 'tm:border-one-bg3 tm:bg-one-bg2 tm:text-grey-fg';
}

function getStepIcon(hasError: boolean, isActive: boolean, Icon: React.ComponentType<{ size: number; className?: string }>) {
  if (hasError && isActive) {
    return <ShieldAlert size={14} />;
  }
  if (isActive) {
    return <Loader2 size={14} className="tm:animate-spin" />;
  }
  return <Icon size={14} />;
}
