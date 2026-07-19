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

import type { ITerminalOutputFrame, ITerminalOutputSink, ITerminalOutputSource } from '../terminal-output-stream.service';
import { TERMINAL_OUTPUT_CREDIT_BYTES, TERMINAL_OUTPUT_CREDIT_FRAMES, TERMINAL_OUTPUT_MAX_FRAME_BYTES } from '@termlnk/terminal';
import { Observable, Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TerminalOutputFlow } from '../terminal-output-stream.service';

interface ISourceFixture {
  readonly source: ITerminalOutputSource;
  readonly data$: Subject<Uint8Array>;
  readonly pauseOutput: ReturnType<typeof vi.fn>;
  readonly resumeOutput: ReturnType<typeof vi.fn>;
}

interface ISinkFixture {
  readonly sink: ITerminalOutputSink;
  readonly frames: ITerminalOutputFrame[];
  readonly complete: ReturnType<typeof vi.fn>;
  readonly error: ReturnType<typeof vi.fn>;
}

function createSourceFixture(): ISourceFixture {
  const data$ = new Subject<Uint8Array>();
  const pauseOutput = vi.fn();
  const resumeOutput = vi.fn();
  return {
    data$,
    pauseOutput,
    resumeOutput,
    source: {
      data$: data$.asObservable(),
      pauseOutput,
      resumeOutput,
    },
  };
}

function createSinkFixture(): ISinkFixture {
  const frames: ITerminalOutputFrame[] = [];
  const complete = vi.fn();
  const error = vi.fn();
  return {
    frames,
    complete,
    error,
    sink: {
      send: (frame) => frames.push(frame),
      complete,
      error,
    },
  };
}

