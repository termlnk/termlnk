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
import { ChevronRight, HelpCircle, MessageCircle, ScanFace, Settings as SettingsIcon, Sparkles } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrentUser } from '../../src/core/core-context';
import { useThemeColors } from '../../src/theme/theme-provider';
import { Card } from '../../src/ui/card';
import { TAB_BAR_HEIGHT } from '../../src/ui/floating-tab-bar';
import { PrimaryButton } from '../../src/ui/form';
import { IconTile } from '../../src/ui/icon-tile';
import { NavRow } from '../../src/ui/rows';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';

function initial(email: string | undefined): string {
  const trimmed = (email ?? '').trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : '?';
}

export default function ProfileTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const user = useCurrentUser();

  return (
    <ScreenContainer>
      <ScreenHeader variant="large" title="Profile" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 }}>
        <Card>
          <Pressable onPress={() => router.push('/settings')} className="flex-row items-center px-4 py-4 active:bg-surface-sunken">
            <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: '#2f9e8f' }}>
              <Text className="text-[20px] font-bold text-white">{initial(user?.email)}</Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[17px] font-semibold text-content" numberOfLines={1}>
                {user?.email ?? 'Not signed in'}
              </Text>
              <Text className="mt-0.5 text-[14px] text-content-secondary">Security, Cloud, and Subscription</Text>
            </View>
            <ChevronRight size={20} color={colors.contentTertiary} />
          </Pressable>
        </Card>

        <View className="mt-4">
          <Card dividerInset={64}>
            <NavRow
              leading={<IconTile icon={ScanFace} tone="sshid" />}
              title="SSH ID"
              onPress={() => Alert.alert('SSH ID', 'SSH ID is coming soon.')}
            />
          </Card>
        </View>

        <View className="mt-4">
          <Card dividerInset={64}>
            <NavRow
              leading={<IconTile icon={Sparkles} tone="ai" />}
              title="AI Assistant"
              onPress={() => router.push('/ai')}
            />
            <NavRow
              leading={<IconTile icon={SettingsIcon} tone="settings" />}
              title="Settings"
              onPress={() => router.push('/settings')}
            />
            <NavRow
              leading={<IconTile icon={HelpCircle} tone="help" />}
              title="Help & Feedback"
              onPress={() => Alert.alert('Help & Feedback', 'Reach us through the in-app channels — coming soon.')}
            />
          </Card>
        </View>

        <View className="mt-5">
          <Card>
            <View className="p-4">
              <View className="flex-row items-center">
                <IconTile icon={MessageCircle} tone="discord" />
                <Text className="ml-3 text-[17px] font-semibold text-content">Join our Discord</Text>
              </View>
              <Text className="mt-3 text-[14px] leading-5 text-content-secondary">
                Share your feedback on the new Termlnk app and find the latest news in our Discord community.
              </Text>
              <View className="mt-4">
                <PrimaryButton title="Share your feedback" onPress={() => Alert.alert('Discord', 'Community link is coming soon.')} />
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
