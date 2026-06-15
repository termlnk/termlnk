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
import type { ISelectSheetOption } from '../../src/ui/select-sheet';
import { RnRussh } from '@termlnk/react-native-russh';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useObservable, useSshKeyRepository } from '../../src/core/core-context';
import { FormSection, PasswordField, SelectField, SwitchField, TextField } from '../../src/ui/form';
import { RoundButton } from '../../src/ui/round-button';
import { ScreenContainer } from '../../src/ui/screen-container';
import { ScreenHeader } from '../../src/ui/screen-header';
import { SelectSheet } from '../../src/ui/select-sheet';

const TYPE_OPTIONS: readonly ISelectSheetOption<ISshKeyAlgorithm>[] = [
  { label: 'ED25519', subtitle: 'OpenSSH 6.5+', value: 'ed25519' },
  { label: 'ECDSA', subtitle: 'OpenSSH 5.7+', value: 'ecdsa' },
  { label: 'RSA', subtitle: 'Legacy devices', value: 'rsa' },
];

type CipherValue = 'aes256-ctr' | 'aes128-ctr' | '3des-cbc';

const CIPHER_OPTIONS: readonly ISelectSheetOption<CipherValue>[] = [
  { label: '3DES', value: '3des-cbc' },
  { label: 'AES-128', value: 'aes128-ctr' },
  { label: 'AES-256', value: 'aes256-ctr' },
];

type RoundsValue = '16' | '64' | '100' | '1000';

const ROUNDS_OPTIONS: readonly ISelectSheetOption<RoundsValue>[] = [
  { label: '16', value: '16' },
  { label: '64', value: '64' },
  { label: '100', value: '100' },
  { label: '1000', value: '1000' },
];

type CurveValue = 'nistp256' | 'nistp384' | 'nistp521';

const CURVE_OPTIONS: readonly ISelectSheetOption<CurveValue>[] = [
  { label: 'nistp256', value: 'nistp256' },
  { label: 'nistp384', value: 'nistp384' },
  { label: 'nistp521', value: 'nistp521' },
];

type KeySizeValue = '1024' | '2048' | '4096';

const KEY_SIZE_OPTIONS: readonly ISelectSheetOption<KeySizeValue>[] = [
  { label: '1024', value: '1024' },
  { label: '2048', value: '2048' },
  { label: '4096', value: '4096' },
];

const CIPHER_DISPLAY: Record<CipherValue, string> = {
  'aes256-ctr': 'AES-256',
  'aes128-ctr': 'AES-128',
  '3des-cbc': '3DES',
};

