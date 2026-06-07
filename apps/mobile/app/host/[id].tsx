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

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { FileText, Pencil, Terminal as TerminalIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useHostById } from '../../src/hosts/use-host-tree';
import { HostAvatar } from '../../src/ui/host-avatar';
import { ScreenContainer } from '../../src/ui/screen-container';

export default function HostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const host = useHostById(id);

  if (!host) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Host' }} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-[14px] leading-5 text-red">
            Host not found in current vault snapshot. Pull on the Hosts screen.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          title: host.label,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/host/edit', params: { id: host.id } })}
              hitSlop={12}
            >
              <Pencil size={18} color="#61afef" />
            </Pressable>
          ),
        }}
      />

      <View className="px-4 pt-6">
        <View className="items-center pb-4">
          <HostAvatar id={host.id} label={host.label} type={host.type} size={64} />
          <Text className="mt-3 text-[18px] font-semibold text-light-grey">
            {host.label}
          </Text>
          {host.type !== 'group' && (
            <Text className="mt-1 text-[13px] text-grey-fg">
              {host.addr ?? '—'}
              {host.port != null ? `:${host.port}` : ''}
            </Text>
          )}
        </View>

        <View className="rounded-xl bg-one-bg p-4">
          <DetailRow label="Address" value={host.addr ?? '—'} />
          <DetailRow label="Port" value={String(host.port ?? 22)} />
          <DetailRow label="Type" value={host.type} />
          <DetailRow
            label="Credential"
            value={host.hasCredential ? 'Stored in keystore' : 'Manual entry required'}
          />
        </View>

        <View className="mt-5 gap-3">
          <Pressable
            className="flex-row items-center justify-center rounded-lg bg-blue py-3.5 active:opacity-80"
            onPress={() => router.push({ pathname: '/host/[id]/terminal', params: { id: host.id } })}
          >
            <TerminalIcon size={18} color="#1e222a" />
            <Text className="ml-2 text-[15px] font-semibold text-black">
              Open terminal
            </Text>
          </Pressable>
          <Pressable
            className="flex-row items-center justify-center rounded-lg bg-one-bg2 py-3.5 active:bg-one-bg3"
            onPress={() => router.push({ pathname: '/host/[id]/sftp', params: { id: host.id } })}
          >
            <FileText size={18} color="#6f737b" />
            <Text className="ml-2 text-[15px] font-medium text-light-grey">
              Browse files (SFTP)
            </Text>
          </Pressable>
        </View>

        <Text className="mt-5 text-[12px] leading-[18px] text-grey">
          Hosts and credentials are end-to-end encrypted and sync across your devices.
          Edits made here push back to the cloud vault. Tap Open terminal / Browse files
          to connect — no extra entry needed when a credential is on file.
        </Text>
      </View>
    </ScreenContainer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
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
