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

import type { IXtermProgressState } from '../../../models/terminal-progress.model';
import { describe, expect, it } from 'vitest';
import { XTERM_PROGRESS_STATE } from '../../../models/terminal-progress.model';
import { TerminalProgressService } from '../terminal-progress.service';
import { TerminalUIService } from '../terminal-ui.service';

const INDETERMINATE: IXtermProgressState = { state: XTERM_PROGRESS_STATE.INDETERMINATE, value: 0 };
const RUNNING_40: IXtermProgressState = { state: XTERM_PROGRESS_STATE.RUNNING, value: 40 };

function createTestBed() {
  const terminalUIService = new TerminalUIService();
  const progressService = new TerminalProgressService(terminalUIService);
  return { terminalUIService, progressService };
}

function addSession(terminalUIService: TerminalUIService, id: string): void {
  terminalUIService.addSession({ id, type: 'local', hostId: 'local', hostName: id });
}

describe('terminalProgressService', () => {
  it('defaults to no progress for an unknown session', () => {
    const { progressService } = createTestBed();

    expect(progressService.getProgress('nope').state).toBe(XTERM_PROGRESS_STATE.NONE);
    progressService.dispose();
  });

  it('reports progress per session without cross-talk', () => {
    const { terminalUIService, progressService } = createTestBed();
    addSession(terminalUIService, 's1');
    addSession(terminalUIService, 's2');

    progressService.report('s1', INDETERMINATE);

    expect(progressService.getProgress('s1')).toEqual(INDETERMINATE);
    expect(progressService.getProgress('s2').state).toBe(XTERM_PROGRESS_STATE.NONE);
    progressService.dispose();
  });

  it('emits the current value on subscribe and on change', () => {
    const { terminalUIService, progressService } = createTestBed();
    addSession(terminalUIService, 's1');
    progressService.report('s1', INDETERMINATE);

    const seen: IXtermProgressState[] = [];
    const sub = progressService.progress$('s1').subscribe((value) => seen.push(value));
    progressService.report('s1', RUNNING_40);

    expect(seen).toEqual([INDETERMINATE, RUNNING_40]);
    sub.unsubscribe();
    progressService.dispose();
  });

  it('does not re-emit an identical report', () => {
    const { terminalUIService, progressService } = createTestBed();
    addSession(terminalUIService, 's1');

    const seen: IXtermProgressState[] = [];
    const sub = progressService.progress$('s1').subscribe((value) => seen.push(value));
    progressService.report('s1', INDETERMINATE);
    progressService.report('s1', { ...INDETERMINATE });

    expect(seen).toHaveLength(2);
    sub.unsubscribe();
    progressService.dispose();
  });

  it('clears progress explicitly', () => {
    const { terminalUIService, progressService } = createTestBed();
    addSession(terminalUIService, 's1');
    progressService.report('s1', INDETERMINATE);

    progressService.clear('s1');

    expect(progressService.getProgress('s1').state).toBe(XTERM_PROGRESS_STATE.NONE);
    progressService.dispose();
  });

  // A session killed mid-turn never sends its closing OSC 9;4;0, so the stuck
  // indicator has to be cleared on its behalf.
  it('clears progress when the session reaches a terminated status', () => {
    const { terminalUIService, progressService } = createTestBed();
    addSession(terminalUIService, 's1');
    progressService.report('s1', INDETERMINATE);

    terminalUIService.updateSessionStatus('s1', 'closed');

    expect(progressService.getProgress('s1').state).toBe(XTERM_PROGRESS_STATE.NONE);
    progressService.dispose();
  });

  it('drops tracking when the session disappears', () => {
    const { terminalUIService, progressService } = createTestBed();
    addSession(terminalUIService, 's1');
    progressService.report('s1', INDETERMINATE);

    terminalUIService.removeSession('s1');

    expect(progressService.getProgress('s1').state).toBe(XTERM_PROGRESS_STATE.NONE);
    progressService.dispose();
  });
});
