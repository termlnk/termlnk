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

import { describe, expect, it } from 'vitest';
import { HTTPParams } from '../params';

describe('test class HTTPParams', () => {
  it('should support empty params', () => {
    const params = new HTTPParams();
    expect(params.toString()).toBe('');
  });

  it('should support single params', () => {
    const params = new HTTPParams({ key: 'value' });
    expect(params.toString()).toBe('key=value');
  });

  it('should support multiple params', () => {
    const params = new HTTPParams({ key1: 'value1', key2: 'value2' });
    expect(params.toString()).toBe('key1=value1&key2=value2');
  });

  it('should support array params', () => {
    const params = new HTTPParams({ key: ['value1', 'value2'] });
    expect(params.toString()).toBe('key=value1&key=value2');
  });
});