export default function GenerateKeyRoute() {
  const router = useRouter();
  const keyRepo = useSshKeyRepository();
  const keys = useObservable(keyRepo.keys$, []);

  const [label, setLabel] = useState('');
  const [algorithm, setAlgorithm] = useState<ISshKeyAlgorithm>('ed25519');
  const [rounds, setRounds] = useState<RoundsValue>('100');
  const [curve, setCurve] = useState<CurveValue>('nistp256');
  const [keySize, setKeySize] = useState<KeySizeValue>('2048');
  const [cipher, setCipher] = useState<CipherValue>('aes256-ctr');
  const [passphrase, setPassphrase] = useState('');
  const [savePassphrase, setSavePassphrase] = useState(true);
  const [busy, setBusy] = useState(false);

  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [dynamicSheetOpen, setDynamicSheetOpen] = useState(false);
  const [cipherSheetOpen, setCipherSheetOpen] = useState(false);

  const placeholderLabel = useMemo(() => {
    const prefix = algorithm.toUpperCase();
    const count = keys.filter((k) => k.algorithm === algorithm).length;
    return `${prefix}-${String(count).padStart(2, '0')}`;
  }, [algorithm, keys]);

  const handleAlgorithmChange = useCallback((value: ISshKeyAlgorithm) => {
    setAlgorithm(value);
  }, []);

  const dynamicFieldLabel = algorithm === 'ed25519' ? 'Rounds' : algorithm === 'ecdsa' ? 'Curve' : 'Key Size';
  const dynamicFieldValue = algorithm === 'ed25519' ? rounds : algorithm === 'ecdsa' ? curve : keySize;

  async function onSave() {
    const finalLabel = label.trim() || placeholderLabel;
    setBusy(true);
    try {
      await RnRussh.uniffiInitAsync();
      const hasPassphrase = passphrase.trim().length > 0;
      const pem = RnRussh.generateKeyPair(algorithm, {
        ...(hasPassphrase
          ? {
            passphrase: passphrase.trim(),
            cipher,
            rounds: Number.parseInt(rounds, 10),
          }
          : {}),
        ...(algorithm === 'ecdsa' ? { ecdsaCurve: curve } : {}),
        ...(algorithm === 'rsa' ? { rsaBits: Number.parseInt(keySize, 10) } : {}),
      });
      await keyRepo.importKey({
        label: finalLabel,
        algorithm,
        privateKey: pem,
        passphrase: hasPassphrase ? passphrase.trim() : null,
        savePassphrase: hasPassphrase && savePassphrase,
        source: 'generated',
      });
      router.back();
    } catch (err) {
      Alert.alert('Generate failed', String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader
        variant="nav"
        title="Generate Key"
        onBack={() => router.back()}
        right={<RoundButton icon={Check} variant="accent" onPress={onSave} disabled={busy} accessibilityLabel="Save" />}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <FormSection>
            <TextField label="Label" value={label} onChangeText={setLabel} placeholder={placeholderLabel} autoCapitalize="none" />
            <SelectField label="Type" displayValue={algorithm.toUpperCase()} onPress={() => setTypeSheetOpen(true)} />
            <SelectField label={dynamicFieldLabel} displayValue={dynamicFieldValue} onPress={() => setDynamicSheetOpen(true)} />
            <SelectField label="Cipher" displayValue={CIPHER_DISPLAY[cipher]} onPress={() => setCipherSheetOpen(true)} />
            <PasswordField label="Passphrase" value={passphrase} onChangeText={setPassphrase} placeholder="Passphrase" last />
          </FormSection>

          <FormSection>
            <SwitchField label="Save passphrase" value={savePassphrase} onValueChange={setSavePassphrase} />
            <View className="px-4 py-3">
              <Text className="text-[13px] leading-[18px] text-content">
                Specify the number of bits in the key to create. For RSA keys, the minimum size is 768 bits and the default is 2048 bits. Generally, 2048 bits is considered sufficient.
              </Text>
            </View>
          </FormSection>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectSheet
        visible={typeSheetOpen}
        title="Type"
        options={TYPE_OPTIONS}
        value={algorithm}
        onSelect={handleAlgorithmChange}
        onClose={() => setTypeSheetOpen(false)}
      />

      {algorithm === 'ed25519' && (
        <SelectSheet
          visible={dynamicSheetOpen}
          title="Rounds"
          options={ROUNDS_OPTIONS}
          value={rounds}
          onSelect={setRounds}
          onClose={() => setDynamicSheetOpen(false)}
        />
      )}
      {algorithm === 'ecdsa' && (
        <SelectSheet
          visible={dynamicSheetOpen}
          title="Curve"
          options={CURVE_OPTIONS}
          value={curve}
          onSelect={setCurve}
          onClose={() => setDynamicSheetOpen(false)}
        />
      )}
      {algorithm === 'rsa' && (
        <SelectSheet
          visible={dynamicSheetOpen}
          title="Key Size"
          options={KEY_SIZE_OPTIONS}
          value={keySize}
          onSelect={setKeySize}
          onClose={() => setDynamicSheetOpen(false)}
        />
      )}

      <SelectSheet
        visible={cipherSheetOpen}
        title="Cipher"
        options={CIPHER_OPTIONS}
        value={cipher}
        onSelect={setCipher}
        onClose={() => setCipherSheetOpen(false)}
      />
    </ScreenContainer>
  );
}
