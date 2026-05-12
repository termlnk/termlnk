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
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ParsedInvite {
  readonly inviteId: string;
  // ephSecretB64 + capability are intentionally NOT surfaced in the UI even when
  // resolved; the screen only shows the public-safe inviteId. The full secret lives in
  // memory of this screen for the moment of attempt, then drops on unmount.
  readonly hasFragment: boolean;
}

// Deep-link entry for path-B (§3.6 / §5) collab invites:
//   termlnk://invite/<sessionId>#<ephSecretB64>
// Or via the universal-link bridge:
//   https://invite.termlnk.io/s/<sessionId>#<ephSecretB64>
//
// Expo Linking strips the hash fragment from `useLocalSearchParams` (router params come
// from query string only), so we accept the fragment either as `?frag=...` (rewritten
// by the router middleware when the screen mounts) or fall back to "no fragment" mode
// where we tell the user to use a desktop deep link instead.
function parseInvite(rawId: string | string[] | undefined, frag: string | undefined): ParsedInvite | null {
  if (!rawId || Array.isArray(rawId) || rawId.length === 0) {
    return null;
  }
  return {
    inviteId: rawId,
    hasFragment: typeof frag === 'string' && frag.length > 0,
  };
}

export default function InviteScreen() {
  const params = useLocalSearchParams<{ id?: string; frag?: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<ParsedInvite | null>(null);

  useEffect(() => {
    setInvite(parseInvite(params.id, params.frag));
  }, [params.id, params.frag]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Invitation' }} />

      {!invite && (
        <View style={styles.card}>
          <Text style={styles.title}>Invalid invitation</Text>
          <Text style={styles.body}>
            This screen expects an invitation URL of the form{' '}
            <Text style={styles.code}>termlnk://invite/&lt;id&gt;#&lt;key&gt;</Text>.
            The link you opened did not carry a valid session identifier.
          </Text>
          <Pressable onPress={() => router.replace('/hosts')} style={styles.button}>
            <Text style={styles.buttonLabel}>Go back</Text>
          </Pressable>
        </View>
      )}

      {invite && (
        <View style={styles.card}>
          <Text style={styles.title}>Collaborative session</Text>
          <Text style={styles.body}>
            You have been invited to join session{' '}
            <Text style={styles.code}>{invite.inviteId.slice(0, 8)}…</Text> as a peer of
            the inviter's terminal.
          </Text>
          <Text style={styles.note}>
            Path-B receiver wiring (NaCl box + relay attach + xterm rendering) ships in
            v1.1 of the mobile client. The desktop and termlnk-web clients support it
            today via the shared-terminal-core relay endpoint. Use one of those to
            accept the invitation for now.
          </Text>
          {!invite.hasFragment && (
            <Text style={styles.warning}>
              Note: the secret fragment was stripped from this deep link. iOS / Android
              URL handlers drop the `#` portion in some launch paths — open the link
              from a browser that preserves the fragment to keep it E2EE.
            </Text>
          )}
          <Pressable onPress={() => router.replace('/hosts')} style={styles.button}>
            <Text style={styles.buttonLabel}>Back to hosts</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a', padding: 16, justifyContent: 'center' },
  card: { backgroundColor: '#171717', borderRadius: 12, padding: 20 },
  title: { color: '#e5e7eb', fontSize: 20, fontWeight: '600', marginBottom: 12 },
  body: { color: '#9ca3af', fontSize: 14, lineHeight: 20 },
  code: { color: '#3b82f6', fontFamily: 'Menlo' },
  note: { color: '#6b7280', fontSize: 12, lineHeight: 18, marginTop: 14 },
  warning: { color: '#fbbf24', fontSize: 12, lineHeight: 18, marginTop: 12 },
  button: { backgroundColor: '#262626', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  buttonLabel: { color: '#e5e7eb', fontSize: 14, fontWeight: '500' },
});
