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

import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Send, Settings2, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAiService, useObservable } from '../src/core/core-context';
import { useThemeColors } from '../src/theme/theme-provider';
import { EmptyState } from '../src/ui/empty-state';
import { RoundButton } from '../src/ui/round-button';
import { ScreenHeader } from '../src/ui/screen-header';

export default function AiScreen() {
  const ai = useAiService();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const messages = useObservable(ai.messages$, []);
  const sending = useObservable(ai.sending$, false);
  const [input, setInput] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    void ai.hasApiKey().then(setHasKey);
  }, [ai, messages.length]);

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) {
      return;
    }
    setInput('');
    try {
      await ai.send(text);
    } catch {
      setHasKey(false);
    }
  }, [ai, input, sending]);

  const canSend = !sending && input.trim().length > 0;

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        variant="nav"
        title="AI Assistant"
        onBack={() => router.back()}
        right={<RoundButton icon={Settings2} onPress={() => router.push('/ai-settings')} accessibilityLabel="AI settings" />}
      />
      <FlashList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <View className={`mb-2 max-w-[85%] rounded-2xl px-3.5 py-2.5 ${item.role === 'user' ? 'self-end bg-accent' : 'self-start bg-surface-raised'}`}>
            {item.pending
              ? <ActivityIndicator color={colors.contentSecondary} />
              : (
                <Text className={`text-[15px] leading-5 ${item.role === 'user' ? 'text-accent-content' : item.error ? 'text-danger' : 'text-content'}`}>
                  {item.content}
                </Text>
              )}
          </View>
        )}
        ListEmptyComponent={(
          <View className="flex-1 justify-center">
            <EmptyState
              icon={Sparkles}
              title="AI assistant"
              description={hasKey === false
                ? 'Add an OpenAI-compatible API key in settings (top-right) to start chatting.'
                : 'Ask anything — shell commands, config help, or debugging.'}
            />
          </View>
        )}
      />
      <View className="flex-row items-end gap-2 border-t border-divider px-3 py-2" style={{ paddingBottom: insets.bottom + 8 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message the assistant…"
          placeholderTextColor={colors.contentTertiary}
          multiline
          className="max-h-28 flex-1 rounded-2xl bg-field px-3.5 py-2.5 text-[15px] text-content"
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          className={`h-10 w-10 items-center justify-center rounded-full ${canSend ? 'bg-accent active:opacity-80' : 'bg-surface-sunken'}`}
        >
          {sending ? <ActivityIndicator color={colors.accentContent} /> : <Send size={18} color={canSend ? colors.accentContent : colors.contentTertiary} />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
