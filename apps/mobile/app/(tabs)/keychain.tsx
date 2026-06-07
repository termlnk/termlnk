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
import { ChevronRight, KeyRound, Plus, ShieldCheck, UserRound } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useIdentityRepository, useKnownHostRepository, useObservable, useSshKeyRepository } from '../../src/core/core-context';
import { ScreenContainer } from '../../src/ui/screen-container';

export default function KeychainTab() {
  const router = useRouter();
  const keyRepo = useSshKeyRepository();
  const identityRepo = useIdentityRepository();
  const knownHostRepo = useKnownHostRepository();

  const keys = useObservable(keyRepo.keys$, []);
  const identities = useObservable(identityRepo.identities$, []);
  const knownHosts = useObservable(knownHostRepo.knownHosts$, []);

  useEffect(() => {
    void keyRepo.ready();
    void identityRepo.ready();
    void knownHostRepo.ready();
  }, [keyRepo, identityRepo, knownHostRepo]);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SectionHeader title="SSH Keys" count={keys.length} onAdd={() => router.push('/keychain/key')} />
        <Card>
          {keys.length === 0
            ? <EmptyRow text="No keys. Tap + to generate or import one." />
            : keys.map((k, i) => (
              <Row
                key={k.id}
                icon={<KeyRound size={18} color="#81a1c1" />}
                title={k.label}
                subtitle={`${k.algorithm.toUpperCase()}${k.bits ? ` ${k.bits}` : ''}${k.source === 'generated' ? ' · generated' : ''}`}
                last={i === keys.length - 1}
                onPress={() => router.push({ pathname: '/keychain/key', params: { id: k.id } })}
              />
            ))}
        </Card>

        <SectionHeader title="Identities" count={identities.length} onAdd={() => router.push('/keychain/identity')} />
        <Card>
          {identities.length === 0
            ? <EmptyRow text="No identities. Tap + to add a reusable username + secret." />
            : identities.map((idn, i) => (
              <Row
                key={idn.id}
                icon={<UserRound size={18} color="#98c379" />}
                title={idn.label}
                subtitle={idn.username + (idn.keyId ? ' · key' : idn.hasPassword ? ' · password' : '')}
                last={i === identities.length - 1}
                onPress={() => router.push({ pathname: '/keychain/identity', params: { id: idn.id } })}
              />
            ))}
        </Card>

        <SectionHeader title="Known Hosts" count={knownHosts.length} />
        <Card>
          {knownHosts.length === 0
            ? <EmptyRow text="Server fingerprints you've trusted appear here." />
            : knownHosts.map((kh, i) => (
              <Row
                key={kh.id}
                icon={<ShieldCheck size={18} color="#e5c07b" />}
                title={`${kh.host}:${kh.port}`}
                subtitle={`${kh.keyType} · ${kh.fingerprint.slice(0, 24)}…`}
                last={i === knownHosts.length - 1}
                onPress={() => knownHostRepo.deleteKnownHost(kh.id)}
              />
            ))}
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

function SectionHeader({ title, count, onAdd }: { title: string; count: number; onAdd?: () => void }) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-2 pt-5">
      <View className="flex-row items-baseline">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-grey-fg">{title}</Text>
        <Text className="ml-2 text-[11px] text-grey">{count}</Text>
      </View>
      {onAdd != null && (
        <Pressable onPress={onAdd} hitSlop={10} className="h-7 w-7 items-center justify-center rounded-full bg-one-bg2 active:bg-one-bg3">
          <Plus size={16} color="#61afef" />
        </Pressable>
      )}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View className="mx-4 overflow-hidden rounded-xl border border-line bg-one-bg">{children}</View>;
}

function Row({ icon, title, subtitle, onPress, last }: { icon: React.ReactNode; title: string; subtitle?: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} className={`flex-row items-center px-4 py-3 active:bg-one-bg2 ${last ? '' : 'border-b border-line'}`}>
      <View className="mr-3">{icon}</View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-[15px] font-medium text-light-grey">{title}</Text>
        {subtitle != null && <Text numberOfLines={1} className="mt-0.5 text-[12px] text-grey-fg2">{subtitle}</Text>}
      </View>
      <ChevronRight size={18} color="#42464e" />
    </Pressable>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <View className="px-4 py-4">
      <Text className="text-[13px] text-grey-fg">{text}</Text>
    </View>
  );
}
