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

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useObservable, useSshKeyRepository } from '../../src/core/core-context';
import { DangerButton, FormSection, PasswordField, SwitchField, TextField } from '../../src/ui/form';
import { RoundButton } from '../../src/ui/round-button';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';

export default function KeyEditRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const keyRepo = useSshKeyRepository();
  const keys = useObservable(keyRepo.keys$, []);
  const existing = keys.find((k) => k.id === id);

  const [label, setLabel] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [savePassphrase, setSavePassphrase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    void keyRepo.getInfo(id).then((info) => {
      if (cancelled) {
        return;
      }
      if (info) {
        setLabel(info.label);
        setSavePassphrase(info.savePassphrase);
        setPassphrase(info.passphrase ?? '');
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, keyRepo]);

  const confirmDisabled = useMemo(
    () => !label.trim() || !loaded,
    [label, loaded]
  );

  async function onSave() {
    if (!label.trim() || !id) {
      return;
    }
    setBusy(true);
    try {
      const info = await keyRepo.getInfo(id);
      if (info) {
        await keyRepo.updateKey({
          id,
          label: label.trim(),
          privateKey: info.privateKey,
          publicKey: info.publicKey,
          passphrase: passphrase || null,
          savePassphrase,
        });
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
    Alert.alert('Delete', `Delete key "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void keyRepo.deleteKey(id).then(() => router.back()) },
    ]);
  }

  if (!id) {
    return null;
  }

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="nav"
        title="Edit Key"
        onBack={() => router.back()}
        right={<RoundButton icon={Check} variant="accent" onPress={onSave} disabled={confirmDisabled || busy} accessibilityLabel="Save" />}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <FormSection>
            <TextField label="Label" value={label} onChangeText={setLabel} placeholder="Key name" autoCapitalize="none" />
            {existing && (
              <View className="px-4 py-2.5">
                <Text className="mb-1 text-[12px] font-medium uppercase tracking-wide text-content-tertiary">
                  Algorithm
                </Text>
                <Text className="text-[15px] leading-[20px] text-content">
                  {existing.algorithm.toUpperCase()}
                  {existing.bits ? ` ${existing.bits}` : ''}
                </Text>
              </View>
            )}
          </FormSection>

          {existing?.publicKeyFingerprint != null && (
            <FormSection title="Fingerprint">
              <View className="px-4 py-3">
                <Text className="text-[13px] text-content-secondary" selectable>{existing.publicKeyFingerprint}</Text>
              </View>
            </FormSection>
          )}

          <FormSection>
            <PasswordField label="Passphrase" value={passphrase} onChangeText={setPassphrase} placeholder="Passphrase" />
            <SwitchField label="Save passphrase" value={savePassphrase} onValueChange={setSavePassphrase} last />
          </FormSection>

          <View className="mt-6 gap-3 px-4">
            <DangerButton title="Delete" onPress={onDelete} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
