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
import { KeyRound, LockKeyhole, MoreHorizontal, ShieldCheck, Smartphone } from 'lucide-react-native';
import { useCallback } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/ui/card';
import { DangerButton } from '../components/ui/form';
import { IconTile } from '../components/ui/icon-tile';
import { RoundButton } from '../components/ui/round-button';
import { NavRow, SwitchRow } from '../components/ui/rows';
import { ScreenContainer } from '../components/ui/screen-container';
import { ScreenHeader } from '../components/ui/screen-header';
import { UserAvatar } from '../components/ui/user-avatar';
import { useAuthService, useCurrentUser } from '../core/core-context';

const SOON = (title: string) => () => Alert.alert(title, 'This account feature is coming soon.');

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuthService();
  const user = useCurrentUser();

  const onSignOut = useCallback(async () => {
    if (auth == null) {
      router.replace('/login');
      return;
    }
    await auth.logout();
    router.replace('/login');
  }, [auth, router]);

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="nav"
        title="Account"
        onBack={() => router.back()}
        right={<RoundButton icon={MoreHorizontal} onPress={SOON('Account actions')} accessibilityLabel="Account actions" />}
      />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: insets.bottom + 24 }}>
        <View className="items-center pt-6">
          <UserAvatar user={user} size={64} radius={18} />
          <Text className="mt-5 text-center text-[20px] font-bold leading-6 text-content" numberOfLines={1}>
            {user?.email ?? 'Not signed in'}
          </Text>
        </View>

        <Card className="mt-12" dividerInset={64}>
          <SwitchRow
            leading={<IconTile icon={ShieldCheck} tone="neutral" />}
            title="2FA"
            value={false}
            onValueChange={SOON('2FA')}
          />
          <SwitchRow
            leading={<IconTile icon={KeyRound} tone="sessions" />}
            title="Sync Keys & Identities"
            value={false}
            onValueChange={SOON('Sync Keys & Identities')}
          />
          <NavRow
            leading={<IconTile icon={LockKeyhole} tone="known" />}
            title="Change Password"
            onPress={() => router.push('/change-password')}
          />
          <NavRow
            leading={<IconTile icon={Smartphone} tone="snippets" />}
            title="Devices"
            onPress={() => router.push('/devices')}
          />
        </Card>

        <View className="flex-1" />

        {user != null && (
          <DangerButton
            title="Sign out"
            onPress={onSignOut}
            className="mt-10 border-0 bg-transparent"
          />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
