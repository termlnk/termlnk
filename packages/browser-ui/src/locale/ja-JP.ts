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
    panel: { title: 'ブラウザ' },
    'new-tab': '新しいタブ',
    back: '戻る',
    forward: '進む',
    reload: '再読み込み',
    'open-external': 'システムブラウザで開く',
    'address-placeholder': '検索または URL を入力',
    empty: '開いているタブはありません',
    shortcuts: { toggle: 'ブラウザを切り替え' },
  },
};

export default locale;
