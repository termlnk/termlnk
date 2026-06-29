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

import type { IMobileSendMessageOptions } from '@termlnk/agent-mobile';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatInput } from '../components/ai/ChatInput';
import { ChatMessageList } from '../components/ai/ChatMessageList';
import { ModelSelectorSheet } from '../components/ai/ModelSelectorSheet';
import { EmptyState } from '../components/ui/empty-state';
import { ScreenHeader } from '../components/ui/screen-header';
import { useChatService, useObservable, useProviderService } from '../core/core-context';

export default function AiChatRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const chatService = useChatService();
  const providerService = useProviderService();

  const messages = useObservable(chatService.messages$, []);
  const status = useObservable(chatService.status$, 'idle');
  const currentMessage = useObservable(chatService.currentMessage$, null);
  const providers = useObservable(providerService.providers$, []);
  const activeModel = useObservable(providerService.activeModel$, null);
  const thinkingLevel = useObservable(chatService.thinkingLevel$, 'high');

  const [showModelSheet, setShowModelSheet] = useState(false);

  useEffect(() => {
    void providerService.initialize();
  }, [providerService]);

  const handleSend = useCallback(async (text: string, options?: IMobileSendMessageOptions) => {
    await chatService.sendMessage(text, options);
  }, [chatService]);

  const handleStop = useCallback(() => {
    chatService.stopStreaming();
  }, [chatService]);

  const handleModelSelect = useCallback((model: { id: string }) => {
    providerService.setActiveModel(model.id);
  }, [providerService]);

  const handleThinkingLevelChange = useCallback((level: typeof thinkingLevel) => {
    chatService.setThinkingLevel(level);
  }, [chatService]);

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        variant="nav"
        title="AI Chat"
        onBack={() => router.back()}
      />

      {messages.length === 0 && currentMessage == null
        ? (
          <View className="flex-1 justify-center" style={{ paddingBottom: insets.bottom }}>
            <EmptyState
              icon={Sparkles}
              title="AI Assistant"
              description={activeModel
                ? 'Ask anything — shell commands, config help, or debugging.'
                : 'Configure a provider and select a model to start chatting.'}
            />
          </View>
        )
        : (
          <ChatMessageList
            messages={messages}
            currentMessage={currentMessage}
            contentPaddingBottom={8}
          />
        )}

      <ChatInput
        modelName={activeModel?.name ?? null}
        modelReasoning={activeModel?.reasoning ?? false}
        contextWindowTokens={activeModel?.contextWindow ?? 0}
        status={status}
        messages={messages}
        onSend={handleSend}
        onStop={handleStop}
        onModelPress={() => setShowModelSheet(true)}
        thinkingLevel={thinkingLevel}
        onThinkingLevelChange={handleThinkingLevelChange}
        bottomInset={insets.bottom}
      />

      <ModelSelectorSheet
        visible={showModelSheet}
        providers={providers}
        activeModelId={activeModel?.id ?? null}
        onSelect={handleModelSelect}
        onClose={() => setShowModelSheet(false)}
      />
    </KeyboardAvoidingView>
  );
}
