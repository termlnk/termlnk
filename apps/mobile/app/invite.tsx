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
  // ephSecretB64 + capability are never surfaced in the UI. The secret lives in this
  // screen's memory for the attempt window and is dropped on unmount.
  readonly hasFragment: boolean;
}

// Deep-link entry for collab invites:
//   termlnk://invite/<sessionId>#<ephSecretB64>
//   https://invite.termlnk.io/s/<sessionId>#<ephSecretB64>
//
// Expo Linking strips the hash fragment from useLocalSearchParams, so we accept the
// fragment as `?frag=...` (rewritten by router middleware) and fall back to a hint when
// the launch path stripped it.
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
            The mobile client cannot accept collab invitations yet. Use the desktop or
            termlnk-web client to join via the shared-terminal-core relay endpoint.
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
