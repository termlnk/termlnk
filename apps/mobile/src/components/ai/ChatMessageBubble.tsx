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
import { memo } from 'react';
import { Image, Text, View } from 'react-native';

function UserBubble({ message }: { readonly message: IMobileChatMessage }) {
  const textParts = message.parts.filter((p) => p.type === 'text');
  const imageParts = message.parts.filter((p) => p.type === 'image');

  const text = textParts
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('');

  return (
    <View className="mb-2 max-w-[85%] self-end rounded-2xl bg-accent px-3.5 py-2.5">
      {imageParts.length > 0
        ? (
          <View className="mb-2 flex-row flex-wrap gap-2">
            {imageParts.map((p, i) => {
              const img = p as { type: 'image'; data: string; mimeType: string };
              return (
                <Image
                  key={`img-${i}`}
                  source={{ uri: `data:${img.mimeType};base64,${img.data}` }}
                  className="h-20 w-20 rounded-xl"
                  resizeMode="cover"
                />
              );
            })}
          </View>
        )
        : null}
      {text.length > 0
        ? (
          <Text className="text-[15px] leading-5 text-accent-content">{text}</Text>
        )
        : null}
    </View>
  );
}

function AssistantBubble({ message }: { readonly message: IMobileChatMessage }) {
  const textParts = message.parts.filter((p) => p.type === 'text');
  const thinkingParts = message.parts.filter((p) => p.type === 'thinking');
  const errorParts = message.parts.filter((p) => p.type === 'error');

  return (
    <View className="mb-2 max-w-[85%] self-start rounded-2xl bg-surface-raised px-3.5 py-2.5">
      {thinkingParts.map((p, i) => (
        <View key={`thinking-${i}`} className="mb-2 rounded-lg bg-surface-sunken px-2.5 py-2">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">Thinking</Text>
          <Text className="mt-1 text-[13px] leading-[18px] text-content-secondary" numberOfLines={4}>
            {(p as { type: 'thinking'; thinking: string }).thinking}
          </Text>
        </View>
      ))}
      {textParts.map((p, i) => (
        <Text key={`text-${i}`} className="text-[15px] leading-5 text-content">
          {(p as { type: 'text'; text: string }).text}
        </Text>
      ))}
      {errorParts.map((p, i) => (
        <Text key={`error-${i}`} className="text-[15px] leading-5 text-danger">
          {(p as { type: 'error'; message: string }).message}
        </Text>
      ))}
      {message.isStreaming && textParts.length === 0 && thinkingParts.length === 0 && (
        <Text className="text-[15px] leading-5 text-content-tertiary">Thinking…</Text>
      )}
    </View>
  );
}

function ChatMessageBubbleInner({ message }: { readonly message: IMobileChatMessage }) {
  if (message.role === 'user') {
    return <UserBubble message={message} />;
  }
  return <AssistantBubble message={message} />;
}

export const ChatMessageBubble = memo(ChatMessageBubbleInner);
