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

import { Stack, useRouter } from 'expo-router';
import { Send, Settings2, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useAiService, useObservable } from '../../src/core/core-context';
import { EmptyState } from '../../src/ui/empty-state';

export default function AiTab() {
  const ai = useAiService();
  const router = useRouter();
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

  return (
    <KeyboardAvoidingView className="flex-1 bg-black" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/ai-settings')} hitSlop={12}>
              <Settings2 size={18} color="#61afef" />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View className={`mb-2 max-w-[85%] rounded-2xl px-3.5 py-2.5 ${item.role === 'user' ? 'self-end bg-nord-blue' : 'self-start bg-one-bg'}`}>
            {item.pending
              ? <ActivityIndicator color="#6f737b" />
              : (
                <Text className={`text-[14px] leading-5 ${item.role === 'user' ? 'text-black' : item.error ? 'text-red' : 'text-light-grey'}`}>
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
      <View className="flex-row items-end gap-2 border-t border-line px-3 py-2">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message the assistant…"
          placeholderTextColor="#42464e"
          multiline
          className="max-h-28 flex-1 rounded-2xl bg-one-bg px-3.5 py-2.5 text-[14px] text-light-grey"
        />
        <Pressable
          onPress={onSend}
          disabled={sending || input.trim().length === 0}
          className={`h-10 w-10 items-center justify-center rounded-full ${sending || input.trim().length === 0 ? 'bg-one-bg2' : 'bg-nord-blue active:opacity-80'}`}
        >
          {sending ? <ActivityIndicator color="#1e222a" /> : <Send size={18} color="#1e222a" />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