describe('TerminalOutputFlow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces small source chunks into one bounded transport frame', () => {
    vi.useFakeTimers();
    const sourceFixture = createSourceFixture();
    const sinkFixture = createSinkFixture();
    const flow = new TerminalOutputFlow(sourceFixture.source);
    const handle = flow.attach(sinkFixture.sink);

    sourceFixture.data$.next(new Uint8Array([0x41]));
    sourceFixture.data$.next(new Uint8Array([0x42, 0x43]));

    expect(sinkFixture.frames).toHaveLength(0);
    vi.runOnlyPendingTimers();
    expect(sinkFixture.frames).toHaveLength(1);
    expect([...sinkFixture.frames[0]!.data]).toEqual([0x41, 0x42, 0x43]);

    handle.dispose();
    flow.dispose();
  });

  it('flushes a partial transport frame before source completion', () => {
    vi.useFakeTimers();
    const sourceFixture = createSourceFixture();
    const sinkFixture = createSinkFixture();
    const flow = new TerminalOutputFlow(sourceFixture.source);
    const handle = flow.attach(sinkFixture.sink);

    sourceFixture.data$.next(new Uint8Array([0x41]));
    sourceFixture.data$.complete();

    expect(sinkFixture.frames).toHaveLength(1);
    expect(sinkFixture.complete).not.toHaveBeenCalled();
    handle.acknowledge(sinkFixture.frames[0]!.sequence);
    expect(sinkFixture.complete).toHaveBeenCalledTimes(1);
  });

  it('bounds in-flight bytes and resumes after parser acknowledgements', () => {
    const sourceFixture = createSourceFixture();
    const sinkFixture = createSinkFixture();
    const flow = new TerminalOutputFlow(sourceFixture.source);
    const handle = flow.attach(sinkFixture.sink);
    const payload = new Uint8Array(TERMINAL_OUTPUT_CREDIT_BYTES + TERMINAL_OUTPUT_MAX_FRAME_BYTES);

    sourceFixture.data$.next(payload);

    expect(sinkFixture.frames).toHaveLength(4);
    expect(sinkFixture.frames.every((frame) => frame.data.byteLength === TERMINAL_OUTPUT_MAX_FRAME_BYTES)).toBe(true);
    expect(sourceFixture.pauseOutput).toHaveBeenCalledTimes(1);
    expect(sourceFixture.resumeOutput).not.toHaveBeenCalled();

    handle.acknowledge(sinkFixture.frames[1]!.sequence);

    expect(sinkFixture.frames).toHaveLength(5);
    expect(sourceFixture.resumeOutput).toHaveBeenCalledTimes(1);
    expect(sinkFixture.frames.map((frame) => frame.sequence)).toEqual([0, 1, 2, 3, 4]);

    handle.dispose();
    flow.dispose();
  });

  it('bounds the number of in-flight frames independently of their byte size', () => {
    vi.useFakeTimers();
    const sourceFixture = createSourceFixture();
    const sinkFixture = createSinkFixture();
    const flow = new TerminalOutputFlow(sourceFixture.source);
    const handle = flow.attach(sinkFixture.sink);

    for (let index = 0; index <= TERMINAL_OUTPUT_CREDIT_FRAMES; index++) {
      sourceFixture.data$.next(new Uint8Array([index]));
      vi.runOnlyPendingTimers();
    }

    expect(sinkFixture.frames).toHaveLength(TERMINAL_OUTPUT_CREDIT_FRAMES);
    expect(sourceFixture.pauseOutput).toHaveBeenCalledTimes(1);

    handle.acknowledge(sinkFixture.frames.at(-1)!.sequence);

    expect(sinkFixture.frames).toHaveLength(TERMINAL_OUTPUT_CREDIT_FRAMES + 1);
    expect(sourceFixture.resumeOutput).toHaveBeenCalledTimes(1);
    handle.dispose();
    flow.dispose();
  });

  it('waits for the slowest attached consumer before resuming the source', () => {
    const sourceFixture = createSourceFixture();
    const firstSink = createSinkFixture();
    const secondSink = createSinkFixture();
    const flow = new TerminalOutputFlow(sourceFixture.source);
    const firstHandle = flow.attach(firstSink.sink);
    const secondHandle = flow.attach(secondSink.sink);

    sourceFixture.data$.next(new Uint8Array(TERMINAL_OUTPUT_CREDIT_BYTES + TERMINAL_OUTPUT_MAX_FRAME_BYTES));
    firstHandle.acknowledge(firstSink.frames.at(-1)!.sequence);

    expect(firstSink.frames).toHaveLength(5);
    expect(secondSink.frames).toHaveLength(4);
    expect(sourceFixture.resumeOutput).not.toHaveBeenCalled();

    secondHandle.acknowledge(secondSink.frames.at(-1)!.sequence);

    expect(secondSink.frames).toHaveLength(5);
    expect(sourceFixture.resumeOutput).toHaveBeenCalledTimes(1);

    firstHandle.dispose();
    secondHandle.dispose();
    flow.dispose();
  });

  it('resumes a paused source when the final consumer detaches', () => {
    const sourceFixture = createSourceFixture();
    const sinkFixture = createSinkFixture();
    const flow = new TerminalOutputFlow(sourceFixture.source);
    const handle = flow.attach(sinkFixture.sink);

    sourceFixture.data$.next(new Uint8Array(TERMINAL_OUTPUT_CREDIT_BYTES + TERMINAL_OUTPUT_MAX_FRAME_BYTES));
    handle.dispose();

    expect(flow.clientCount).toBe(0);
    expect(sourceFixture.resumeOutput).toHaveBeenCalledTimes(1);
    flow.dispose();
  });

  it('forwards source completion and errors to every consumer', () => {
    const sourceFixture = createSourceFixture();
    const firstSink = createSinkFixture();
    const secondSink = createSinkFixture();
    const flow = new TerminalOutputFlow(sourceFixture.source);
    flow.attach(firstSink.sink);
    flow.attach(secondSink.sink);

    sourceFixture.data$.complete();

    expect(firstSink.complete).toHaveBeenCalledTimes(1);
    expect(secondSink.complete).toHaveBeenCalledTimes(1);
    expect(firstSink.error).not.toHaveBeenCalled();
    expect(secondSink.error).not.toHaveBeenCalled();
    flow.dispose();
  });

  it('waits for every queued frame acknowledgement before completing consumers', () => {
    const sourceFixture = createSourceFixture();
    const sinkFixture = createSinkFixture();
    const flow = new TerminalOutputFlow(sourceFixture.source);
    const handle = flow.attach(sinkFixture.sink);

    sourceFixture.data$.next(new Uint8Array(TERMINAL_OUTPUT_CREDIT_BYTES + TERMINAL_OUTPUT_MAX_FRAME_BYTES));
    sourceFixture.data$.complete();

    expect(sinkFixture.frames).toHaveLength(4);
    expect(sinkFixture.complete).not.toHaveBeenCalled();

    handle.acknowledge(sinkFixture.frames.at(-1)!.sequence);

    expect(sinkFixture.frames).toHaveLength(5);
    expect(sinkFixture.complete).not.toHaveBeenCalled();

    handle.acknowledge(sinkFixture.frames.at(-1)!.sequence);

    expect(sinkFixture.complete).toHaveBeenCalledTimes(1);
    expect(flow.clientCount).toBe(0);
  });

  it('handles synchronous source completion without retaining a closed subscription', () => {
    const complete = vi.fn();
    const source: ITerminalOutputSource = {
      data$: new Observable<Uint8Array>((subscriber) => subscriber.complete()),
      pauseOutput: vi.fn(),
      resumeOutput: vi.fn(),
    };
    const flow = new TerminalOutputFlow(source);

    flow.attach({ send: vi.fn(), complete, error: vi.fn() });

    expect(complete).toHaveBeenCalledTimes(1);
    expect(flow.clientCount).toBe(0);
  });

  it('releases a paused source and errors every consumer when the source fails', () => {
    const sourceFixture = createSourceFixture();
    const firstSink = createSinkFixture();
    const secondSink = createSinkFixture();
    const flow = new TerminalOutputFlow(sourceFixture.source);
    const firstHandle = flow.attach(firstSink.sink);
    const secondHandle = flow.attach(secondSink.sink);

    sourceFixture.data$.next(new Uint8Array(TERMINAL_OUTPUT_CREDIT_BYTES + TERMINAL_OUTPUT_MAX_FRAME_BYTES));
    sourceFixture.data$.error(new Error('source failed'));

    expect(sourceFixture.resumeOutput).toHaveBeenCalledTimes(1);
    expect(firstSink.error).not.toHaveBeenCalled();
    expect(secondSink.error).not.toHaveBeenCalled();

    firstHandle.acknowledge(firstSink.frames.at(-1)!.sequence);
    firstHandle.acknowledge(firstSink.frames.at(-1)!.sequence);
    secondHandle.acknowledge(secondSink.frames.at(-1)!.sequence);
    secondHandle.acknowledge(secondSink.frames.at(-1)!.sequence);

    expect(firstSink.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'source failed' }));
    expect(secondSink.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'source failed' }));
    expect(flow.clientCount).toBe(0);
  });

  it('flushes a partial frame before propagating a source error', () => {
    const sourceFixture = createSourceFixture();
    const sinkFixture = createSinkFixture();
    const flow = new TerminalOutputFlow(sourceFixture.source);
    const handle = flow.attach(sinkFixture.sink);

    sourceFixture.data$.next(new Uint8Array([0x41]));
    sourceFixture.data$.error(new Error('source failed'));

    expect(sinkFixture.frames).toHaveLength(1);
    expect([...sinkFixture.frames[0]!.data]).toEqual([0x41]);
    expect(sinkFixture.error).not.toHaveBeenCalled();

    const lateSink = createSinkFixture();
    flow.attach(lateSink.sink);
    expect(lateSink.frames).toHaveLength(0);
    expect(lateSink.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'source failed' }));

    handle.acknowledge(sinkFixture.frames[0]!.sequence);

    expect(sinkFixture.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'source failed' }));
  });
});
