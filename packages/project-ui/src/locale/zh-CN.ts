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
      title: '资源管理器',
      empty: '打开本地终端或 ACP 会话以浏览文件。',
      filter: '筛选文件…',
      refresh: '刷新',
    },
    git: {
      title: 'Git',
      empty: '无项目上下文。',
      'not-a-repo': '不是 Git 仓库。',
      staged: '已暂存',
      changes: '更改',
      stage: '暂存',
      unstage: '取消暂存',
      commit: '提交',
      'commit-message': '提交信息',
      diff: '差异',
      'close-diff': '关闭',
    },
    shortcuts: {
      'toggle-explorer': '切换资源管理器',
      'toggle-git': '切换 Git',
    },
  },
};

export default locale;
