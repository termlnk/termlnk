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

import type { DragSourceType } from '../hooks/use-panel-drop';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalFilePane } from './LocalFilePane';
import { RemoteFilePane } from './RemoteFilePane';

interface IDualPaneLayoutProps {
  sessionId: string | null;
  onUploadDrop?: (localPaths: string[], remoteTargetPath: string, sourceType: DragSourceType) => void;
  onDownloadDrop?: (remotePaths: string[], localTargetPath: string) => void;
  refreshTrigger?: number;
  /**
   * Hide the LocalFilePane and let the RemoteFilePane span the full width.
   * Used by termlnk-web where "local" means the user's browser, not the
   * server filesystem — IBrowserFileTransferService picks up the slack via
   * the upload / download buttons embedded in RemoteFilePane.
   */
  singlePane?: boolean;
}

export function DualPaneLayout({ sessionId, onUploadDrop, onDownloadDrop, refreshTrigger, singlePane }: IDualPaneLayoutProps) {
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // Attach global listeners only while dragging so an unmount mid-drag
  // cleans them up via the effect teardown instead of leaking forever.
  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const onMouseMove = (ev: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const ratio = Math.min(80, Math.max(20, (x / rect.width) * 100));
      setSplitRatio(ratio);
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  if (singlePane) {
    // Web shell: only the remote side. Browser uploads / downloads flow
    // through IBrowserFileTransferService, surfaced as buttons inside
    // RemoteFilePane.
    return (
      <div ref={containerRef} className="tm:flex tm:size-full tm:overflow-hidden">
        <div className="tm:size-full tm:overflow-hidden">
          <RemoteFilePane sessionId={sessionId} onUploadDrop={onUploadDrop} refreshTrigger={refreshTrigger} />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tm:flex tm:size-full tm:overflow-hidden">
      {/* Left: Local */}
      <div style={{ width: `${splitRatio}%` }} className="tm:h-full tm:overflow-hidden tm:border-r tm:border-line">
        <LocalFilePane onDownloadDrop={onDownloadDrop} />
      </div>

      {/* Resizer */}
      <div
        className={`
          tm:flex tm:h-full tm:w-1 tm:shrink-0 tm:cursor-col-resize tm:items-center tm:justify-center
          tm:hover:bg-blue/30
        `}
        onMouseDown={handleMouseDown}
      />

      {/* Right: Remote */}
      <div style={{ width: `${100 - splitRatio}%` }} className="tm:h-full tm:overflow-hidden">
        <RemoteFilePane sessionId={sessionId} onUploadDrop={onUploadDrop} refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
