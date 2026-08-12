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
  'project-ui': {
    explorer: {
      title: '資源管理器',
      empty: '開啟本機終端或 ACP 工作階段以瀏覽檔案。',
      filter: '篩選檔案…',
      refresh: '重新整理',
    },
    git: {
      title: 'Git',
      empty: '無專案內容。',
      'not-a-repo': '不是 Git 存放庫。',
      staged: '已暫存',
      changes: '變更',
      stage: '暫存',
      unstage: '取消暫存',
      commit: '提交',
      'commit-message': '提交訊息',
      diff: '差異',
      'close-diff': '關閉',
    },
    shortcuts: {
      'toggle-explorer': '切換資源管理器',
      'toggle-git': '切換 Git',
    },
  },
};

export default locale;
