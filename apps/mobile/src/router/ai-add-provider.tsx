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

import type { MobileApiType } from '@termlnk/agent-mobile';
import type { ISelectSheetOption } from '../components/ui/select-sheet';
import { Stack, useRouter } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormSection, TextField } from '../components/ui/form';
import { ScreenContainer } from '../components/ui/screen-container';
import { SelectSheet } from '../components/ui/select-sheet';
import { useProviderService } from '../core/core-context';
import { useThemeColors } from '../theme/theme-provider';

const API_TYPE_OPTIONS: ReadonlyArray<ISelectSheetOption<MobileApiType>> = [
  { value: 'openai-completions', label: 'OpenAI Completions', subtitle: 'DeepSeek, Groq, Ollama, etc.' },
  { value: 'openai-responses', label: 'OpenAI Responses', subtitle: 'GPT-5, o3, etc.' },
  { value: 'anthropic-messages', label: 'Anthropic Messages', subtitle: 'Claude series' },
  { value: 'google-generative-ai', label: 'Google Generative AI', subtitle: 'Gemini API' },
  { value: 'google-vertex', label: 'Google Vertex AI', subtitle: 'Vertex AI API' },
  { value: 'azure-openai-responses', label: 'Azure OpenAI', subtitle: 'Azure OpenAI Responses API' },
  { value: 'bedrock-converse-stream', label: 'Amazon Bedrock', subtitle: 'Bedrock Converse Stream API' },
];

export default function AiAddProviderRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const providerService = useProviderService();

  const [name, setName] = useState('');
  const [api, setApi] = useState<MobileApiType>('openai-completions');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [showApiTypeSheet, setShowApiTypeSheet] = useState(false);

  const canSave = name.trim().length > 0 && baseUrl.trim().length > 0;
  const apiTypeLabel = API_TYPE_OPTIONS.find((o) => o.value === api)?.label ?? api;

  async function onSave() {
    if (!canSave) {
      return;
    }
    setBusy(true);
    try {
      const id = await providerService.addProvider({
        name: name.trim(),
        enabled: true,
        builtin: false,
        api,
        baseUrl: baseUrl.trim(),
        sort: 100,
      });
      if (apiKey.trim().length > 0) {
        await providerService.setApiKey(id, apiKey.trim());
      }
      router.back();
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          title: 'Add Provider',
          headerRight: () => (
            <Pressable onPress={onSave} disabled={!canSave || busy} accessibilityLabel="Save">
              <Check size={22} color={canSave && !busy ? colors.accent : colors.contentTertiary} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <FormSection title="Provider">
            <TextField label="Name" value={name} onChangeText={setName} placeholder="My Provider" />
            <Pressable onPress={() => setShowApiTypeSheet(true)} className="flex-row items-center justify-between px-4 py-3">
              <View>
                <Text className="mb-0.5 text-[12px] font-medium text-content-tertiary">API Type</Text>
                <Text className="text-[15px] text-content">{apiTypeLabel}</Text>
              </View>
              <ChevronRight size={18} color={colors.contentTertiary} />
            </Pressable>
          </FormSection>

          <FormSection title="Endpoint">
            <TextField
              label="Base URL"
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder="https://api.example.com/v1"
              keyboardType="url"
              last
            />
          </FormSection>

          <FormSection title="Authentication" footer="Stored only in this device's OS keystore — never synced.">
            <TextField
              label="API Key"
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
              placeholder="sk-…"
              last
            />
          </FormSection>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectSheet
        visible={showApiTypeSheet}
        title="API Type"
        options={API_TYPE_OPTIONS}
        value={api}
        onSelect={setApi}
        onClose={() => setShowApiTypeSheet(false)}
      />
    </ScreenContainer>
  );
}
