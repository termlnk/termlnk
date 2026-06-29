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

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { DangerButton, FormSection, NavField, PasswordField, TextField } from '../../components/ui/form';
import { RoundButton } from '../../components/ui/round-button';
import { ScreenContainer } from '../../components/ui/screen-container';
import { ScreenHeader } from '../../components/ui/screen-header';
import { useIdentityRepository, useObservable, useSshKeyRepository } from '../../core/core-context';
import { takePendingKeychainSelection } from '../../lib/keychain-selection';

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
  const [keyLabel, setKeyLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    void identityRepo.getInfo(id).then((info) => {
      if (cancelled) {
        return;
      }
      if (info) {
        setLabel(info.label);
        setUsername(info.username);
        setKeyId(info.keyId ?? '');
        setPassword(info.password ?? '');
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, identityRepo]);

  useEffect(() => {
    if (keyId) {
      const found = keys.find((k) => k.id === keyId);
      if (found) {
        setKeyLabel(found.label);
      }
    } else {
      setKeyLabel('');
    }
  }, [keyId, keys]);

  useFocusEffect(
    useCallback(() => {
      const selection = takePendingKeychainSelection('identity-edit');
      if (selection != null && selection.type === 'key') {
        setKeyId(selection.id);
        setKeyLabel(selection.label);
      }
    }, [])
  );

  const confirmDisabled = useMemo(
    () => !label.trim() || !username.trim() || !loaded,
    [label, username, loaded]
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

  const onPickKey = useCallback(() => {
    router.push({
      pathname: '/keychain-picker',
      params: { type: 'key', selectedId: keyId, sourceRoute: 'identity-edit' },
    });
  }, [router, keyId]);

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="nav"
        title={isEdit ? 'Edit Identity' : 'New Identity'}
        onBack={() => router.back()}
        right={<RoundButton icon={Check} variant="accent" onPress={onSave} disabled={confirmDisabled || busy} accessibilityLabel="Save" />}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <FormSection>
            <TextField label="Name" value={label} onChangeText={setLabel} placeholder="Name" autoCapitalize="words" />
            <TextField label="Username" value={username} onChangeText={setUsername} placeholder="Required" />
            <PasswordField label="Password" value={password} onChangeText={setPassword} placeholder="Password" />
            <NavField label="Key" value={keyLabel || ''} onPress={onPickKey} last />
          </FormSection>

          {isEdit && (
            <View className="mt-6 gap-3 px-4">
              <DangerButton title="Delete" onPress={onDelete} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
