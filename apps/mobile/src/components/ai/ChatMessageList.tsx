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

import type { IMobileChatMessage } from '@termlnk/agent-mobile';
import { useCallback, useEffect, useRef } from 'react';
import { FlatList, View } from 'react-native';
import { ChatMessageBubble } from './ChatMessageBubble';

interface IChatMessageListProps {
  readonly messages: readonly IMobileChatMessage[];
  readonly currentMessage: IMobileChatMessage | null;
  readonly contentPaddingBottom: number;
}

export function ChatMessageList({ messages, currentMessage, contentPaddingBottom }: IChatMessageListProps) {
  const listRef = useRef<FlatList<IMobileChatMessage>>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isStreaming = currentMessage != null;

  const allMessages: IMobileChatMessage[] = currentMessage
    ? [...messages, currentMessage]
    : [...messages];

  useEffect(() => {
    if (allMessages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [allMessages.length]);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }
    if (scrollTimerRef.current != null) {
      return;
    }
    scrollTimerRef.current = setInterval(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 200);
    return () => {
      if (scrollTimerRef.current != null) {
        clearInterval(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };
  }, [isStreaming]);

  const renderItem = useCallback(({ item }: { item: IMobileChatMessage }) => (
    <ChatMessageBubble message={item} />
  ), []);

  return (
    <View className="flex-1">
      <FlatList
        ref={listRef}
        data={allMessages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: contentPaddingBottom }}
      />
    </View>
  );
}
