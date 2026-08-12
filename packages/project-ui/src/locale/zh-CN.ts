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
      title: '文件',
      empty: '打开本地终端或 ACP 会话以浏览文件。',
      filter: '筛选文件…',
      refresh: '刷新',
      'show-hidden': '显示隐藏文件',
      'hide-hidden': '隐藏隐藏文件',
    },
    changes: {
      title: '变更',
      uncommitted: '未提交 {0} 个',
      clean: '没有变更。',
      'no-diff': '没有文本差异。',
      'staged-count': '已暂存 {0} 个',
      'switch-branch': '切换分支',
      'collapse-all': '全部折叠',
      'expand-all': '全部展开',
      'view-flat': '平铺列表',
      'view-tree': '树形',
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
