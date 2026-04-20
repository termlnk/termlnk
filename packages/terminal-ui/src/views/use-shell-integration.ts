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

import type { IShellIntegrationService } from '@termlnk/terminal';
import type { Terminal } from '@xterm/xterm';
import type { RefObject } from 'react';
import { parseOsc633 } from '@termlnk/terminal';
import { useCallback, useEffect, useRef } from 'react';
import { CommandTracker } from '../services/shell-integration/command-tracker';

export interface IUseShellIntegrationOptions {
  sessionId: string;
  xtermRef: RefObject<Terminal | null>;
  shellIntegrationService: IShellIntegrationService;
}

/**
 * Hook that wires up a CommandTracker to an xterm Terminal and ShellIntegrationService.
 * Returns the onOsc633 callback for the useXterm hook.
 */
export function useShellIntegration(options: IUseShellIntegrationOptions) {
  const { sessionId, xtermRef, shellIntegrationService } = options;
  const trackerRef = useRef<CommandTracker | null>(null);

  // Create tracker when terminal is available
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;

    trackerRef.current = new CommandTracker(term, sessionId);

    return () => {
      trackerRef.current = null;
    };
  }, [sessionId, xtermRef]);

  // Handle OSC 633 events
  const onOsc633 = useCallback((data: string) => {
    const tracker = trackerRef.current;
    if (!tracker) return;

    const event = parseOsc633(data);
    if (!event) return;

    switch (event.type) {
      case 'A': {
        tracker.onPromptStart();
        shellIntegrationService.setIsAtPrompt(true);
        break;
      }
      case 'B': {
        tracker.onPromptEnd();
        break;
      }
      case 'C': {
        tracker.onCommandStart();
        shellIntegrationService.setIsAtPrompt(false);
        break;
      }
      case 'D': {
        const command = tracker.onCommandEnd(event.exitCode);
        if (command) {
          shellIntegrationService.addCommand(command);
        }
        break;
      }
      case 'E': {
        tracker.setCommandLine(event.commandLine);
        break;
      }
      case 'P': {
        tracker.setProperty(event.key, event.value);
        if (event.key === 'Cwd') {
          shellIntegrationService.setCwd(event.value);
        }
        break;
      }
    }
  }, [shellIntegrationService]);

  return { onOsc633 };
}
