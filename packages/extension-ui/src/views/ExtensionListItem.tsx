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

import type { IExtensionDescription } from '@termlnk/extension';
import { cn } from '@termlnk/design';
import { ExtensionStatus } from '@termlnk/extension';
import { Power, PowerOff, RefreshCw, Trash2 } from 'lucide-react';

interface IExtensionListItemProps {
  extension: IExtensionDescription;
  onEnable: (id: string) => void;
  onDisable: (id: string) => void;
  onUninstall: (id: string) => void;
  onReload: (id: string) => void;
}

export function ExtensionListItem({ extension, onEnable, onDisable, onUninstall, onReload }: IExtensionListItemProps) {
  const { id, manifest, status, isDev, error } = extension;
  const isActive = status === ExtensionStatus.Activated;
  const isDisabled = status === ExtensionStatus.Disabled;
  const isError = status === ExtensionStatus.Error;

  return (
    <div
      className={cn(
        'tm:flex tm:items-center tm:gap-2 tm:rounded-md tm:px-2 tm:py-1.5',
        `
          tm:transition-colors tm:duration-100
          tm:hover:bg-one-bg2
        `,
        { 'tm:opacity-50': isDisabled }
      )}
    >
      <div className="tm:flex tm:min-w-0 tm:flex-1 tm:flex-col">
        <div className="tm:flex tm:items-center tm:gap-1.5">
          <span className="tm:truncate tm:text-sm tm:font-medium tm:text-white">
            {manifest.name}
          </span>
          <span className="tm:shrink-0 tm:text-xs tm:text-grey">
            v
            {manifest.version}
          </span>
          {isDev && (
            <span
              className={`
                tm:shrink-0 tm:rounded-sm tm:bg-yellow/15 tm:px-1 tm:py-0.5 tm:text-[10px] tm:leading-none
                tm:font-medium tm:text-yellow
              `}
            >
              DEV
            </span>
          )}
          {isActive && (
            <span className="tm:size-1.5 tm:shrink-0 tm:rounded-full tm:bg-green" />
          )}
          {isError && (
            <span className="tm:size-1.5 tm:shrink-0 tm:rounded-full tm:bg-red" />
          )}
        </div>
        {manifest.description && (
          <span className="tm:truncate tm:text-xs tm:text-light-grey">
            {manifest.description}
          </span>
        )}
        {isError && error && (
          <span className="tm:truncate tm:text-xs tm:text-red">
            {error}
          </span>
        )}
        {manifest.author && (
          <span className="tm:truncate tm:text-[10px] tm:text-grey">
            {typeof manifest.author === 'string' ? manifest.author : manifest.author.name}
          </span>
        )}
      </div>

      <div className="tm:flex tm:shrink-0 tm:items-center tm:gap-0.5">
        {isDev && (
          <button
            className="
              tm:rounded-sm tm:p-1 tm:text-grey-fg
              tm:hover:bg-one-bg3 tm:hover:text-light-grey
            "
            onClick={() => onReload(id)}
            title="Reload"
          >
            <RefreshCw size={14} />
          </button>
        )}

        {isDisabled
          ? (
            <button
              className="
                tm:rounded-sm tm:p-1 tm:text-grey-fg
                tm:hover:bg-one-bg3 tm:hover:text-green
              "
              onClick={() => onEnable(id)}
              title="Enable"
            >
              <Power size={14} />
            </button>
          )
          : (
            <button
              className="
                tm:rounded-sm tm:p-1 tm:text-grey-fg
                tm:hover:bg-one-bg3 tm:hover:text-yellow
              "
              onClick={() => onDisable(id)}
              title="Disable"
            >
              <PowerOff size={14} />
            </button>
          )}

        <button
          className="
            tm:rounded-sm tm:p-1 tm:text-grey-fg
            tm:hover:bg-one-bg3 tm:hover:text-red
          "
          onClick={() => onUninstall(isDev ? id : id)}
          title={isDev ? 'Remove' : 'Uninstall'}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
