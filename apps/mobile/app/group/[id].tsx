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

import { Stack, useLocalSearchParams } from 'expo-router';
import { HostListScreen } from '../../src/hosts/host-list-screen';
import { useHostById } from '../../src/hosts/use-host-tree';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useHostById(id);
  const title = group?.label ?? 'Group';

  return (
    <>
      <Stack.Screen options={{ title }} />
      <HostListScreen parentId={id} />
    </>
  );
}
