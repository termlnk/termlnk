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

import type { ISshKeyAlgorithm } from '@termlnk/database-mobile';
import { RnRussh } from '@termlnk/react-native-russh';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useObservable, useSshKeyRepository } from '../../src/core/core-context';
import { DangerButton, FormSection, PrimaryButton, SegmentedField, SwitchField, TextField } from '../../src/ui/form';
import { ScreenContainer } from '../../src/ui/screen-container';

const ALGO_OPTIONS: { label: string; value: ISshKeyAlgorithm }[] = [
  { label: 'ED25519', value: 'ed25519' },
  { label: 'ECDSA', value: 'ecdsa' },
  { label: 'RSA', value: 'rsa' },
];

const MODE_OPTIONS = [
  { label: 'Generate', value: 'generate' as const },
  { label: 'Import', value: 'import' as const },
];

export default function KeyEditRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const keyRepo = useSshKeyRepository();
  const keys = useObservable(keyRepo.keys$, []);
  const isEdit = id != null;
  const existing = keys.find((k) => k.id === id);

  const [mode, setMode] = useState<'generate' | 'import'>('generate');
  const [label, setLabel] = useState('');
  const [algorithm, setAlgorithm] = useState<ISshKeyAlgorithm>('ed25519');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [savePassphrase, setSavePassphrase] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing) {
      setLabel(existing.label);
      setAlgorithm(existing.algorithm);
    }
  }, [existing]);

  async function onSave() {
    if (!label.trim()) {
      Alert.alert('Name required', 'Please name this key.');
      return;
    }
    setBusy(true);
    try {
      if (isEdit) {
        // Editing currently supports relabel only — private material stays put. Re-import to
        // replace the key bytes.
        const info = await keyRepo.getInfo(id);
        if (info) {
          await keyRepo.updateKey({ id, label: label.trim(), privateKey: info.privateKey, publicKey: info.publicKey, savePassphrase: info.savePassphrase });
        }
        router.back();
        return;
      }
      if (mode === 'generate') {
        await RnRussh.uniffiInitAsync();
        const pem = RnRussh.generateKeyPair(algorithm);
        await keyRepo.importKey({ label: label.trim(), algorithm, privateKey: pem, savePassphrase: false, source: 'generated' });
      } else {
        if (!privateKey.trim()) {
          Alert.alert('Private key required', 'Paste a private key in PEM/OpenSSH format.');
          setBusy(false);
          return;
        }
        const check = RnRussh.validatePrivateKey(privateKey.trim());
        if (!check.valid) {
          Alert.alert('Invalid key', check.error.message ?? 'The private key could not be parsed.');
          setBusy(false);
          return;
        }
        await keyRepo.importKey({
          label: label.trim(),
          algorithm,
          privateKey: privateKey.trim(),
          passphrase: passphrase || undefined,
          savePassphrase,
          source: 'imported',
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

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: isEdit ? 'Edit Key' : 'New Key', headerShown: true }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {!isEdit && (
            <FormSection>
              <SegmentedField label="Source" value={mode} options={MODE_OPTIONS} onChange={setMode} last />
            </FormSection>
          )}

          <FormSection title="Key">
            <TextField label="Name" value={label} onChangeText={setLabel} placeholder="id_ed25519" autoCapitalize="none" />
            <SegmentedField label="Algorithm" value={algorithm} options={ALGO_OPTIONS} onChange={setAlgorithm} last={isEdit || mode === 'generate'} />
            {!isEdit && mode === 'import' && (
              <>
                <TextField label="Private key" value={privateKey} onChangeText={setPrivateKey} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" multiline />
                <TextField label="Passphrase" value={passphrase} onChangeText={setPassphrase} secureTextEntry />
                <SwitchField label="Save passphrase" value={savePassphrase} onValueChange={setSavePassphrase} last />
              </>
            )}
          </FormSection>

          {isEdit && existing?.publicKeyFingerprint != null && (
            <FormSection title="Fingerprint">
              <View className="px-4 py-3">
                <Text className="text-[13px] text-content-secondary" selectable>{existing.publicKeyFingerprint}</Text>
              </View>
            </FormSection>
          )}

          <View className="mt-6 gap-3 px-4">
            <PrimaryButton title={isEdit ? 'Save' : (mode === 'generate' ? 'Generate' : 'Import')} onPress={onSave} busy={busy} />
            {isEdit && <DangerButton title="Delete" onPress={onDelete} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
