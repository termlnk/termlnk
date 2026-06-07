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
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAiService, usePreferencesService } from '../src/core/core-context';
import { DangerButton, FormSection, PrimaryButton, TextField } from '../src/ui/form';
import { ScreenContainer } from '../src/ui/screen-container';

export default function AiSettingsRoute() {
  const prefs = usePreferencesService();
  const ai = useAiService();
  const router = useRouter();

  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void prefs.ready().then(() => {
      const p = prefs.get();
      setBaseUrl(p.aiBaseUrl);
      setModel(p.aiModel);
    });
    void ai.hasApiKey().then(setHasKey);
  }, [prefs, ai]);

  async function onSave() {
    setBusy(true);
    try {
      await prefs.update({ aiBaseUrl: baseUrl.trim(), aiModel: model.trim() });
      if (apiKey.trim().length > 0) {
        await ai.setApiKey(apiKey.trim());
      }
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
    } finally {
      setBusy(false);
    }
  }

  function onClearKey() {
    Alert.alert('Remove API key', 'The stored API key will be deleted from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void ai.clearApiKey().then(() => setHasKey(false)) },
    ]);
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'AI Provider', headerShown: true }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <FormSection title="Provider" footer="Any OpenAI-compatible Chat Completions endpoint (OpenAI, DeepSeek, Moonshot, a local gateway, …).">
            <TextField label="Base URL" value={baseUrl} onChangeText={setBaseUrl} placeholder="https://api.openai.com/v1" keyboardType="url" />
            <TextField label="Model" value={model} onChangeText={setModel} placeholder="gpt-4o-mini" last />
          </FormSection>

          <FormSection title="API key" footer={hasKey ? 'A key is stored in this device’s keystore. Enter a new one to replace it.' : 'Stored only in this device’s OS keystore — never synced.'}>
            <TextField label={hasKey ? 'New API key' : 'API key'} value={apiKey} onChangeText={setApiKey} secureTextEntry placeholder="sk-…" last />
          </FormSection>

          <View className="mt-6 gap-3 px-4">
            <PrimaryButton title="Save" onPress={onSave} busy={busy} />
            {hasKey && <DangerButton title="Remove API key" onPress={onClearKey} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
