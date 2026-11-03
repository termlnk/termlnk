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
    panel: { title: '浏览器' },
    'new-tab': '新标签页',
    back: '后退',
    forward: '前进',
    reload: '刷新',
    'open-external': '在系统浏览器中打开',
    'address-placeholder': '搜索或输入地址',
    empty: '没有打开的标签页',
    shortcuts: { toggle: '切换浏览器' },
  },
};

export default locale;
