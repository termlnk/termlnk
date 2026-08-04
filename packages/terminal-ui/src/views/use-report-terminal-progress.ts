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

import type { IXtermProgressState } from '../models/terminal-progress.model';
import { useDependency } from '@termlnk/design';
import { useEffect } from 'react';
import { ITerminalProgressService } from '../services/terminal/terminal-progress.service';

/**
 * Publishes a terminal view's OSC 9;4 progress so the pane header and tab bar can
 * render it — they sit outside the view's component tree, which is portalled into
 * the pane content area.
 */
export function useReportTerminalProgress(sessionId: string, progress: IXtermProgressState): void {
  const progressService = useDependency(ITerminalProgressService);

  useEffect(() => {
    progressService.report(sessionId, progress);
  }, [progressService, sessionId, progress]);

  useEffect(() => {
    return () => progressService.clear(sessionId);
  }, [progressService, sessionId]);
}
