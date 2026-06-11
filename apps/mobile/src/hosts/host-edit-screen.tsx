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
import { DEFAULT_PREFERENCES } from '@termlnk/database-mobile';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Check, Sparkles, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useHostRepository, useIdentityRepository, useObservable, usePreferencesService, useSshKeyRepository } from '../core/core-context';
import { useThemeColors } from '../theme/theme-provider';
import { Card } from '../ui/card';
import { DangerButton, FormSection, InlineField, SegmentedField, SwitchField, TextField } from '../ui/form';
import { ModalHeaderButton } from '../ui/modal-header-button';
import { NavRow, SwitchRow } from '../ui/rows';
import { ScreenContainer } from '../ui/screen-container';
import { takePendingGroupSelection } from './group-selection';

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
  { label: 'Paste key', value: 'rsa' },
  { label: 'None', value: 'always' },
];

const PROXY_OPTIONS = [
  { label: 'SOCKS5', value: 'socks5' as const },
  { label: 'HTTP', value: 'http' as const },
];

// Create / edit form for a host or a group, laid out as a Termius modal. Persists
// through MobileHostRepository.saveHost, which queues the change for the sync engine.
export function HostEditScreen({ hostId, parentId, kind, prefillAddr, prefillUsername, prefillPort }: IHostEditScreenProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const hostRepo = useHostRepository();
  const keyRepo = useSshKeyRepository();
  const identityRepo = useIdentityRepository();
  const prefsService = usePreferencesService();
  const keys = useObservable(keyRepo.keys$, []);
  const identities = useObservable(identityRepo.identities$, []);
  const hosts = useObservable(hostRepo.hosts$, []);
  const prefs = useObservable(prefsService.prefs$, DEFAULT_PREFERENCES);

  const isEdit = hostId != null;

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
  const [useMosh, setUseMosh] = useState(false);
  const [useTelnet, setUseTelnet] = useState(false);
  const [backspaceAsCtrlH, setBackspaceAsCtrlH] = useState(false);

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
      setUseMosh(settings?.useMosh ?? false);
      setUseTelnet(settings?.useTelnet ?? false);
      setBackspaceAsCtrlH(settings?.backspaceAsCtrlH ?? false);
    });
    return () => {
      cancelled = true;
    };
  }, [hostId, hostRepo]);

  // Pick up a Parent Group chosen on the picker screen when we regain focus.
  useFocusEffect(
    useCallback(() => {
      const selection = takePendingGroupSelection();
      if (selection != null) {
        setParentPid(selection.pid);
      }
    }, [])
  );

  const keyOptions = useMemo(() => keys.map((k) => ({ label: k.label, value: k.id })), [keys]);
  const identityOptions = useMemo(() => identities.map((i) => ({ label: i.label, value: i.id })), [identities]);
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
        const settings: IMobileHostSettings = { ...loadedSettings, useSsh, useMosh, backspaceAsCtrlH };
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

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          title,
          headerLeft: () => (
            <ModalHeaderButton
              icon={X}
              onPress={() => router.back()}
              accessibilityLabel="Close"
            />
          ),
          headerRight: () => (
            <ModalHeaderButton
              icon={Check}
              variant="accent"
              onPress={() => void onSave()}
              disabled={confirmDisabled}
              loading={busy}
              accessibilityLabel="Save"
            />
          ),
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        {kind === 'host'
          ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 }}
              keyboardShouldPersistTaps="handled"
            >
              <Card dividerInset={16}>
                <InlineField value={label} onChangeText={setLabel} placeholder="Label" autoCapitalize="words" />
                <InlineField label="IP or Hostname" value={addr} onChangeText={setAddr} placeholder="Required" keyboardType="url" />
                <NavRow title="Parent Group" value={parentLabel} chevronTone="accent" onPress={openParentPicker} />
                <NavRow title="Tags" value="None" chevronTone="accent" onPress={() => Alert.alert('Tags', 'Tagging is coming soon.')} />
                <SwitchRow title="Backspace as CTRL+H" value={backspaceAsCtrlH} onValueChange={setBackspaceAsCtrlH} />
              </Card>

              {!prefs.aiAgentCardDismissed && (
                <>
                  <SectionLabel title="AI Agent" />
                  <Card>
                    <Pressable onPress={() => router.push('/ai')} className="flex-row items-start p-4 active:bg-surface-sunken">
                      <View className="mr-3 mt-0.5"><Sparkles size={20} color={colors.accent} /></View>
                      <View className="flex-1">
                        <Text className="text-[16px] font-semibold text-content">Set up this host for AI code assistants</Text>
                        <Text className="mt-1 text-[14px] text-content-secondary">Claude Code, Gemini, OpenCode, etc.</Text>
                      </View>
                      <Pressable onPress={() => void prefsService.update({ aiAgentCardDismissed: true })} hitSlop={10} className="ml-2 active:opacity-60">
                        <X size={18} color={colors.contentTertiary} />
                      </Pressable>
                    </Pressable>
                  </Card>
                </>
              )}

              <SectionLabel title="SSH / MOSH" />
              <View
                className="mx-4 overflow-hidden rounded-2xl bg-surface-raised"
                style={{
                  shadowColor: '#000',
                  shadowOpacity: 0.05,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 3 },
                }}
              >
                <SwitchRow title="Use SSH" value={useSsh} onValueChange={setUseSsh} />
                <GroupedDivider />
                <SwitchRow title="Use Mosh" value={useMosh} onValueChange={setUseMosh} />
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
              </View>

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

              {isEdit && (
                <View className="mt-6">
                  <DangerButton title="Delete" onPress={onDelete} />
                </View>
              )}
            </ScrollView>
          )
          : (
            <View className="flex-1 px-4 pt-24">
              <Card dividerInset={16}>
                <TextField label="Name" value={label} onChangeText={setLabel} placeholder="Name" autoCapitalize="words" />
                <NavRow title="Parent Group" value={parentLabel} chevronTone="accent" onPress={openParentPicker} />
              </Card>
              {isEdit && (
                <View className="mt-6">
                  <DangerButton title="Delete" onPress={onDelete} />
                </View>
              )}
            </View>
          )}
      </KeyboardAvoidingView>
    </ScreenContainer>
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
