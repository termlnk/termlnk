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

import type { IMobileCredential, IMobileCredentialType, IMobileHostFull, IMobileHostSettings, IMobileProxy } from '@termlnk/database-mobile';
import { generateRandomId } from '@termlnk/core';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useHostRepository, useIdentityRepository, useObservable, useSshKeyRepository } from '../../core/core-context';
import { takePendingGroupSelection } from '../../lib/group-selection';
import { takePendingKeychainSelection } from '../../lib/keychain-selection';
import { Card } from '../ui/card';
import { DangerButton, FieldRow, InlineField, SegmentedField, SwitchField, TextField } from '../ui/form';
import { RoundButton } from '../ui/round-button';
import { NavRow, SwitchRow } from '../ui/rows';

interface IHostEditScreenProps {
  readonly hostId?: string;
  readonly parentId?: string;
  readonly kind: 'host' | 'group';
  readonly prefillAddr?: string;
  readonly prefillUsername?: string;
  readonly prefillPort?: string;
}

const CRED_OPTIONS: { label: string; value: IMobileCredentialType }[] = [
  { label: 'Password', value: 'password' },
  { label: 'Key', value: 'key' },
  { label: 'Identity', value: 'identity' },
  { label: 'Private key', value: 'rsa' },
  { label: 'None', value: 'always' },
];

const PROXY_OPTIONS = [
  { label: 'SOCKS5', value: 'socks5' as const },
  { label: 'HTTP', value: 'http' as const },
];

