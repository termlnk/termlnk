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
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useIdentityRepository, useObservable, useSshKeyRepository } from '../../src/core/core-context';
import { DangerButton, FormSection, PrimaryButton, SegmentedField, TextField } from '../../src/ui/form';
import { ScreenContainer } from '../../src/ui/screen-container';

export default function IdentityEditRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const identityRepo = useIdentityRepository();
  const keyRepo = useSshKeyRepository();
  const keys = useObservable(keyRepo.keys$, []);
  const isEdit = id != null;

  const [label, setLabel] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keyId, setKeyId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    void identityRepo.getInfo(id).then((info) => {
      if (cancelled || !info) {
        return;
      }
      setLabel(info.label);
      setUsername(info.username);
      setKeyId(info.keyId ?? '');
      setPassword(info.password ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [id, identityRepo]);

  const keyOptions = useMemo(
    () => [{ label: 'None', value: '' }, ...keys.map((k) => ({ label: k.label, value: k.id }))],
    [keys]
  );

  async function onSave() {
    if (!label.trim() || !username.trim()) {
      Alert.alert('Required', 'Name and username are required.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        label: label.trim(),
        username: username.trim(),
        password: password || undefined,
        keyId: keyId || null,
      };
      if (isEdit) {
        await identityRepo.updateIdentity({ id, ...payload });
      } else {
        await identityRepo.createIdentity(payload);
      }
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
    } finally {
      setBusy(false);
    }
  }

  function onDelete() {
    if (!id) {
      return;
    }
    Alert.alert('Delete', `Delete identity "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void identityRepo.deleteIdentity(id).then(() => router.back()) },
    ]);
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: isEdit ? 'Edit Identity' : 'New Identity', headerShown: true }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <FormSection title="Identity" footer="A reusable username plus an optional password and/or key, referenced by hosts.">
            <TextField label="Name" value={label} onChangeText={setLabel} placeholder="Production" autoCapitalize="words" />
            <TextField label="Username" value={username} onChangeText={setUsername} placeholder="root" />
            <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry last={keyOptions.length <= 1} />
            {keyOptions.length > 1 && (
              <SegmentedField label="Key" value={keyId} options={keyOptions} onChange={setKeyId} last />
            )}
          </FormSection>
          <View className="mt-6 gap-3 px-4">
            <PrimaryButton title={isEdit ? 'Save' : 'Create'} onPress={onSave} busy={busy} />
            {isEdit && <DangerButton title="Delete" onPress={onDelete} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
