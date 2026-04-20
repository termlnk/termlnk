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

import type { IMcpServer, McpConnectionStatus, McpTransportType } from '@termlnk/agent';
import { IMcpService } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Badge, Button, cn, Spinner, Switch, useDependency } from '@termlnk/design';
import { Pencil, Plus, RefreshCw, Trash2, Unplug, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';

const STATUS_TEXT_COLORS: Record<McpConnectionStatus, string> = {
  disconnected: 'tm:text-grey-fg',
  connecting: 'tm:text-yellow',
  connected: 'tm:text-green',
  error: 'tm:text-red',
};

const TRANSPORT_LABELS: Record<McpTransportType, string> = {
  stdio: 'Stdio',
  http: 'HTTP',
};

interface IMcpInstalledProps {
  servers: IMcpServer[];
  onServersChanged: () => void;
  onAddServerClick: () => void;
  onEditServer: (server: IMcpServer) => void;
}

type PendingServerAction = 'connect' | 'disconnect' | 'reconnect' | 'remove' | 'toggle';

export function McpInstalled({ servers, onServersChanged, onAddServerClick, onEditServer }: IMcpInstalledProps) {
  const localeService = useDependency(LocaleService);
  const mcpClientService = useDependency(IMcpService);
  const [pendingActions, setPendingActions] = useState<Record<string, PendingServerAction | undefined>>({});

  const runServerAction = useCallback(async (id: string, action: PendingServerAction, task: () => Promise<void>) => {
    setPendingActions((prev) => ({ ...prev, [id]: action }));

    try {
      await task();
    } finally {
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, []);

  const handleRemoveServer = useCallback(async (id: string) => {
    await runServerAction(id, 'remove', async () => {
      await mcpClientService.remove(id);
      onServersChanged();
    });
  }, [mcpClientService, onServersChanged, runServerAction]);

  const handleToggleEnabled = useCallback(async (id: string, enabled: boolean) => {
    await runServerAction(id, 'toggle', async () => {
      await mcpClientService.enabled(id, enabled);
      onServersChanged();
    });
  }, [mcpClientService, onServersChanged, runServerAction]);

  const handleConnect = useCallback(async (id: string) => {
    await runServerAction(id, 'connect', async () => {
      await mcpClientService.connect(id);
      onServersChanged();
    });
  }, [mcpClientService, onServersChanged, runServerAction]);

  const handleDisconnect = useCallback(async (id: string) => {
    await runServerAction(id, 'disconnect', async () => {
      await mcpClientService.disconnect(id);
      onServersChanged();
    });
  }, [mcpClientService, onServersChanged, runServerAction]);

  const handleReconnect = useCallback(async (id: string) => {
    await runServerAction(id, 'reconnect', async () => {
      await mcpClientService.reconnect(id);
      onServersChanged();
    });
  }, [mcpClientService, onServersChanged, runServerAction]);

  return (
    <div className="tm:flex tm:flex-col tm:gap-5">
      {servers.length === 0 && (
        <section
          className={cn(`
            tm:rounded-2xl tm:border tm:border-line tm:bg-one-bg/65 tm:p-5 tm:transition-all
            tm:hover:border-blue/30 tm:hover:bg-one-bg/80
          `)}
        >
          <div className="tm:flex tm:flex-col tm:items-center tm:gap-3 tm:text-center">
            <p className="tm:text-sm tm:text-grey-fg">
              {localeService.t('settings-ui.mcp-client.installed-empty')}
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={onAddServerClick}>
              <Plus className="tm:size-3.5" />
              {localeService.t('settings-ui.mcp-client.add-server')}
            </Button>
          </div>
        </section>
      )}

      {servers.map((server) => {
        const pendingAction = pendingActions[server.id];
        const isBusy = !!pendingAction;

        return (
          <section
            key={server.id}
            className={cn(`
              tm:rounded-2xl tm:border tm:border-line tm:bg-one-bg/65 tm:p-5 tm:transition-all
              tm:hover:border-blue/30 tm:hover:bg-one-bg/80
            `)}
          >
            <div className="tm:flex tm:items-start tm:justify-between">
              <div className="tm:min-w-0 tm:flex-1">
                <div className="tm:flex tm:flex-wrap tm:items-center tm:gap-1">
                  <span className="tm:text-sm tm:font-semibold tm:text-white">
                    {server.name}
                  </span>
                  <Badge variant="secondary" className={cn('tm:border-transparent tm:text-[10px]', STATUS_TEXT_COLORS[server.status])}>
                    {localeService.t(`settings-ui.mcp-client.status-${server.status}`)}
                  </Badge>
                  <Badge variant="secondary" className="tm:text-[10px]">
                    {localeService.t(`settings-ui.mcp-client.transport-${server.transport}`) || TRANSPORT_LABELS[server.transport] || server.transport}
                  </Badge>
                </div>

                {server.description && (
                  <p className="tm:mt-0.5 tm:text-[11px] tm:text-light-grey">
                    {server.description}
                  </p>
                )}

                <div className="tm:mt-2 tm:flex tm:flex-wrap tm:items-center tm:gap-2 tm:text-[11px] tm:text-white">
                  <Badge variant="secondary" className="tm:text-[10px]">
                    {localeService.t('settings-ui.mcp-client.tools-count', String(server.toolCount))}
                  </Badge>
                  <Badge variant="secondary" className="tm:text-[10px]">
                    {localeService.t('settings-ui.mcp-client.resources-count', String(server.resourceCount))}
                  </Badge>
                  {server.lastError && (
                    <span className="tm:max-w-50 tm:truncate tm:text-red" title={server.lastError}>
                      {server.lastError}
                    </span>
                  )}
                </div>
              </div>

              <div className="tm:flex tm:items-center tm:gap-1">
                {server.status === 'connected'
                  ? (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDisconnect(server.id)}
                      title={localeService.t('settings-ui.mcp-client.disconnect')}
                      disabled={isBusy}
                    >
                      {pendingAction === 'disconnect'
                        ? <Spinner className="tm:size-3" />
                        : <Unplug className="tm:size-3" />}
                    </Button>
                  )
                  : (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleConnect(server.id)}
                      title={localeService.t('settings-ui.mcp-client.connect')}
                      disabled={isBusy}
                    >
                      {pendingAction === 'connect'
                        ? <Spinner className="tm:size-3" />
                        : <Zap className="tm:size-3" />}
                    </Button>
                  )}

                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleReconnect(server.id)}
                  title={localeService.t('settings-ui.mcp-client.reconnect')}
                  disabled={isBusy}
                >
                  {pendingAction === 'reconnect'
                    ? <Spinner className="tm:size-3" />
                    : <RefreshCw className="tm:size-3" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onEditServer(server)}
                  title={localeService.t('settings-ui.mcp-client.edit')}
                  disabled={isBusy}
                >
                  <Pencil className="tm:size-3" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemoveServer(server.id)}
                  title={localeService.t('settings-ui.mcp-client.remove')}
                  className="tm:hover:bg-red/10 tm:hover:text-red"
                  disabled={isBusy}
                >
                  {pendingAction === 'remove'
                    ? <Spinner className="tm:size-3" />
                    : <Trash2 className="tm:size-3" />}
                </Button>

                <Switch
                  checked={server.enabled}
                  onCheckedChange={(checked) => handleToggleEnabled(server.id, checked)}
                  disabled={isBusy}
                />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
