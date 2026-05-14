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

import type { IBiometricAvailability } from '../src/platform/biometric.service';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuthService } from '../src/core/core-context';
import { BiometricService } from '../src/platform/biometric.service';

export default function Login() {
  const auth = useAuthService();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometric, setBiometric] = useState<IBiometricAvailability | null>(null);

  useEffect(() => {
    const service = new BiometricService();
    service.getAvailability().then(setBiometric).catch(() => setBiometric(null));
  }, []);

  const onSubmit = async () => {
    if (!auth || busy) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await auth.login({ email: email.trim(), password });
      router.replace('/hosts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <Stack.Screen options={{ title: 'Sign in' }} />
      <View style={styles.card}>
        <Text style={styles.heading}>Sign in to Termlnk</Text>
        <Text style={styles.subheading}>
          Your master password unlocks the local vault and is never sent in plaintext.
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

        <Text style={styles.label}>Master password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          editable={!busy}
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#6b7280"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        {biometric?.capability === 'available' && (
          <Text style={styles.biometricHint}>
            {biometric.displayName}
            {' '}
            unlock will be available after first sign-in. (v1.1)
          </Text>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={busy || !email || !password}
          style={({ pressed }) => [styles.button, (busy || !email || !password) && styles.buttonDisabled, pressed && styles.buttonPressed]}
        >
          {busy ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.buttonLabel}>Sign in</Text>}
        </Pressable>

        <Pressable onPress={() => router.push('/register')} disabled={busy} style={styles.linkRow}>
          <Text style={styles.linkText}>Don&apos;t have an account? Create one</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', backgroundColor: '#0a0a0a', padding: 24 },
  card: { backgroundColor: '#171717', borderRadius: 14, padding: 24 },
  heading: { color: '#e5e7eb', fontSize: 22, fontWeight: '600', marginBottom: 6 },
  subheading: { color: '#9ca3af', fontSize: 13, marginBottom: 20 },
  label: { color: '#9ca3af', fontSize: 12, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#262626', color: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  error: { color: '#f87171', fontSize: 13, marginTop: 12 },
  biometricHint: { color: '#3b82f6', fontSize: 12, marginTop: 12 },
  button: { backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonLabel: { color: '#0a0a0a', fontSize: 15, fontWeight: '600' },
  linkRow: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#60a5fa', fontSize: 13 },
});
