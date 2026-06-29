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

import { useFocusEffect, useRouter } from 'expo-router';
import { MessageSquare, Plus, Settings2 } from 'lucide-react-native';
import { useCallback } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SessionList } from '../../components/ai/SessionList';
import { EmptyState } from '../../components/ui/empty-state';
import { TAB_BAR_HEIGHT } from '../../components/ui/floating-tab-bar';
import { RoundButton } from '../../components/ui/round-button';
import { ScreenContainer } from '../../components/ui/screen-container';
import { ScreenHeader } from '../../components/ui/screen-header';
import { useChatService, useObservable, useProviderService, useSessionService } from '../../core/core-context';

export default function AiTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const chatService = useChatService();
  const providerService = useProviderService();
  const sessionService = useSessionService();

  const sessions = useObservable(sessionService.sessions$, []);

  useFocusEffect(
    useCallback(() => {
      void providerService.initialize();
      void sessionService.listSessions();
    }, [providerService, sessionService])
  );

  const handleNewChat = useCallback(async () => {
    await chatService.createNewSession();
    router.push('/ai-chat');
  }, [chatService, router]);

  const handleLoadSession = useCallback(async (sessionId: string) => {
    await chatService.loadSession(sessionId);
    router.push('/ai-chat');
  }, [chatService, router]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await sessionService.deleteSession(sessionId);
  }, [sessionService]);

  const contentPaddingBottom = insets.bottom + TAB_BAR_HEIGHT + 24;

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="large"
        title="Assistant"
        right={(
          <View className="flex-row items-center gap-1">
            <RoundButton icon={Plus} onPress={handleNewChat} accessibilityLabel="New chat" />
            <RoundButton icon={Settings2} onPress={() => router.push('/ai-settings')} accessibilityLabel="AI settings" />
          </View>
        )}
      />

      {sessions.length === 0
        ? (
          <View className="flex-1 justify-center" style={{ paddingBottom: contentPaddingBottom }}>
            <EmptyState
              icon={MessageSquare}
              title="No Chats Yet"
              description="Tap + to start a new conversation with the AI assistant."
            />
          </View>
        )
        : (
          <SessionList
            sessions={sessions}
            onSelect={handleLoadSession}
            onDelete={handleDeleteSession}
            contentPaddingBottom={contentPaddingBottom}
          />
        )}
    </ScreenContainer>
  );
}
