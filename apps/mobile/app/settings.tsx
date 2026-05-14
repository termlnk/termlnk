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
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCurrentUser } from '../src/core/core-context';
import { BiometricService } from '../src/platform/biometric.service';

export default function Settings() {
  const user = useCurrentUser();
  const [biometric, setBiometric] = useState<IBiometricAvailability | null>(null);

  useEffect(() => {
    const service = new BiometricService();
    service.getAvailability().then(setBiometric).catch(() => setBiometric(null));
  }, []);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Settings' }} />

      <Section title="Account">
        <Row label="Signed in as" value={user?.email ?? '—'} />
        <Row label="Display name" value={user?.displayName ?? '—'} />
        <Row label="Email verified" value={user?.emailVerified ? 'Yes' : 'No'} />
      </Section>

      <Section title="Security">
        <Row label="Auto-lock timeout" value="5 minutes (background)" />
        <Row label="Biometric available" value={biometric?.capability ?? 'checking…'} />
        <Row label="Biometric type" value={biometric?.displayName ?? '—'} />
        <Text style={styles.note}>
          When the app spends more than 5 minutes off the foreground, the master key
          is dropped from memory and you sign in again on next launch.
        </Text>
      </Section>

      <Section title="Sync">
        <Text style={styles.note}>
          Pull-only in v1. Edits to host / provider / MCP / skill records happen on the
          desktop client and propagate here after the next pull (`/v1/sync/pull`).
        </Text>
      </Section>

      <Section title="About">
        <Row label="Client" value="termlnk-mobile" />
        <Row label="Version" value="0.0.1" />
        <Row label="SSH backend" value="rebuilding on Rust russh (P6.9 in progress)" />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  sectionBody: { backgroundColor: '#171717', borderRadius: 10, padding: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { color: '#9ca3af', fontSize: 13 },
  rowValue: { color: '#e5e7eb', fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  note: { color: '#6b7280', fontSize: 12, lineHeight: 17, marginTop: 8 },
});
