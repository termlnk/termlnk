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
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSshKeyRepository } from '../../src/core/core-context';
import { FormSection, PasswordField, TextField } from '../../src/ui/form';
import { RoundButton } from '../../src/ui/round-button';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';

function detectAlgorithm(pem: string): ISshKeyAlgorithm {
  if (pem.includes('BEGIN RSA') || pem.includes('ssh-rsa')) {
    return 'rsa';
  }
  if (pem.includes('BEGIN EC') || pem.includes('ecdsa-')) {
    return 'ecdsa';
  }
  return 'ed25519';
}

export default function NewKeyRoute() {
  const router = useRouter();
  const keyRepo = useSshKeyRepository();

  const [label, setLabel] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [certificate, setCertificate] = useState('');
  const [busy, setBusy] = useState(false);

  const confirmDisabled = useMemo(
    () => !label.trim() || !privateKey.trim(),
    [label, privateKey]
  );

  async function onSave() {
    if (!label.trim()) {
      Alert.alert('Label required', 'Please name this key.');
      return;
    }
    if (!privateKey.trim()) {
      Alert.alert('Private key required', 'Paste a private key in PEM/OpenSSH format.');
      return;
    }
    setBusy(true);
    try {
      const check = RnRussh.validatePrivateKey(privateKey.trim());
      if (!check.valid) {
        Alert.alert('Invalid key', check.error.message ?? 'The private key could not be parsed.');
        setBusy(false);
        return;
      }
      const algorithm = detectAlgorithm(privateKey.trim());
      await keyRepo.importKey({
        label: label.trim(),
        algorithm,
        privateKey: privateKey.trim(),
        publicKey: publicKey.trim() || null,
        certificate: certificate.trim() || null,
        passphrase: passphrase || null,
        savePassphrase: !!passphrase,
        source: 'imported',
      });
      router.back();
    } catch (err) {
      Alert.alert('Import failed', String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="nav"
        title="New Key"
        onBack={() => router.back()}
        right={<RoundButton icon={Check} variant="accent" onPress={onSave} disabled={confirmDisabled || busy} accessibilityLabel="Save" />}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <FormSection>
            <TextField label="Label" value={label} onChangeText={setLabel} placeholder="Required" />
            <TextField label="Private Key" value={privateKey} onChangeText={setPrivateKey} placeholder="Required" multiline />
            <TextField label="Public Key" value={publicKey} onChangeText={setPublicKey} multiline />
            <PasswordField label="Passphrase" value={passphrase} onChangeText={setPassphrase} placeholder="Passphrase" />
            <TextField label="Certificate" value={certificate} onChangeText={setCertificate} multiline last />
          </FormSection>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
