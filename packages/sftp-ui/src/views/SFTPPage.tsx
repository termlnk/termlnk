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

import type { ISFTPTransferTask } from '@termlnk/rpc';
import type { DragSourceType } from './hooks/use-panel-drop';
import { Button } from '@termlnk/design';
import { FolderSync, Unplug } from 'lucide-react';
import { useCallback, useState } from 'react';
import { DualPaneLayout } from './dual-pane/DualPaneLayout';
import { useSFTPPageConnection } from './hooks/use-sftp-page-connection';
import { useTransferQueue } from './hooks/use-transfer-queue';
import { HostSelector } from './host-selector/HostSelector';
import { SFTPConnectionOverlay } from './SFTPConnectionOverlay';
import { TransferHistoryButton } from './transfer/TransferHistoryButton';
import { TransferOverlay } from './transfer/TransferOverlay';

interface ISelectedHost {
  id: string;
  name: string;
  address: string;
}

export function SFTPPage() {
  const [selectedHost, setSelectedHost] = useState<ISelectedHost | null>(null);
  const connection = useSFTPPageConnection(selectedHost?.id ?? null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleTransferComplete = useCallback((task: ISFTPTransferTask) => {
    if (task.direction === 'upload') {
      setRefreshTrigger((prev) => prev + 1);
    }
  }, []);

  const transfers = useTransferQueue(connection.backendSessionId, {
    onTransferComplete: handleTransferComplete,
  });

  const handleHostSelect = useCallback((hostId: string, hostName: string, hostAddress: string) => {
    setSelectedHost({ id: hostId, name: hostName, address: hostAddress });
  }, []);

  const handleDisconnect = useCallback(() => {
    connection.disconnect();
    setSelectedHost(null);
  }, [connection]);

  const handlePasswordSubmit = useCallback((password: string) => {
    connection.respondKeyboardInteractive([password]);
  }, [connection]);

  const handleRetry = useCallback((password: string) => {
    connection.retry(password);
  }, [connection]);

  const handleUploadDrop = useCallback((localPaths: string[], remoteTargetPath: string, _sourceType: DragSourceType) => {
    // Both native file drops and cross-panel local→remote drops use uploadNativeFiles
    // because localPaths are always absolute local filesystem paths
    transfers.uploadNativeFiles(localPaths, remoteTargetPath);
  }, [transfers]);

  const handleDownloadDrop = useCallback((remotePaths: string[], localTargetPath: string) => {
    transfers.downloadFiles(remotePaths, localTargetPath);
  }, [transfers]);

  const isConnected = connection.state.phase === 'ready';
  const isConnecting = connection.state.phase !== 'idle' && connection.state.phase !== 'ready';

  return (
    <div className="tm:relative tm:flex tm:size-full tm:flex-col tm:overflow-hidden tm:bg-black">
      {/* Header */}
      <div
        className={`
          tm:flex tm:h-9 tm:shrink-0 tm:items-center tm:gap-2 tm:border-b tm:border-line tm:bg-statusline-bg tm:px-3
        `}
      >
        <FolderSync size={16} strokeWidth={1.6} className="tm:text-white" />
        <span className="tm:text-[13px] tm:font-medium tm:text-white tm:select-none">SFTP</span>
        <div className="tm:mx-1 tm:h-4 tm:w-px tm:bg-line" />
        <HostSelector
          selectedHostId={selectedHost?.id ?? null}
          selectedHostName={selectedHost?.name ?? ''}
          onSelect={handleHostSelect}
        />
        {isConnected && (
          <>
            <div className="tm:flex-1" />
            <TransferHistoryButton />
            <Button
              variant="ghost"
              size="sm"
              className="
                tm:gap-1 tm:text-light-grey
                tm:hover:text-red
              "
              onClick={handleDisconnect}
            >
              <Unplug size={14} strokeWidth={1.6} />
              Disconnect
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="tm:flex-1 tm:overflow-hidden">
        {!selectedHost && (
          <div className="tm:flex tm:h-full tm:items-center tm:justify-center">
            <div className="tm:text-center">
              <FolderSync size={48} strokeWidth={1} className="tm:mx-auto tm:text-one-bg3" />
              <div className="tm:mt-3 tm:text-[14px] tm:text-grey-fg tm:select-none">
                Select a host to start SFTP session
              </div>
            </div>
          </div>
        )}

        {isConnecting && (
          <SFTPConnectionOverlay
            hostName={selectedHost?.name ?? ''}
            hostAddress={selectedHost?.address ?? ''}
            state={connection.state}
            onClose={handleDisconnect}
            onPasswordSubmit={handlePasswordSubmit}
            onRetry={handleRetry}
          />
        )}

        {isConnected && (
          <div className="tm:h-full tm:overflow-hidden">
            <DualPaneLayout
              sessionId={connection.backendSessionId}
              onUploadDrop={handleUploadDrop}
              onDownloadDrop={handleDownloadDrop}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}
      </div>

      {/* Transfer overlay */}
      <TransferOverlay onCancel={transfers.cancel} />
    </div>
  );
}
