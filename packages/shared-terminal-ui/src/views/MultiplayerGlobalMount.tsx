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

import { ParticipantJoinDialog } from './ParticipantJoinDialog';

/**
 * Renders the always-mounted multiplayer overlays at the workbench GLOBAL slot.
 *
 * Currently this is only the `ParticipantJoinDialog`, which subscribes to
 * `inviteUrl$` so deep-link invites can surface even before the user opens any
 * settings page. The joiner-side terminal viewer (`RemoteTerminalView`) used
 * to live here too, but it is now registered with `ITerminalViewRegistry` as
 * the `'remote'` view type and rendered inside a normal terminal tab via
 * `RemoteSessionBridgeController`, so users can have several concurrent
 * shared sessions and switch between them like any other tab.
 */
export function MultiplayerGlobalMount(): React.JSX.Element {
  return (
    <ParticipantJoinDialog />
  );
}
