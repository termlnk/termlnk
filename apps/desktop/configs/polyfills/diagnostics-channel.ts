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

const noopChannel = {
  hasSubscribers: false,
  subscribe() {},
  unsubscribe() {},
  publish() {},
  bindStore() {},
  runStores() {},
};

export function channel() {
  return noopChannel;
}

export function tracingChannel() {
  return {
    start: noopChannel,
    end: noopChannel,
    asyncStart: noopChannel,
    asyncEnd: noopChannel,
    error: noopChannel,
    subscribe() {},
    unsubscribe() {},
    hasSubscribers: false,
    traceSync() {},
    tracePromise() {},
    traceCallback() {},
  };
}

export function hasSubscribers() {
  return false;
}

export class Channel {
  hasSubscribers = false;
  subscribe() {}
  unsubscribe() {}
  publish() {}
  bindStore() {}
  runStores() {}
}

export class TracingChannel {
  hasSubscribers = false;
  subscribe() {}
  unsubscribe() {}
}
