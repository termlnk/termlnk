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

import { useLocalSearchParams } from 'expo-router';
import { HostEditScreen } from '../../components/hosts/host-edit-screen';

export default function HostEditRoute() {
  const params = useLocalSearchParams<{ id?: string; pid?: string; kind?: string; addr?: string; username?: string; port?: string }>();
  const kind = params.kind === 'group' ? 'group' : 'host';
  return (
    <HostEditScreen
      hostId={params.id}
      parentId={params.pid}
      kind={kind}
      prefillAddr={params.addr}
      prefillUsername={params.username}
      prefillPort={params.port}
    />
  );
}
