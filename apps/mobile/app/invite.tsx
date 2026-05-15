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
import { Pressable, Text, View } from 'react-native';

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
    <View className="flex-1 justify-center bg-black px-4">
      <Stack.Screen options={{ title: 'Invitation' }} />

      {!invite && (
        <View className="rounded-xl bg-one-bg p-5">
          <Text className="mb-3 text-[20px] font-semibold text-light-grey">
            Invalid invitation
          </Text>
          <Text className="text-[14px] leading-5 text-grey-fg">
            This screen expects an invitation URL of the form
            {' '}
            <Text className="text-blue">termlnk://invite/&lt;id&gt;#&lt;key&gt;</Text>
            .
            {' '}
            The link you opened did not carry a valid session identifier.
          </Text>
          <Pressable
            onPress={() => router.replace('/(tabs)/hosts')}
            className="mt-5 items-center rounded-lg bg-one-bg2 py-3 active:bg-one-bg3"
          >
            <Text className="text-[14px] font-medium text-light-grey">Go back</Text>
          </Pressable>
        </View>
      )}

      {invite && (
        <View className="rounded-xl bg-one-bg p-5">
          <Text className="mb-3 text-[20px] font-semibold text-light-grey">
            Collaborative session
          </Text>
          <Text className="text-[14px] leading-5 text-grey-fg">
            You have been invited to join session
            {' '}
            <Text className="text-blue">
              {invite.inviteId.slice(0, 8)}
              …
            </Text>
            {' '}
            as a peer of the inviter&apos;s terminal.
          </Text>
          <Text className="mt-3.5 text-[12px] leading-[18px] text-grey">
            Path-B receiver wiring (NaCl box + relay attach + xterm rendering) ships in
            v1.1 of the mobile client. The desktop and termlnk-web clients support it
            today via the shared-terminal-core relay endpoint. Use one of those to
            accept the invitation for now.
          </Text>
          {!invite.hasFragment && (
            <Text className="mt-3 text-[12px] leading-[18px] text-yellow">
              Note: the secret fragment was stripped from this deep link. iOS / Android
              URL handlers drop the `#` portion in some launch paths — open the link
              from a browser that preserves the fragment to keep it E2EE.
            </Text>
          )}
          <Pressable
            onPress={() => router.replace('/(tabs)/hosts')}
            className="mt-5 items-center rounded-lg bg-one-bg2 py-3 active:bg-one-bg3"
          >
            <Text className="text-[14px] font-medium text-light-grey">Back to hosts</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
