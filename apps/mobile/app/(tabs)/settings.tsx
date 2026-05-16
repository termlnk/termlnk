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

import type { ReactNode } from 'react';
import type { IBiometricAvailability } from '../../src/platform/biometric.service';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAuthService, useCurrentUser } from '../../src/core/core-context';
import { BiometricService } from '../../src/platform/biometric.service';
import { ScreenContainer } from '../../src/ui/screen-container';

export default function SettingsTab() {
  const user = useCurrentUser();
  const auth = useAuthService();
  const router = useRouter();
  const [biometric, setBiometric] = useState<IBiometricAvailability | null>(null);

  useEffect(() => {
    const service = new BiometricService();
    service.getAvailability().then(setBiometric).catch(() => setBiometric(null));
  }, []);

  const onSignOut = useCallback(async () => {
    if (!auth) {
      return;
    }
    await auth.logout();
    router.replace('/login');
  }, [auth, router]);

  return (
    <ScreenContainer>
      <ScrollView contentContainerClassName="px-4 py-4 pb-12">
        <Section title="Account">
          <Row label="Signed in as" value={user?.email ?? '—'} />
          <Row label="Display name" value={user?.displayName ?? '—'} />
          <Row label="Email verified" value={user?.emailVerified ? 'Yes' : 'No'} />
        </Section>

        <Section title="Security">
          <Row label="Auto-lock timeout" value="5 minutes (background)" />
          <Row label="Biometric available" value={biometric?.capability ?? 'checking…'} />
          <Row label="Biometric type" value={biometric?.displayName ?? '—'} />
          <Text className="mt-2 text-[12px] leading-5 text-grey-fg">
            When the app spends more than 5 minutes off the foreground, the master key
            is dropped from memory and you sign in again on next launch.
          </Text>
        </Section>

        <Section title="Sync">
          <Text className="text-[12px] leading-5 text-grey-fg">
            Pull-only in v1. Edits to host / provider / MCP / skill records happen on
            the desktop client and propagate here after the next pull.
          </Text>
        </Section>

        <Section title="About">
          <Row label="Client" value="termlnk-mobile" />
          <Row label="Version" value="0.0.1" />
          <Row label="SSH backend" value="Rust russh 0.54 + russh-sftp 2 (uniffi-bindgen-react-native)" />
        </Section>

        <Pressable
          onPress={onSignOut}
          className="mt-4 items-center rounded-lg bg-one-bg py-3 active:bg-one-bg2"
        >
          <Text className="text-[14px] font-semibold text-red">Sign out</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-grey-fg">
        {title}
      </Text>
      <View className="rounded-xl bg-one-bg p-3">{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-[13px] text-grey-fg">{label}</Text>
      <Text
        numberOfLines={1}
        className="ml-3 max-w-[65%] text-right text-[13px] font-medium text-light-grey"
      >
        {value}
      </Text>
    </View>
  );
}
