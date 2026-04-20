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

import { Button, cn, useDependency, useObservable } from '@termlnk/design';
import { DEFAULT_PAGE_ID, IContentRouterService } from '@termlnk/ui';
import { FolderSync } from 'lucide-react';
import { useCallback } from 'react';
import { SFTP_PAGE_ID } from '../commands/navigate-sftp.command';

export function SFTPHeaderButton() {
  const contentRouterService = useDependency(IContentRouterService);
  const activePage = useObservable(contentRouterService.activePage$, DEFAULT_PAGE_ID);
  const isActive = activePage === SFTP_PAGE_ID;

  const handleClick = useCallback(() => {
    const targetPage = isActive ? DEFAULT_PAGE_ID : SFTP_PAGE_ID;
    contentRouterService.navigate(targetPage);
  }, [isActive, contentRouterService]);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn('tm:relative', {
        'tm:text-white': isActive,
      })}
      onClick={handleClick}
      type="button"
      title="SFTP"
    >
      <div
        className="tm:flex tm:size-4 tm:shrink-0 tm:items-center tm:justify-center tm:text-white"
      >
        <FolderSync size={14} strokeWidth={1.5} />
      </div>

      {isActive && (
        <span
          className={`
            tm:absolute tm:-bottom-px tm:left-1/2 tm:size-1 tm:-translate-x-1/2 tm:rounded-full tm:bg-nord-blue
          `}
        />
      )}
    </Button>
  );
}