export function HostEditScreen({ hostId, parentId, kind, prefillAddr, prefillUsername, prefillPort }: IHostEditScreenProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const hostRepo = useHostRepository();
  const keyRepo = useSshKeyRepository();
  const identityRepo = useIdentityRepository();
  const keys = useObservable(keyRepo.keys$, []);
  const identities = useObservable(identityRepo.identities$, []);
  const hosts = useObservable(hostRepo.hosts$, []);

  const isEdit = hostId != null;

  useEffect(() => {
    navigation.setOptions({
      sheetAllowedDetents: kind === 'group' ? [0.5, 0.75] : [0.7, 0.95],
      sheetInitialDetentIndex: kind === 'group' ? 0 : 1,
    });
  }, [navigation, kind]);

  const [label, setLabel] = useState('');
  const [addr, setAddr] = useState(prefillAddr ?? '');
  const [port, setPort] = useState(prefillPort != null && prefillPort.length > 0 ? prefillPort : '22');
  const [parentPid, setParentPid] = useState(parentId ?? 'root');
  const [credType, setCredType] = useState<IMobileCredentialType>('password');
  const [username, setUsername] = useState(prefillUsername != null && prefillUsername.length > 0 ? prefillUsername : 'root');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [keyId, setKeyId] = useState('');
  const [identityId, setIdentityId] = useState('');

  const [useSsh, setUseSsh] = useState(true);
  const [useTelnet, setUseTelnet] = useState(false);

  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyType, setProxyType] = useState<'socks5' | 'http'>('socks5');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('1080');

  const [loadedSettings, setLoadedSettings] = useState<IMobileHostSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hostId == null) {
      return;
    }
    let cancelled = false;
    void hostRepo.getInfo(hostId).then((full) => {
      if (cancelled || full == null) {
        return;
      }
      setLabel(full.label);
      setAddr(full.addr ?? '');
      setPort(String(full.port ?? 22));
      setParentPid(full.pid);
      const cred = full.credential;
      if (cred != null) {
        setCredType(cred.type);
        if (cred.type !== 'identity') {
          setUsername(cred.username);
        }
        if (cred.type === 'password') {
          setPassword(cred.password);
        }
        if (cred.type === 'rsa') {
          setPrivateKey(cred.privateKey);
        }
        if (cred.type === 'key') {
          setKeyId(cred.keyId);
        }
        if (cred.type === 'identity') {
          setIdentityId(cred.identityId);
        }
      }
      if (full.proxy?.enabled) {
        setProxyEnabled(true);
        setProxyType(full.proxy.type ?? 'socks5');
        setProxyHost(full.proxy.host ?? '');
        setProxyPort(String(full.proxy.port ?? 1080));
      }
      const settings = full.settings ?? null;
      setLoadedSettings(settings);
      setUseSsh(settings?.useSsh ?? true);
      setUseTelnet(settings?.useTelnet ?? false);
    });
    return () => {
      cancelled = true;
    };
  }, [hostId, hostRepo]);

  useFocusEffect(
    useCallback(() => {
      const groupSelection = takePendingGroupSelection();
      if (groupSelection != null) {
        setParentPid(groupSelection.pid);
      }
      const keychainSelection = takePendingKeychainSelection('host-edit');
      if (keychainSelection != null) {
        if (keychainSelection.type === 'key') {
          setKeyId(keychainSelection.id);
        } else {
          setIdentityId(keychainSelection.id);
        }
      }
    }, [])
  );

  const selectedKeyLabel = useMemo(() => keys.find((k) => k.id === keyId)?.label ?? '', [keys, keyId]);
  const selectedIdentityLabel = useMemo(() => identities.find((i) => i.id === identityId)?.label ?? '', [identities, identityId]);
  const parentLabel = parentPid === 'root' ? 'None' : hosts.find((h) => h.id === parentPid)?.label ?? 'None';

  const confirmDisabled = kind === 'host' ? addr.trim().length === 0 : label.trim().length === 0;

  function buildCredential(): IMobileCredential | null {
    switch (credType) {
      case 'password':
        return { type: 'password', username, password };
      case 'rsa':
        return { type: 'rsa', username, privateKey };
      case 'key':
        return keyId ? { type: 'key', username, keyId } : null;
      case 'identity':
        return identityId ? { type: 'identity', identityId } : null;
      case 'always':
        return { type: 'always', username };
    }
  }

  async function onSave() {
    const finalLabel = label.trim().length > 0 ? label.trim() : (kind === 'host' ? addr.trim() : '');
    if (kind === 'group' && finalLabel.length === 0) {
      Alert.alert('Name required', 'Please enter a group name.');
      return;
    }
    if (kind === 'host' && addr.trim().length === 0) {
      Alert.alert('Address required', 'Please enter an IP or hostname.');
      return;
    }
    const portNum = Number.parseInt(port, 10);
    if (kind === 'host' && (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535)) {
      Alert.alert('Invalid port', 'Port must be between 1 and 65535.');
      return;
    }
    if (kind === 'host' && credType === 'key' && !keyId) {
      Alert.alert('Key required', 'Select an SSH key, or pick a different authentication method.');
      return;
    }
    if (kind === 'host' && credType === 'identity' && !identityId) {
      Alert.alert('Identity required', 'Select an identity, or pick a different authentication method.');
      return;
    }

    setBusy(true);
    try {
      const id = hostId ?? generateRandomId(24);
      if (kind === 'group') {
        const settings: IMobileHostSettings = { ...loadedSettings, useSsh, useTelnet };
        await hostRepo.saveHost({
          id,
          pid: parentPid,
          label: finalLabel,
          type: 'group',
          hasCredential: false,
          credential: null,
          proxy: null,
          settings,
        }, { isNew: !isEdit });
      } else {
        const credential = buildCredential();
        const proxy: IMobileProxy | null = proxyEnabled
          ? { enabled: true, type: proxyType, host: proxyHost.trim(), port: Number.parseInt(proxyPort, 10) || 1080 }
          : null;
        const settings: IMobileHostSettings = { ...loadedSettings, useSsh };
        const full: IMobileHostFull = {
          id,
          pid: parentPid,
          label: finalLabel,
          type: 'host',
          addr: addr.trim(),
          port: portNum,
          hasCredential: credential != null && credential.type !== 'always',
          credential,
          proxy,
          settings,
        };
        await hostRepo.saveHost(full, { isNew: !isEdit });
      }
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
    } finally {
      setBusy(false);
    }
  }

  function onDelete() {
    if (hostId == null) {
      return;
    }
    Alert.alert('Delete', `Delete "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void hostRepo.removeHost(hostId).then(() => router.back());
        },
      },
    ]);
  }

  const openParentPicker = () => {
    router.push({
      pathname: '/group-picker',
      params: { selectedPid: parentPid, ...(kind === 'group' && hostId != null ? { excludeId: hostId } : {}) },
    });
  };

  const title = isEdit
    ? (kind === 'group' ? 'Edit Group' : 'Edit Host')
    : (kind === 'group' ? 'New Group' : 'New Host');

  const HEADER_HEIGHT = 60;

  const header = (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, height: HEADER_HEIGHT }}
      className="flex-row items-center justify-between bg-surface px-4 pb-2 pt-4"
    >
      <RoundButton icon={X} onPress={() => router.back()} accessibilityLabel="Close" />
      <Text className="text-[16px] font-semibold text-content">{title}</Text>
      <RoundButton
        icon={Check}
        variant="accent"
        onPress={() => void onSave()}
        disabled={confirmDisabled || busy}
        accessibilityLabel="Save"
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {header}
      {kind === 'host'
        ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: HEADER_HEIGHT, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
          >
            <Card dividerInset={16}>
              <InlineField label="Label" value={label} onChangeText={setLabel} placeholder="Optional" autoCapitalize="words" />
              <InlineField label="IP or Hostname" value={addr} onChangeText={setAddr} placeholder="Required" keyboardType="url" />
              <NavRow title="Parent Group" value={parentLabel} chevronTone="accent" onPress={openParentPicker} />
            </Card>

            <SectionLabel title="SSH" />
            <View
              className="overflow-hidden rounded-2xl bg-surface-raised"
              style={{
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 3 },
              }}
            >
              <SwitchRow title="Use SSH" value={useSsh} onValueChange={setUseSsh} />
              <GroupedDivider />
              <InlineField
                label="Port"
                value={port}
                onChangeText={setPort}
                placeholder="22"
                keyboardType="numeric"
                trailing={<Text className="text-[13px] text-content-secondary">Default</Text>}
              />
              <View className="h-3 bg-surface" />
              <View className="px-4 pb-2 pt-4">
                <Text className="text-[20px] font-semibold text-content">Credentials</Text>
              </View>
              <SegmentedField label="Method" value={credType} options={CRED_OPTIONS} onChange={setCredType} />
              {credType !== 'identity' && (
                <FieldRow last={credType === 'always'}>
                  <InlineField label="Username" value={username} onChangeText={setUsername} placeholder="root" />
                </FieldRow>
              )}
              {credType === 'password' && (
                <FieldRow last>
                  <InlineField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
                </FieldRow>
              )}
              {credType === 'rsa' && (
                <TextField label="Private key (PEM)" value={privateKey} onChangeText={setPrivateKey} multiline last />
              )}
              {credType === 'key' && (
                <NavRow
                  title="Key"
                  value={selectedKeyLabel || 'Select'}
                  chevronTone="accent"
                  onPress={() => router.push({ pathname: '/keychain-picker', params: { type: 'key', selectedId: keyId, sourceRoute: 'host-edit' } })}
                />
              )}
              {credType === 'identity' && (
                <NavRow
                  title="Identity"
                  value={selectedIdentityLabel || 'Select'}
                  chevronTone="accent"
                  onPress={() => router.push({ pathname: '/keychain-picker', params: { type: 'identity', selectedId: identityId, sourceRoute: 'host-edit' } })}
                />
              )}
              <View className="h-3 bg-surface" />
              <View className="px-4 pb-2 pt-4">
                <Text className="text-[20px] font-semibold text-content">Proxy</Text>
              </View>
              <SwitchField label="Use proxy" value={proxyEnabled} onValueChange={setProxyEnabled} last={!proxyEnabled} />
              {proxyEnabled && (
                <>
                  <SegmentedField label="Type" value={proxyType} options={PROXY_OPTIONS} onChange={setProxyType} />
                  <FieldRow>
                    <InlineField label="Host" value={proxyHost} onChangeText={setProxyHost} placeholder="proxy.example.com" keyboardType="url" />
                  </FieldRow>
                  <FieldRow last>
                    <InlineField label="Port" value={proxyPort} onChangeText={setProxyPort} keyboardType="numeric" />
                  </FieldRow>
                </>
              )}
            </View>

            {isEdit && (
              <View className="mt-6">
                <DangerButton title="Delete" onPress={onDelete} />
              </View>
            )}
          </ScrollView>
        )
        : (
          <View style={{ flex: 1, paddingTop: HEADER_HEIGHT }} className="px-4 pt-8">
            <Card dividerInset={16}>
              <InlineField label="Name" value={label} onChangeText={setLabel} placeholder="Required" autoCapitalize="words" />
              <NavRow title="Parent Group" value={parentLabel} chevronTone="accent" onPress={openParentPicker} />
            </Card>
            {isEdit && (
              <View className="mt-6">
                <DangerButton title="Delete" onPress={onDelete} />
              </View>
            )}
          </View>
        )}
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text className="px-4 pb-2 pt-5 text-[12px] font-semibold uppercase tracking-wider text-content-tertiary">{title}</Text>
  );
}

function GroupedDivider() {
  return <View className="ml-4 h-px bg-divider" />;
}
