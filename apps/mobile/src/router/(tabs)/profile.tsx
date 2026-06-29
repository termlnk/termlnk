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
import { ChevronRight, HelpCircle, LogIn, Settings as SettingsIcon, UserPlus } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/card';
import { TAB_BAR_HEIGHT } from '../../components/ui/floating-tab-bar';
import { IconTile } from '../../components/ui/icon-tile';
import { NavRow } from '../../components/ui/rows';
import { ScreenContainer } from '../../components/ui/screen-container';
import { ScreenHeader } from '../../components/ui/screen-header';
import { UserAvatar } from '../../components/ui/user-avatar';
import { useCurrentUser } from '../../core/core-context';
import { useThemeColors } from '../../theme/theme-provider';

export default function ProfileTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const user = useCurrentUser();

  return (
    <ScreenContainer>
      <ScreenHeader variant="large" title="Profile" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 }}>
        {user == null
          ? (
            <Card dividerInset={64}>
              <NavRow
                leading={<IconTile icon={UserPlus} tone="known" />}
                title="Create account"
                onPress={() => router.push('/register')}
              />
              <NavRow
                leading={<IconTile icon={LogIn} tone="sessions" />}
                title="Log in"
                onPress={() => router.push('/login')}
              />
            </Card>
          )
          : (
            <Card>
              <Pressable onPress={() => router.push('/account')} className="flex-row items-center px-4 py-4 active:bg-surface-sunken">
                <UserAvatar user={user} size={48} radius={16} />
                <View className="ml-3 flex-1">
                  <Text className="text-[16px] font-semibold leading-5 text-content" numberOfLines={1}>
                    {user.email}
                  </Text>
                  <Text className="mt-0.5 text-[13px] leading-[18px] text-content-secondary">Security, Cloud, and Subscription</Text>
                </View>
                <ChevronRight size={20} color={colors.contentTertiary} />
              </Pressable>
            </Card>
          )}

        <View className="mt-4">
          <Card dividerInset={64}>
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
      </ScrollView>
    </ScreenContainer>
  );
}
