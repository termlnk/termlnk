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

import type { IMobileCredential, IMobileCredentialType, IMobileHostFull, IMobileProxy } from '../storage/types';
import { generateRandomId } from '@termlnk/core';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useHostRepository, useIdentityRepository, useObservable, useSshKeyRepository } from '../core/core-context';
import { DangerButton, FormSection, PrimaryButton, SegmentedField, SwitchField, TextField } from '../ui/form';
import { ScreenContainer } from '../ui/screen-container';

interface IHostEditScreenProps {
  readonly hostId?: string;
  readonly parentId?: string;
  readonly kind: 'host' | 'group';
}

const CRED_OPTIONS: { label: string; value: IMobileCredentialType }[] = [
  { label: 'Password', value: 'password' },
  { label: 'Key', value: 'key' },
  { label: 'Identity', value: 'identity' },
  { label: 'Paste key', value: 'rsa' },
  { label: 'None', value: 'always' },
];

const PROXY_OPTIONS = [
  { label: 'SOCKS5', value: 'socks5' as const },
  { label: 'HTTP', value: 'http' as const },
];

// Create / edit form for a host or a group. Persists through MobileHostRepository.saveHost,
// which queues the change for the sync engine to push upstream.
export function HostEditScreen({ hostId, parentId, kind }: IHostEditScreenProps) {
  const router = useRouter();
  const hostRepo = useHostRepository();
  const keyRepo = useSshKeyRepository();
  const identityRepo = useIdentityRepository();
  const keys = useObservable(keyRepo.keys$, []);
  const identities = useObservable(identityRepo.identities$, []);

  const isEdit = hostId != null;

  const [label, setLabel] = useState('');
  const [addr, setAddr] = useState('');
  const [port, setPort] = useState('22');
  const [credType, setCredType] = useState<IMobileCredentialType>('password');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [keyId, setKeyId] = useState('');
  const [identityId, setIdentityId] = useState('');

  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyType, setProxyType] = useState<'socks5' | 'http'>('socks5');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('1080');

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hostId) {
      return;
    }
    let cancelled = false;
    void hostRepo.getInfo(hostId).then((full) => {
      if (cancelled || !full) {
        return;
      }
      setLabel(full.label);
      setAddr(full.addr ?? '');
      setPort(String(full.port ?? 22));
      const cred = full.credential;
      if (cred) {
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
    });
    return () => {
      cancelled = true;
    };
  }, [hostId, hostRepo]);

  const keyOptions = useMemo(() => keys.map((k) => ({ label: k.label, value: k.id })), [keys]);
  const identityOptions = useMemo(() => identities.map((i) => ({ label: i.label, value: i.id })), [identities]);

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
    if (!label.trim()) {
      Alert.alert('Name required', 'Please enter a name.');
      return;
    }
    if (kind === 'host' && !addr.trim()) {
      Alert.alert('Address required', 'Please enter a host address.');
      return;
    }
    const portNum = Number.parseInt(port, 10);
    if (kind === 'host' && (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535)) {
      Alert.alert('Invalid port', 'Port must be between 1 and 65535.');
      return;
    }

    setBusy(true);
    try {
      const id = hostId ?? generateRandomId(24);
      if (kind === 'group') {
        await hostRepo.saveHost({
          id,
          pid: parentId ?? 'root',
          label: label.trim(),
          type: 'group',
          hasCredential: false,
        }, { isNew: !isEdit });
      } else {
        const credential = buildCredential();
        const proxy: IMobileProxy | null = proxyEnabled
          ? { enabled: true, type: proxyType, host: proxyHost.trim(), port: Number.parseInt(proxyPort, 10) || 1080 }
          : null;
        const full: IMobileHostFull = {
          id,
          pid: parentId ?? 'root',
          label: label.trim(),
          type: 'host',
          addr: addr.trim(),
          port: portNum,
          hasCredential: credential != null && credential.type !== 'always',
          credential,
          proxy,
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
    if (!hostId) {
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

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <FormSection title="General">
            <TextField label="Name" value={label} onChangeText={setLabel} placeholder={kind === 'group' ? 'Group name' : 'My server'} autoCapitalize="words" last={kind === 'group'} />
            {kind === 'host' && (
              <>
                <TextField label="Address" value={addr} onChangeText={setAddr} placeholder="example.com or 10.0.0.1" keyboardType="url" />
                <TextField label="Port" value={port} onChangeText={setPort} placeholder="22" keyboardType="numeric" last />
              </>
            )}
          </FormSection>

          {kind === 'host' && (
            <>
              <FormSection title="Authentication">
                <SegmentedField label="Method" value={credType} options={CRED_OPTIONS} onChange={setCredType} />
                {credType !== 'identity' && (
                  <TextField label="Username" value={username} onChangeText={setUsername} placeholder="root" last={credType === 'always'} />
                )}
                {credType === 'password' && (
                  <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry last />
                )}
                {credType === 'rsa' && (
                  <TextField label="Private key (PEM)" value={privateKey} onChangeText={setPrivateKey} multiline last />
                )}
                {credType === 'key' && (
                  keyOptions.length > 0
                    ? <SegmentedField label="Key" value={keyId} options={keyOptions} onChange={setKeyId} last />
                    : <TextField label="Key" value="" onChangeText={() => {}} placeholder="No keys — add one in Keychain" last />
                )}
                {credType === 'identity' && (
                  identityOptions.length > 0
                    ? <SegmentedField label="Identity" value={identityId} options={identityOptions} onChange={setIdentityId} last />
                    : <TextField label="Identity" value="" onChangeText={() => {}} placeholder="No identities — add one in Keychain" last />
                )}
              </FormSection>

              <FormSection title="Proxy">
                <SwitchField label="Use proxy" value={proxyEnabled} onValueChange={setProxyEnabled} last={!proxyEnabled} />
                {proxyEnabled && (
                  <>
                    <SegmentedField label="Type" value={proxyType} options={PROXY_OPTIONS} onChange={setProxyType} />
                    <TextField label="Host" value={proxyHost} onChangeText={setProxyHost} placeholder="proxy.example.com" keyboardType="url" />
                    <TextField label="Port" value={proxyPort} onChangeText={setProxyPort} keyboardType="numeric" last />
                  </>
                )}
              </FormSection>
            </>
          )}

          <View className="mt-6 gap-3 px-4">
            <PrimaryButton title={isEdit ? 'Save' : 'Create'} onPress={onSave} busy={busy} />
            {isEdit && <DangerButton title="Delete" onPress={onDelete} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
