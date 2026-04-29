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

import type { AgentToolCategory, IMcpRemoteTool, IMcpServer, McpConnectionStatus } from '@termlnk/agent';
import type { ReactNode } from 'react';
import { IMcpService } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Button, Checkbox, cn, Collapsible, CollapsibleContent, CollapsibleTrigger, HoverCard, HoverCardContent, HoverCardTrigger, HoverPanel, HoverPanelBody, HoverPanelContent, HoverPanelFooter, HoverPanelHeader, HoverPanelTrigger, Switch, useDependency } from '@termlnk/design';
import { IChatSessionClientService } from '@termlnk/rpc-client';
import { Check, ChevronDown, ChevronRight, FolderOpen, Globe, Loader2, Plug2, RefreshCw, Server, TerminalSquare, Wrench } from 'lucide-react';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface IChatSelectableTool {
  id: string;
  name: string;
  label?: string;
  description: string;
  serverId: string;
  serverName: string;
  category: AgentToolCategory;
}

const CATEGORY_ORDER: Record<AgentToolCategory, number> = {
  network: 0,
  terminal: 1,
  host: 2,
  file: 3,
  mcp: 4,
  other: 5,
};

const CATEGORY_META: Record<AgentToolCategory, { icon: typeof Globe; labelKey: string }> = {
  network: { icon: Globe, labelKey: 'agent-ui.chat.tools-category-network' },
  terminal: { icon: TerminalSquare, labelKey: 'agent-ui.chat.tools-category-terminal' },
  host: { icon: Server, labelKey: 'agent-ui.chat.tools-category-host' },
  file: { icon: FolderOpen, labelKey: 'agent-ui.chat.tools-category-file' },
  mcp: { icon: Plug2, labelKey: 'agent-ui.chat.tools-category-mcp' },
  other: { icon: Wrench, labelKey: 'agent-ui.chat.tools-category-other' },
};

const SERVER_STATUS_ORDER: Record<McpConnectionStatus, number> = {
  connected: 0,
  connecting: 1,
  error: 2,
  disconnected: 3,
};

const BUILTIN_SERVER_ID = '__builtin__';

function resolveToolLabel(localeService: LocaleService, tool: IChatSelectableTool): string {
  if (tool.serverId === BUILTIN_SERVER_ID) {
    const i18nKey = `agent-ui.chat.builtin-tool.${tool.name}.label`;
    const resolved = localeService.t(i18nKey);
    if (resolved !== i18nKey) {
      return resolved;
    }
  }
  return tool.label ?? tool.name;
}

function resolveToolDescription(localeService: LocaleService, tool: IChatSelectableTool): string {
  if (tool.serverId === BUILTIN_SERVER_ID) {
    const i18nKey = `agent-ui.chat.builtin-tool.${tool.name}.description`;
    const resolved = localeService.t(i18nKey);
    if (resolved !== i18nKey) {
      return resolved;
    }
  }
  return tool.description || tool.serverName;
}

function categorizeTool(tool: IMcpRemoteTool): AgentToolCategory {
  if (tool.category) {
    return tool.category;
  }

  // External MCP tools default to 'mcp'
  if (tool.serverId !== BUILTIN_SERVER_ID) {
    return 'mcp';
  }

  return 'other';
}

function sortTools(tools: IChatSelectableTool[]): IChatSelectableTool[] {
  return [...tools].sort((a, b) => {
    const categoryDelta = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (categoryDelta !== 0) {
      return categoryDelta;
    }

    const serverDelta = a.serverName.localeCompare(b.serverName);
    if (serverDelta !== 0) {
      return serverDelta;
    }

    return a.name.localeCompare(b.name);
  });
}

function sortServers(servers: IMcpServer[]): IMcpServer[] {
  return [...servers].sort((a, b) => {
    const enabledDelta = Number(b.enabled) - Number(a.enabled);
    if (enabledDelta !== 0) {
      return enabledDelta;
    }

    const statusDelta = SERVER_STATUS_ORDER[a.status] - SERVER_STATUS_ORDER[b.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }

    return a.name.localeCompare(b.name);
  });
}

function readSelectedToolIds(session: any): string[] | null {
  if (!session || !Array.isArray(session.selectedToolIds)) {
    return null;
  }

  return session.selectedToolIds.filter((id: unknown): id is string => typeof id === 'string');
}

