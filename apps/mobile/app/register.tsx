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

import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuthService } from '../src/core/core-context';

const MIN_PASSWORD_LENGTH = 8;

type PasswordHint = 'ok' | 'short' | 'mismatch';

export default function Register() {
  const auth = useAuthService();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hint: PasswordHint = useMemo(() => {
    if (password.length === 0) {
      return 'ok';
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return 'short';
    }
    if (confirm.length > 0 && password !== confirm) {
      return 'mismatch';
    }
    return 'ok';
  }, [password, confirm]);

  const canSubmit = email.trim().length > 0
    && password.length >= MIN_PASSWORD_LENGTH
    && password === confirm
    && !busy;

  const onSubmit = async () => {
    if (!auth || !canSubmit) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const trimmedDisplayName = displayName.trim();
      await auth.register({
        email: email.trim(),
        password,
        displayName: trimmedDisplayName.length > 0 ? trimmedDisplayName : undefined,
      });
      router.replace('/hosts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <Stack.Screen options={{ title: 'Sign up' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.heading}>Create your Termlnk account</Text>
          <Text style={styles.subheading}>
            Your master password locks the local vault. It is never sent in plaintext
            and cannot be recovered — losing it means losing your data.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!busy}
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Display name (optional)</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!busy}
            style={styles.input}
            placeholder="How should we address you?"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Master password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            editable={!busy}
            style={styles.input}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Confirm master password</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            editable={!busy}
            style={styles.input}
            placeholder="Re-enter your master password"
            placeholderTextColor="#6b7280"
          />

          {hint === 'short' && (
            <Text style={styles.warning}>
              Use at least
              {' '}
              {MIN_PASSWORD_LENGTH}
              {' '}
              characters. A passphrase of 4+ words works best.
            </Text>
          )}
          {hint === 'mismatch' && (
            <Text style={styles.warning}>Passwords do not match yet.</Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [styles.button, !canSubmit && styles.buttonDisabled, pressed && styles.buttonPressed]}
          >
            {busy ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.buttonLabel}>Sign up</Text>}
          </Pressable>

          <Pressable onPress={() => router.replace('/login')} disabled={busy} style={styles.linkRow}>
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#171717', borderRadius: 14, padding: 24 },
  heading: { color: '#e5e7eb', fontSize: 22, fontWeight: '600', marginBottom: 6 },
  subheading: { color: '#9ca3af', fontSize: 13, marginBottom: 20, lineHeight: 18 },
  label: { color: '#9ca3af', fontSize: 12, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#262626', color: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  warning: { color: '#facc15', fontSize: 12, marginTop: 10 },
  error: { color: '#f87171', fontSize: 13, marginTop: 12 },
  button: { backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonLabel: { color: '#0a0a0a', fontSize: 15, fontWeight: '600' },
  linkRow: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#60a5fa', fontSize: 13 },
});
