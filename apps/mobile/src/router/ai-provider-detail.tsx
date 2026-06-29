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

import type { IMobileProviderGroup } from '@termlnk/agent-mobile';
import { KNOWN_PROVIDER_TEMPLATES } from '@termlnk/agent-mobile';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Brain, Check, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DangerButton, FormSection, NavField, PrimaryButton, SwitchField, TextField } from '../components/ui/form';
import { ScreenContainer } from '../components/ui/screen-container';
import { useObservable, useProviderService } from '../core/core-context';
import { useThemeColors } from '../theme/theme-provider';

function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(0)}M`;
  }
  return `${(tokens / 1_000).toFixed(0)}K`;
}

interface IModelToggleSheetProps {
  readonly visible: boolean;
  readonly group: IMobileProviderGroup;
  readonly onToggle: (providerId: string, modelId: string, enabled: boolean) => void;
  readonly onRefresh: () => void;
  readonly refreshing: boolean;
  readonly onClose: () => void;
}

function ModelToggleSheet({ visible, group, onToggle, onRefresh, refreshing, onClose }: IModelToggleSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const filteredModels = group.models.filter(
    (m) => search.length === 0 || m.name.toLowerCase().includes(search.toLowerCase()) || m.modelId.toLowerCase().includes(search.toLowerCase())
  );

  const enabledCount = group.models.filter((m) => m.enabled).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-surface" style={{ paddingTop: 16 }}>
        <View className="flex-row items-center justify-between px-4 pb-3">
          <View>
            <Text className="text-[18px] font-bold text-content">Models</Text>
            <Text className="mt-0.5 text-[12px] text-content-tertiary">
              {`${enabledCount} / ${group.models.length} enabled`}
            </Text>
          </View>
          <View className="flex-row items-center gap-4">
            <Pressable onPress={onRefresh} disabled={refreshing} className="flex-row items-center gap-1.5">
              {refreshing
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <RefreshCw size={16} color={colors.accent} />}
              <Text className="text-[14px] font-medium text-accent">Fetch</Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text className="text-[15px] font-semibold text-accent">Done</Text>
            </Pressable>
          </View>
        </View>

        <View className="mx-4 mb-3">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search models…"
            placeholderTextColor={colors.contentTertiary}
            className="rounded-xl bg-field px-3.5 py-2.5 text-[15px] text-content"
          />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          <View className="mx-4 overflow-hidden rounded-2xl bg-surface-raised">
            {filteredModels.map((model, i) => (
              <View key={model.id}>
                {i > 0 && <View className="mx-4 h-px bg-divider/50" />}
                <View className="flex-row items-center px-4 py-3">
                  <View className="flex-1">
                    <Text className="text-[15px] leading-5 text-content">{model.name}</Text>
                    <View className="mt-0.5 flex-row items-center gap-2">
                      {model.reasoning && (
                        <View className="flex-row items-center gap-0.5">
                          <Brain size={12} color={colors.contentTertiary} />
                          <Text className="text-[11px] text-content-tertiary">Reasoning</Text>
                        </View>
                      )}
                      <Text className="text-[11px] text-content-tertiary">
                        {`${formatContextWindow(model.contextWindow)} ctx`}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={model.enabled}
                    onValueChange={(next) => onToggle(model.providerId, model.modelId, next)}
                    trackColor={{ false: colors.divider, true: colors.accent }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            ))}
          </View>
          {filteredModels.length === 0 && (
            <View className="items-center py-12">
              <Text className="text-[15px] text-content-tertiary">
                {search.length > 0 ? 'No models match your search.' : 'No models available. Tap Fetch to load models.'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function AiProviderDetailRoute() {
  const { providerId } = useLocalSearchParams<{ providerId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const providerService = useProviderService();
  const providers = useObservable(providerService.providers$, []);

  const group = providers.find((g) => g.provider.id === providerId);
  const provider = group?.provider;

  const template = KNOWN_PROVIDER_TEMPLATES.find((t) => t.id === providerId);

  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showModels, setShowModels] = useState(false);

  useEffect(() => {
    if (!provider || !providerId) {
      return;
    }
    setBaseUrl(provider.baseUrl ?? '');
    setEnabled(provider.enabled);
    void providerService.getApiKey(providerId).then((k) => setHasKey(!!k));
  }, [provider, providerId, providerService]);

  const onSave = useCallback(async () => {
    if (!providerId) {
      return;
    }
    setBusy(true);
    try {
      await providerService.updateProvider(providerId, {
        enabled,
        baseUrl: baseUrl.trim() || undefined,
      });
      if (apiKey.trim().length > 0) {
        await providerService.setApiKey(providerId, apiKey.trim());
        setHasKey(true);
        setApiKey('');
      }
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
    } finally {
      setBusy(false);
    }
  }, [providerId, enabled, baseUrl, apiKey, providerService, router]);

  const onRefresh = useCallback(async () => {
    if (!providerId) {
      return;
    }
    setRefreshing(true);
    try {
      await providerService.refreshProviderModels(providerId);
    } catch (err) {
      Alert.alert('Refresh failed', err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, [providerId, providerService]);

  const onToggleModel = useCallback(async (pid: string, modelId: string, nextEnabled: boolean) => {
    try {
      await providerService.toggleModel(pid, modelId, nextEnabled);
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : String(err));
    }
  }, [providerService]);

  const onTest = useCallback(async () => {
    if (!providerId || !group?.models.length) {
      return;
    }
    setTesting(true);
    try {
      const firstModel = group.models.find((m) => m.enabled) ?? group.models[0];
      const result = await providerService.testProvider(providerId, firstModel.modelId);
      Alert.alert('Connection OK', `Response in ${result.latencyMs}ms`);
    } catch (err) {
      Alert.alert('Connection failed', err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }, [providerId, group, providerService]);

  const onDelete = useCallback(() => {
    if (!providerId || provider?.builtin) {
      return;
    }
    Alert.alert('Delete Provider', `Remove "${provider?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await providerService.removeProvider(providerId);
          router.back();
        },
      },
    ]);
  }, [providerId, provider, providerService, router]);

  if (!provider) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Provider', headerShown: true }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-content-tertiary">Provider not found.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const enabledModelCount = group ? group.models.filter((m) => m.enabled).length : 0;
  const totalModelCount = group ? group.models.length : 0;
  const defaultBaseUrl = template?.defaultBaseUrl;

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          title: provider.name,
          headerShown: true,
          headerRight: () => (
            <Pressable onPress={onSave} disabled={busy} accessibilityLabel="Save">
              <Check size={22} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <FormSection title="Status">
            <SwitchField label="Enabled" value={enabled} onValueChange={setEnabled} last />
          </FormSection>

          <FormSection
            title="Authentication"
            footer={hasKey ? 'A key is stored in this device\'s keystore. Enter a new one to replace it.' : 'Stored only in this device\'s OS keystore — never synced.'}
          >
            <TextField
              label={hasKey ? 'New API Key' : 'API Key'}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
              placeholder="sk-…"
              last
            />
          </FormSection>

          <FormSection title="Endpoint" footer={defaultBaseUrl ? `Default: ${defaultBaseUrl}` : undefined}>
            <TextField
              label="Base URL"
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder={defaultBaseUrl ?? 'https://api.example.com/v1'}
              keyboardType="url"
              last
            />
          </FormSection>

          <FormSection title="Models">
            <NavField
              label="Models"
              value={`${enabledModelCount} / ${totalModelCount}`}
              onPress={() => setShowModels(true)}
              last
            />
          </FormSection>

          <View className="mt-6 gap-3 px-4">
            <PrimaryButton
              title={testing ? 'Testing…' : 'Test Connection'}
              onPress={onTest}
              busy={testing}
            />
            {!provider.builtin && (
              <DangerButton title="Delete Provider" onPress={onDelete} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {group && (
        <ModelToggleSheet
          visible={showModels}
          group={group}
          onToggle={onToggleModel}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onClose={() => setShowModels(false)}
        />
      )}
    </ScreenContainer>
  );
}
