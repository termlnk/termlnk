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
import { cn, useDependency, useObservable } from '@termlnk/design';
import { IChatSessionService } from '@termlnk/rpc-client';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface IChatSession {
  id: string;
  title: string;
  messageCount: number;
  accessedAt: string;
}

interface IChatSessionListProps {
  onSelectSession: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ChatSessionList({ onSelectSession }: IChatSessionListProps) {
  const chatSessionService = useDependency(IChatSessionService);
  const localeService = useDependency(LocaleService);
  const currentSessionId = useObservable(chatSessionService.currentSessionId$, null);

  const [sessions, setSessions] = useState<IChatSession[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Track session changes to refresh the list
  const sessionChange = useObservable(chatSessionService.sessions$, null);

  const loadSessions = useCallback(async () => {
    const list = await chatSessionService.listSessions();
    setSessions(list as IChatSession[]);
  }, [chatSessionService]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions, sessionChange]);

  const handleSelect = useCallback(async (sessionId: string) => {
    await chatSessionService.loadSession(sessionId);
    onSelectSession();
  }, [chatSessionService, onSelectSession]);

  const handleDelete = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await chatSessionService.deleteSession(sessionId);
    loadSessions();
  }, [chatSessionService, loadSessions]);

  const handleStartRename = useCallback((e: React.MouseEvent, sessionId: string, title: string) => {
    e.stopPropagation();
    setEditingId(sessionId);
    setEditTitle(title);
  }, []);

  const handleRename = useCallback(async (sessionId: string) => {
    if (editTitle.trim()) {
      await chatSessionService.renameSession(sessionId, editTitle.trim());
      loadSessions();
    }
    setEditingId(null);
  }, [chatSessionService, editTitle, loadSessions]);

  if (sessions.length === 0) {
    return (
      <div className="tm:flex tm:h-full tm:items-center tm:justify-center tm:text-xs tm:text-grey">
        <span>{localeService.t('agent-ui.chat.no-sessions')}</span>
      </div>
    );
  }

  return (
    <div className="tm:flex-1 tm:overflow-y-auto tm:p-2">
      <div className="tm:flex tm:flex-col tm:gap-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              `
                tm:group
                tm:flex tm:items-center tm:gap-2 tm:rounded-md tm:p-2 tm:text-xs tm:transition-colors
                tm:hover:bg-one-bg
              `,
              {
                'tm:bg-one-bg2': session.id === currentSessionId,
              }
            )}
            onClick={() => handleSelect(session.id)}
          >
            <MessageSquare size={14} className="tm:shrink-0 tm:text-white" />
            <div className="tm:min-w-0 tm:flex-1">
              {editingId === session.id
                ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleRename(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(session.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="tm:w-full tm:bg-transparent tm:text-xs tm:text-white tm:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                )
                : (
                  <div className="tm:truncate tm:text-white">{session.title}</div>
                )}
              <div className="tm:flex tm:items-center tm:gap-2 tm:text-light-grey">
                <span>{formatDate(session.accessedAt)}</span>
                <span>
                  {session.messageCount}
                  {' '}
                  {localeService.t('agent-ui.chat.messages')}
                </span>
              </div>
            </div>
            <div
              className="
                tm:flex tm:shrink-0 tm:items-center tm:gap-0.5 tm:opacity-0 tm:transition-opacity
                tm:group-hover:opacity-100
              "
            >
              <button
                type="button"
                className="
                  tm:flex tm:size-6 tm:items-center tm:justify-center tm:rounded-sm tm:text-white
                  tm:hover:bg-one-bg2 tm:hover:text-white
                "
                onClick={(e) => handleStartRename(e, session.id, session.title)}
                title={localeService.t('agent-ui.chat.rename-session')}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="
                  tm:flex tm:size-6 tm:items-center tm:justify-center tm:rounded-sm tm:text-white
                  tm:hover:bg-one-bg2 tm:hover:text-white
                "
                onClick={(e) => handleDelete(e, session.id)}
                title={localeService.t('agent-ui.chat.delete-session')}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
