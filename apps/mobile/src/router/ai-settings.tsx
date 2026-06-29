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
import { Stack, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/ui/card';
import { NavRow } from '../components/ui/rows';
import { ScreenContainer } from '../components/ui/screen-container';
import { SectionLabel } from '../components/ui/section-label';
import { StatusDot } from '../components/ui/status-dot';
import { useObservable, useProviderService } from '../core/core-context';
import { useThemeColors } from '../theme/theme-provider';

function modelSummary(group: IMobileProviderGroup): string {
  const enabled = group.models.filter((m) => m.enabled);
  if (group.models.length === 0) {
    return 'No models';
  }
  return `${enabled.length}/${group.models.length} models`;
}

export default function AiSettingsRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const providerService = useProviderService();
  const providers = useObservable(providerService.providers$, []);

  useEffect(() => {
    void providerService.initialize();
  }, [providerService]);

  const builtin = providers.filter((g) => g.provider.builtin).sort((a, b) => Number(b.provider.enabled) - Number(a.provider.enabled));
  const custom = providers.filter((g) => !g.provider.builtin).sort((a, b) => Number(b.provider.enabled) - Number(a.provider.enabled));

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          title: 'AI Providers',
          headerRight: () => (
            <Pressable onPress={() => router.push('/ai-add-provider' as never)} accessibilityLabel="Add provider">
              <Plus size={22} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {builtin.length > 0 && (
          <View className="mt-2">
            <SectionLabel title="Providers" className="px-4" />
            <View className="mx-4">
              <Card dividerInset={40}>
                {builtin.map((group) => (
                  <NavRow
                    key={group.provider.id}
                    leading={<StatusDot active={group.provider.enabled} />}
                    title={group.provider.name}
                    subtitle={modelSummary(group)}
                    onPress={() => router.push({ pathname: '/ai-provider-detail' as never, params: { providerId: group.provider.id } })}
                  />
                ))}
              </Card>
            </View>
          </View>
        )}

        {custom.length > 0 && (
          <View className="mt-5">
            <SectionLabel title="Custom" className="px-4" />
            <View className="mx-4">
              <Card dividerInset={40}>
                {custom.map((group) => (
                  <NavRow
                    key={group.provider.id}
                    leading={<StatusDot active={group.provider.enabled} />}
                    title={group.provider.name}
                    subtitle={modelSummary(group)}
                    onPress={() => router.push({ pathname: '/ai-provider-detail' as never, params: { providerId: group.provider.id } })}
                  />
                ))}
              </Card>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
