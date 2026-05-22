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

export { DEFAULT_CLOUD_BASE_URL, SHARED_TERMINAL_CAPABILITY_VERSION, SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS, SHARED_TERMINAL_FRAME_MAX_PAYLOAD, SHARED_TERMINAL_FRAME_PREFIX, SHARED_TERMINAL_FRAME_VERSION, SHARED_TERMINAL_HEARTBEAT_MS, SHARED_TERMINAL_INVITE_DEFAULT_TTL_MS, SHARED_TERMINAL_RECONNECT_INITIAL_MS, SHARED_TERMINAL_RECONNECT_MAX_MS, SHARED_TERMINAL_RING_BUFFER_BYTES } from './common/constants';
export type { ISharedTerminalPluginConfig } from './controllers/config.schema';
export { SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IDriverHandover, IDriverState } from './models/driver';
export type { ControlMessageType, IControlMessage, IControlMessageBase, IDriverHandoverControlMessage, IDriverLockControlMessage, IDriverReleaseControlMessage, IDriverRequestControlMessage, IDriverUnlockControlMessage, IErrorControlMessage, IFrame, IHeartbeatControlMessage, IInviteAcceptControlMessage, IInviteClaimControlMessage, IInviteRejectControlMessage, IInviteSessionEvent, IKickControlMessage, IParticipantJoinedSessionEvent, IParticipantKickedSessionEvent, IParticipantLeftSessionEvent, IRekeyControlMessage, IRekeySessionEvent, IResizeControlMessage, IRoleChangedSessionEvent, ISessionEvent, ISessionEventBase, ISessionLifecycleEvent, ISnapshotSessionEvent, SessionEventType } from './models/frame';
export { CONTROL_MESSAGE_TYPES, FrameChannel, FrameFlag, SESSION_EVENT_TYPES } from './models/frame';
export type { CollabInviteStatus, ICapability, ICollabInvite, IInviteClaimPayload, IInviteClaimResult, IInviteCreateOptions, IInviteTokenState } from './models/invite';
export type { IKeypair, ISharedKey } from './models/keypair';
export type { IPairedDevice, ISessionAcceptPayload, ISessionClaimPayload, ISessionRejectPayload } from './models/pairing';
export { isWriterRole, SharedTerminalRole } from './models/role';
export type { IParticipant, ISessionSnapshot, ISharedSession } from './models/session';
export { ClientConnectionState, DaemonState, SharedSessionState } from './models/session';
export { SHARED_TERMINAL_PLUGIN_NAME, SharedTerminalPlugin } from './plugin';
export type { ICollabInviteCreateInput, ICollabInviteServerView } from './services/collab-invite-transport.service';
export { ICollabInviteTransportService } from './services/collab-invite-transport.service';
export { ISharedTerminalCryptoService } from './services/crypto.service';
export type { IPersistedDaemonKeypair } from './services/daemon-keypair.service';
export { DAEMON_KEYPAIR_CONFIG_SUBKEY, IDaemonKeypairService } from './services/daemon-keypair.service';
export type { IRemoteAnnouncedSession } from './services/device-pairing.service';
export { IDevicePairingService } from './services/device-pairing.service';
export { IFrameCodecService } from './services/frame-codec.service';
export { IPairingService } from './services/pairing.service';
export type { IParticipantConnectInput, IParticipantConnectResult, IParticipantFrame, IParticipantSnapshot } from './services/participant-client.service';
export { IParticipantService } from './services/participant-client.service';
export type { IOutboundFrame, IPtySource, IRegisteredPty, IRekeyResult, RekeyReason } from './services/pty-multiplexer.service';
export { IPtyMultiplexerService } from './services/pty-multiplexer.service';
export type { IShareableSession, ISharedTerminalError, SharedTerminalErrorCode } from './services/shared-terminal.service';
export { ISharedTerminalService } from './services/shared-terminal.service';
export type { IInboundFrame, ITransportConnectOptions, ITransportSendOptions } from './services/transport.service';
export { ISharedTerminalTransportService, TransportState } from './services/transport.service';
