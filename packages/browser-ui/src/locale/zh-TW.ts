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
    panel: { title: '瀏覽器' },
    'new-tab': '新分頁',
    back: '上一頁',
    forward: '下一頁',
    reload: '重新整理',
    'open-external': '在系統瀏覽器中開啟',
    'address-placeholder': '搜尋或輸入網址',
    empty: '沒有開啟的分頁',
    shortcuts: { toggle: '切換瀏覽器' },
  },
};

export default locale;
