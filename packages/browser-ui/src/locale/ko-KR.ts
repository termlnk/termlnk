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

import type enUS from './en-US';

const locale: typeof enUS = {
  'browser-ui': {
    panel: { title: '브라우저' },
    'new-tab': '새 탭',
    back: '뒤로',
    forward: '앞으로',
    reload: '새로고침',
    'open-external': '시스템 브라우저에서 열기',
    'address-placeholder': '검색 또는 주소 입력',
    empty: '열린 탭 없음',
    shortcuts: { toggle: '브라우저 전환' },
  },
};

export default locale;
