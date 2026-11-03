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

import type { IACPSessionInfo } from '@termlnk/acp';
import type { ITerminalViewProps } from '@termlnk/terminal-ui';
import { IACPSessionService } from '@termlnk/acp';
import { ChatMessages, ConversationContext } from '@termlnk/agent-ui';
import { LocaleService } from '@termlnk/core';
import { cn, useDependency, useObservable } from '@termlnk/design';
import { useCallback, useEffect, useMemo } from 'react';
import { map } from 'rxjs/operators';
import { createACPConversationSource } from '../../services/acp-conversation-source';
import { IACPSessionLauncher } from '../../services/acp-session-launcher.service';
import { ACPInput } from './ACPInput';
import { ACPPermissionBar } from './ACPPermissionBar';
import { ACPSessionHeader } from './ACPSessionHeader';

export function ACPSessionView({ sessionId }: ITerminalViewProps) {
  const sessionService = useDependency(IACPSessionService);
  const launcher = useDependency(IACPSessionLauncher);
  const localeService = useDependency(LocaleService);

  // Built synchronously so the first paint already has a live source: a state +
  // effect version renders one frame with no conversation and forces every
  // consumer to guard against null.
  const source = useMemo(
    () => createACPConversationSource(sessionId, sessionService),
    [sessionId, sessionService]
  );
  useEffect(() => () => source.dispose(), [source]);

  const session$ = useMemo(
    () => sessionService.sessions$.pipe(
      map((list) => list.find((s) => s.id === sessionId) ?? null)
    ),
    [sessionService, sessionId]
  );
  const session = useObservable(session$, null as IACPSessionInfo | null);
  const isStreaming = useObservable(source.isStreaming$, false);
  const permission = useObservable(source.permissionRequest$, null);

  const failure$ = useMemo(
    () => launcher.launchFailures$.pipe(map((failures) => failures.get(sessionId) ?? null)),
    [launcher, sessionId]
  );
  const failure = useObservable(failure$, null as string | null);

  const handleSubmit = useCallback(async (text: string) => {
    await sessionService.prompt(sessionId, [{ type: 'text', text }]);
  }, [sessionService, sessionId]);

  const handleCancel = useCallback(() => {
    void sessionService.cancel(sessionId);
  }, [sessionService, sessionId]);

  const handlePermission = useCallback(async (requestId: string, optionId: string) => {
    await source.respondPermission(requestId, optionId);
  }, [source]);

  const handleRetry = useCallback(() => {
    void launcher.retry(sessionId);
  }, [launcher, sessionId]);

  // The main process discards a session whose handshake failed, so there is no
  // session to render a conversation for — show why instead of a blank pane.
  if (failure && !session) {
    return (
      <LaunchFailure
        message={failure}
        retryLabel={localeService.t('acp-ui.launch.retry')}
        title={localeService.t('acp-ui.launch.failed-body-title')}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <ConversationContext.Provider value={source}>
      <div className="tm:flex tm:h-full tm:min-w-0 tm:flex-col tm:overflow-hidden tm:bg-black">
        <ACPSessionHeader
          session={session}
          isStreaming={isStreaming}
          onCancel={handleCancel}
        />
        <ChatMessages />
        <ACPPermissionBar request={permission} onRespond={handlePermission} />
        <ACPInput disabled={session?.status === 'error' || session?.status === 'closed'} onSubmit={handleSubmit} />
      </div>
    </ConversationContext.Provider>
  );
}

function LaunchFailure({
  title,
  message,
  retryLabel,
  onRetry,
}: {
  title: string;
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div
      className={cn('tm:flex tm:h-full tm:flex-col tm:items-center tm:justify-center tm:gap-3 tm:bg-black tm:px-6')}
    >
      <span className="tm:text-xs tm:font-medium tm:text-red">{title}</span>
      <pre
        className={cn(`
          tm:max-h-48 tm:max-w-full tm:overflow-auto tm:rounded-md tm:border tm:border-line tm:bg-one-bg tm:px-3 tm:py-2
          tm:text-left tm:font-mono tm:text-[11px] tm:whitespace-pre-wrap tm:text-grey-fg tm:select-text
        `)}
      >
        {message}
      </pre>
      <button
        type="button"
        onClick={onRetry}
        className={cn(`
          tm:rounded-md tm:bg-one-bg2 tm:px-3 tm:py-1 tm:text-xs tm:text-light-grey tm:transition-colors
          tm:hover:bg-one-bg3
        `)}
      >
        {retryLabel}
      </button>
    </div>
  );
}