export function ChatToolSelector() {
  const chatSessionService = useDependency(IChatSessionClientService);
  const mcpService = useDependency(IMcpService);
  const localeService = useDependency(LocaleService);
  const currentSessionIdRef = useRef<string | null>(null);
  const pendingSelectedToolIdsRef = useRef<string[] | null | undefined>(undefined);
  const sessionLoadVersionRef = useRef(0);

  const [tools, setTools] = useState<IChatSelectableTool[]>([]);
  const [servers, setServers] = useState<IMcpServer[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionSelectedToolIds, setSessionSelectedToolIds] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingServerIds, setPendingServerIds] = useState<Record<string, boolean>>({});
  const [isServerSectionOpen, setIsServerSectionOpen] = useState(false);

  const loadTools = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const nextServers = sortServers(await mcpService.servers());

      // Fetch tools from external MCP servers
      const toolGroups = await Promise.all(
        nextServers
          .filter((server) => server.enabled)
          .map(async (server) => mcpService.getTools(server.id))
      );

      // Fetch built-in tools
      const builtinTools = await mcpService.getBuiltinTools();
      const nextTools = sortTools(
        [...builtinTools, ...toolGroups.flat()].map((tool) => ({
          id: tool.id,
          name: tool.name,
          label: tool.label,
          description: tool.description,
          serverId: tool.serverId,
          serverName: tool.serverName,
          category: categorizeTool(tool),
        }))
      );

      startTransition(() => {
        setServers(nextServers);
        setTools(nextTools);
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [mcpService]);

  const loadSessionSelection = useCallback(async (sessionId: string | null) => {
    const loadVersion = sessionLoadVersionRef.current + 1;
    sessionLoadVersionRef.current = loadVersion;

    if (!sessionId) {
      pendingSelectedToolIdsRef.current = undefined;
      startTransition(() => {
        setSessionSelectedToolIds(null);
      });
      return;
    }

    try {
      const session = await chatSessionService.getSession(sessionId);
      if (sessionLoadVersionRef.current !== loadVersion) {
        return;
      }

      const nextSelectedToolIds = readSelectedToolIds(session);
      if (pendingSelectedToolIdsRef.current !== undefined && nextSelectedToolIds === null) {
        return;
      }

      pendingSelectedToolIdsRef.current = undefined;

      startTransition(() => {
        setSessionSelectedToolIds(nextSelectedToolIds);
      });
    } catch {
      if (sessionLoadVersionRef.current !== loadVersion) {
        return;
      }

      if (pendingSelectedToolIdsRef.current !== undefined) {
        return;
      }

      startTransition(() => {
        setSessionSelectedToolIds(null);
      });
    }
  }, [chatSessionService]);

  useEffect(() => {
    let active = true;

    void loadTools();

    const sub = mcpService.onChanged$().subscribe(() => {
      if (!active) {
        return;
      }
      void loadTools();
    });

    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [loadTools, mcpService]);

  useEffect(() => {
    const currentSessionSub = chatSessionService.currentSessionId$.subscribe((sessionId) => {
      currentSessionIdRef.current = sessionId;
      startTransition(() => {
        setCurrentSessionId(sessionId);
      });
      void loadSessionSelection(sessionId);
    });

    const sessionSub = chatSessionService.sessions$.subscribe((event) => {
      if (event.sessionId !== currentSessionIdRef.current) {
        return;
      }

      if (event.type === 'delete') {
        currentSessionIdRef.current = null;
        pendingSelectedToolIdsRef.current = undefined;
        startTransition(() => {
          setCurrentSessionId(null);
          setSessionSelectedToolIds(null);
        });
        return;
      }

      void loadSessionSelection(currentSessionIdRef.current);
    });

    return () => {
      currentSessionSub.unsubscribe();
      sessionSub.unsubscribe();
    };
  }, [chatSessionService, loadSessionSelection]);

  const availableToolIds = useMemo(() => tools.map((tool) => tool.id), [tools]);
  const availableToolIdSet = useMemo(() => new Set(availableToolIds), [availableToolIds]);
  const selectedToolIds = useMemo(() => {
    if (sessionSelectedToolIds === null) {
      return availableToolIds;
    }

    return sessionSelectedToolIds.filter((id) => availableToolIdSet.has(id));
  }, [availableToolIdSet, availableToolIds, sessionSelectedToolIds]);
  const selectedToolIdSet = useMemo(() => new Set(selectedToolIds), [selectedToolIds]);
  const selectedCount = selectedToolIds.length;
  const enabledServerCount = useMemo(() => servers.filter((server) => server.enabled).length, [servers]);
  const groupedTools = useMemo(() => {
    return tools.reduce<Array<{ category: AgentToolCategory; tools: IChatSelectableTool[] }>>((result, tool) => {
      const existing = result.find((item) => item.category === tool.category);
      if (existing) {
        existing.tools.push(tool);
        return result;
      }

      result.push({ category: tool.category, tools: [tool] });
      return result;
    }, []);
  }, [tools]);
  const triggerCountLabel = selectedCount > 99 ? '99+' : String(selectedCount);
  const enabledServerCountLabel = enabledServerCount > 99 ? '99+' : String(enabledServerCount);

  const persistSelectedTools = useCallback(async (nextToolIds: string[] | null) => {
    const previous = sessionSelectedToolIds;

    pendingSelectedToolIdsRef.current = nextToolIds;
    startTransition(() => {
      setSessionSelectedToolIds(nextToolIds);
    });
    setIsSaving(true);

    try {
      let sessionId = currentSessionIdRef.current;
      if (!sessionId) {
        sessionId = await chatSessionService.newSession();
        currentSessionIdRef.current = sessionId;
        startTransition(() => {
          setCurrentSessionId(sessionId);
        });
      }

      await chatSessionService.setSelectedTools(sessionId, nextToolIds);
      pendingSelectedToolIdsRef.current = undefined;
    } catch (error) {
      console.error('[ChatToolSelector] Failed to persist selected tools:', error);
      pendingSelectedToolIdsRef.current = undefined;
      startTransition(() => {
        setSessionSelectedToolIds(previous);
      });
    } finally {
      setIsSaving(false);
    }
  }, [chatSessionService, sessionSelectedToolIds]);

  const handleToolToggle = useCallback((toolId: string, checked: boolean) => {
    const nextSelectedIdSet = new Set(selectedToolIdSet);
    if (checked) {
      nextSelectedIdSet.add(toolId);
    } else {
      nextSelectedIdSet.delete(toolId);
    }

    void persistSelectedTools(availableToolIds.filter((id) => nextSelectedIdSet.has(id)));
  }, [availableToolIds, persistSelectedTools, selectedToolIdSet]);

  const handleSelectAll = useCallback(() => {
    void persistSelectedTools(availableToolIds);
  }, [availableToolIds, persistSelectedTools]);

  const handleSelectNone = useCallback(() => {
    void persistSelectedTools([]);
  }, [persistSelectedTools]);

  const setServersPending = useCallback((serverIds: string[], pending: boolean) => {
    setPendingServerIds((prev) => {
      const next = { ...prev };
      for (const id of serverIds) {
        if (pending) {
          next[id] = true;
        } else {
          delete next[id];
        }
      }
      return next;
    });
  }, []);

  const updateServersEnabledState = useCallback((serverIds: string[], enabled: boolean) => {
    const serverIdSet = new Set(serverIds);

    startTransition(() => {
      setServers((prev) => sortServers(prev.map((server) => (
        serverIdSet.has(server.id)
          ? { ...server, enabled }
          : server
      ))));
    });
  }, []);

  const persistServerEnabledState = useCallback(async (serverIds: string[], enabled: boolean) => {
    if (serverIds.length === 0) {
      return;
    }

    const previousEnabledMap = new Map(
      servers
        .filter((server) => serverIds.includes(server.id))
        .map((server) => [server.id, server.enabled])
    );

    setServersPending(serverIds, true);
    updateServersEnabledState(serverIds, enabled);

    try {
      await Promise.all(serverIds.map(async (id) => mcpService.enabled(id, enabled)));
    } catch (error) {
      console.error('[ChatToolSelector] Failed to update MCP server state:', error);
      startTransition(() => {
        setServers((prev) => sortServers(prev.map((server) => (
          previousEnabledMap.has(server.id)
            ? { ...server, enabled: previousEnabledMap.get(server.id) ?? server.enabled }
            : server
        ))));
      });
    } finally {
      setServersPending(serverIds, false);
    }
  }, [mcpService, servers, setServersPending, updateServersEnabledState]);

  const handleServerToggle = useCallback((serverId: string, enabled: boolean) => {
    void persistServerEnabledState([serverId], enabled);
  }, [persistServerEnabledState]);

  return (
    <HoverPanel>
      <HoverPanelTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="tm:relative tm:flex tm:size-7 tm:text-light-grey tm:transition-colors"
          title={localeService.t('agent-ui.chat.tools')}
          aria-label={localeService.t('agent-ui.chat.tools')}
        >
          <Wrench size={12} />
          {selectedCount > 0 && (
            <span
              className="
                tm:absolute tm:-top-1 tm:-right-1.5 tm:flex tm:h-3 tm:min-w-3 tm:items-center tm:justify-center
                tm:rounded-full tm:bg-blue tm:px-0.5 tm:text-[6px] tm:leading-none tm:font-bold tm:text-[#fff]
              "
            >
              {triggerCountLabel}
            </span>
          )}
        </Button>
      </HoverPanelTrigger>

      <HoverPanelContent
        side="top"
        align="start"
        className="
          tm:min-h-90 tm:w-70 tm:min-w-65 tm:border-line tm:bg-black tm:p-0 tm:shadow-none tm:[box-shadow:none]
        "
      >
        <HoverPanelHeader
          className="
            tm:grid tm:min-h-10 tm:grid-cols-[minmax(0,1fr)_auto] tm:items-center tm:gap-x-1 tm:gap-y-1.5 tm:px-3
            tm:py-1.5 tm:select-none
          "
        >
          <div className="tm:flex tm:min-w-0 tm:items-center tm:gap-1">
            <div
              className="tm:flex tm:size-4 tm:shrink-0 tm:items-center tm:justify-center tm:text-light-grey"
            >
              <Wrench className="tm:size-3" />
            </div>
            <div className="tm:min-w-0">
              <div className="tm:text-[12px] tm:font-semibold tm:text-white">
                {localeService.t('agent-ui.chat.tools')}
              </div>
            </div>
          </div>

          <div className="tm:flex tm:items-center tm:gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              className="
                tm:h-auto tm:px-0 tm:text-[10px] tm:font-normal tm:text-light-grey
                tm:hover:bg-transparent tm:hover:text-white
              "
              onClick={handleSelectAll}
              disabled={tools.length === 0 || selectedCount === tools.length}
            >
              {localeService.t('agent-ui.chat.tools-select-all')}
            </Button>

            <span className="tm:text-[10px] tm:text-line">|</span>

            <Button
              variant="ghost"
              size="xs"
              className="
                tm:h-auto tm:px-0 tm:text-[10px] tm:font-normal tm:text-light-grey
                tm:hover:bg-transparent tm:hover:text-white
              "
              onClick={handleSelectNone}
              disabled={selectedCount === 0}
            >
              {localeService.t('agent-ui.chat.tools-clear-all')}
            </Button>
          </div>

          <div className="tm:col-span-2 tm:text-[9px]/3.5 tm:text-light-grey">
            {localeService.t('agent-ui.chat.tools-hint')}
          </div>
        </HoverPanelHeader>

        <HoverPanelBody className="tm:max-h-70 tm:p-0">
          {tools.length === 0
            ? (
              <div
                className="
                  tm:flex tm:flex-col tm:items-center tm:justify-center tm:gap-1.5 tm:px-3 tm:py-12 tm:text-center
                "
              >
                <div className="tm:text-[10px] tm:font-semibold tm:text-white">
                  {localeService.t('agent-ui.chat.tools-empty')}
                </div>
                <div className="tm:max-w-full tm:text-[10px]/4.5 tm:text-light-grey">
                  {localeService.t('agent-ui.chat.tools-empty-hint')}
                </div>
              </div>
            )
            : (
              <div className="tm:flex tm:flex-col">
                {groupedTools.map(({ category, tools: categoryTools }) => {
                  const meta = CATEGORY_META[category];
                  const Icon = meta.icon;

                  return (
                    <section
                      key={category}
                      className="
                        tm:border-b tm:border-black/6
                        tm:last:border-b-0
                      "
                    >
                      <div
                        className="
                          tm:flex tm:items-center tm:justify-between tm:px-3.5 tm:py-1.5 tm:text-[10px] tm:font-semibold
                          tm:text-light-grey tm:select-none
                        "
                      >
                        <div className="tm:flex tm:items-center tm:gap-2">
                          <Icon className="tm:size-3.5" />
                          <span>{localeService.t(meta.labelKey)}</span>
                        </div>
                      </div>

                      <div className="tm:pb-1">
                        {categoryTools.map((tool) => {
                          const checkboxId = `chat-tool-selector-${tool.id}`;
                          const isChecked = selectedToolIdSet.has(tool.id);

                          return (
                            <label
                              key={tool.id}
                              htmlFor={checkboxId}
                              className="
                                tm:flex tm:cursor-pointer tm:items-start tm:gap-2 tm:px-3.5 tm:py-1.5
                                tm:transition-colors
                                tm:hover:bg-one-bg/60
                              "
                            >
                              <Checkbox
                                id={checkboxId}
                                checked={isChecked}
                                onCheckedChange={(checked) => handleToolToggle(tool.id, checked === true)}
                                className={cn(`
                                  tm:mt-0.5 tm:size-3.5 tm:rounded-sm tm:border-one-bg
                                  tm:[&_svg]:size-2.5
                                `, {
                                  'tm:data-[state=checked]:border-blue tm:data-[state=checked]:bg-blue': isChecked,
                                })}
                              />

                              <div className="tm:min-w-0 tm:flex-1">
                                <div className="tm:truncate tm:text-[12px] tm:font-semibold tm:text-white">
                                  {resolveToolLabel(localeService, tool)}
                                </div>
                                <div className="tm:mt-1 tm:line-clamp-2 tm:text-[9px]/3 tm:text-light-grey">
                                  {resolveToolDescription(localeService, tool)}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
        </HoverPanelBody>

        <HoverPanelFooter className="tm:p-0">
          <Collapsible
            className={cn('tm:w-full tm:transform')}
            open={isServerSectionOpen}
            onOpenChange={setIsServerSectionOpen}
          >
            <CollapsibleTrigger asChild className={cn('tm:px-3 tm:py-1 tm:select-none')}>
              <div
                className={cn(`
                  tm:flex tm:w-full tm:flex-1 tm:text-white tm:outline-hidden tm:transition-colors
                  tm:hover:bg-one-bg/50
                `)}
              >
                <div
                  className="tm:flex tm:flex-1 tm:items-center tm:gap-2 tm:rounded-lg tm:text-left"
                  aria-label={localeService.t('agent-ui.chat.tools-connected-servers')}
                >
                  {isServerSectionOpen
                    ? <ChevronDown className="tm:size-3 tm:text-light-grey" />
                    : <ChevronRight className="tm:size-3 tm:text-light-grey" />}
                  <span className="tm:text-[12px] tm:font-semibold tm:text-white">
                    {localeService.t('agent-ui.chat.tools-connected-servers')}
                  </span>
                  <span
                    className="
                      tm:inline-flex tm:h-3 tm:items-center tm:justify-center tm:rounded-full tm:bg-blue/50 tm:p-1
                      tm:text-[10px] tm:text-[#fff]
                    "
                  >
                    {enabledServerCountLabel}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="
                    tm:flex tm:rounded-md tm:text-white
                    tm:hover:bg-one-bg
                  "
                  onClick={(event) => {
                    event.stopPropagation();
                    void loadTools();
                  }}
                  disabled={isRefreshing}
                  title={localeService.t('agent-ui.chat.tools-refresh-servers')}
                  aria-label={localeService.t('agent-ui.chat.tools-refresh-servers')}
                >
                  <RefreshCw className={cn('tm:size-3', { 'tm:animate-spin': isRefreshing })} />
                </Button>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="tm:px-5 tm:pb-2">
              <div className="tm:mt-1 tm:text-[10px] tm:text-light-grey">
                {localeService.t('agent-ui.chat.tools-connected-servers-hint')}
              </div>

              <div className="tm:mt-3 tm:flex tm:max-h-45 tm:flex-col tm:gap-2 tm:overflow-y-auto">
                {servers.length === 0
                  ? (
                    <div
                      className="tm:rounded-md tm:bg-one-bg/50 tm:px-3.5 tm:py-3 tm:text-[10px] tm:text-light-grey"
                    >
                      {localeService.t('agent-ui.chat.tools-connected-servers-empty')}
                    </div>
                  )
                  : servers.map((server) => {
                    const isPending = pendingServerIds[server.id];

                    let statusIcon: ReactNode;
                    if (isPending) {
                      statusIcon = <Loader2 className="tm:size-3 tm:animate-spin" />;
                    } else if (server.status === 'connected') {
                      statusIcon = <Check className="tm:size-2.5" strokeWidth={2.4} />;
                    } else {
                      statusIcon = <span className="tm:size-2 tm:rounded-full tm:bg-current" />;
                    }

                    const statusIndicator = (
                      <div
                        className={cn(
                          `
                            tm:flex tm:size-3 tm:shrink-0 tm:cursor-pointer tm:items-center tm:justify-center
                            tm:rounded-full
                          `,
                          {
                            'tm:bg-[#e4f4ea] tm:text-[#3d9b63]': server.status === 'connected',
                            'tm:bg-[#fff0d8] tm:text-[#c88b07]': server.status === 'connecting',
                            'tm:bg-[#f8e3e0] tm:text-[#cb5e4b]': server.status === 'error',
                            'tm:bg-[#e8e8e3] tm:text-[#9a9b95]': server.status === 'disconnected',
                          }
                        )}
                      >
                        {statusIcon}
                      </div>
                    );

                    return (
                      <div
                        key={server.id}
                        className={cn(
                          `
                            tm:flex tm:items-center tm:gap-2 tm:rounded-md tm:border tm:px-3.5 tm:py-0.5
                            tm:transition-colors
                          `,
                          {
                            'tm:border-blue/20 tm:bg-blue/5': server.enabled,
                            'tm:border-line': !server.enabled,
                          }
                        )}
                      >
                        <Switch
                          checked={server.enabled}
                          onCheckedChange={(checked) => handleServerToggle(server.id, checked)}
                          disabled={isPending}
                          className="
                            tm:hover:border-transparent
                            tm:focus-visible:ring-blue/25
                            tm:data-[state=checked]:bg-blue
                            tm:data-[state=unchecked]:bg-one-bg
                          "
                        />

                        <div className="tm:flex tm:min-w-0 tm:flex-1 tm:items-center tm:gap-2">
                          <div className="tm:min-w-0 tm:flex-1">
                            <div className="tm:truncate tm:text-[10px] tm:font-semibold tm:text-white">
                              {server.name}
                            </div>
                            <div className="tm:mt-0.5 tm:text-[9px] tm:text-light-grey">
                              {localeService.t('agent-ui.chat.tools-connected-server-tools-count', String(server.toolCount))}
                            </div>
                          </div>

                          {server.status === 'error' && server.lastError
                            ? (
                              <HoverCard openDelay={120} closeDelay={120}>
                                <HoverCardTrigger asChild>
                                  <span className="tm:inline-flex tm:shrink-0">
                                    {statusIndicator}
                                  </span>
                                </HoverCardTrigger>
                                <HoverCardContent
                                  side="top"
                                  align="end"
                                  style={{ width: 'max-content', maxWidth: '18rem' }}
                                  className="
                                    tm:rounded-md tm:bg-black tm:p-2 tm:text-[10px]/4 tm:wrap-break-word tm:text-white
                                    tm:shadow-lg tm:ring-1 tm:ring-black/20
                                  "
                                >
                                  {server.lastError}
                                </HoverCardContent>
                              </HoverCard>
                            )
                            : statusIndicator}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="tm:mt-2 tm:flex tm:items-center tm:gap-1 tm:text-[9px] tm:text-light-grey">
                {isSaving && <Loader2 className="tm:size-3 tm:animate-spin" />}
                <span>
                  {isSaving
                    ? localeService.t('agent-ui.chat.tools-saving')
                    : localeService.t(
                      currentSessionId
                        ? 'agent-ui.chat.tools-session-hint'
                        : 'agent-ui.chat.tools-session-hint-new'
                    )}
                </span>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </HoverPanelFooter>
      </HoverPanelContent>
    </HoverPanel>
  );
}
