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
  ui: {
    'notification-panel': {
      title: '通知',
      filter: {
        all: '全部',
        unread: '未读',
      },
      actions: {
        'mark-all-read': '全部已读',
        'mark-all-read-title': '全部标记为已读',
        'clear-all-title': '清空所有',
        'mark-read-title': '标记为已读',
        'remove-title': '删除',
      },
      empty: '暂无通知',
      source: {
        prefix: '来自: {0}',
        terminal: '终端',
        system: '系统',
        extension: '扩展',
        application: '应用',
        agent: 'Agent',
      },
      time: {
        'just-now': '刚刚',
        'minutes-ago': '{0}分钟前',
        'hours-ago': '{0}小时前',
        'days-ago': '{0}天前',
      },
      footer: {
        total: '共 {0} 条通知',
        unread: '{0} 条未读',
        'total-with-unread': '共 {0} 条通知，{1} 条未读',
      },
    },
    'notification-icon': {
      title: '通知',
      'unread-title': '{0} 条未读通知',
    },
    'right-sidebar-toggle': {
      'open-title': '打开右侧边栏',
      'close-title': '关闭右侧边栏',
    },
    'left-sidebar-toggle': {
      'open-title': '显示左侧边栏',
      'close-title': '隐藏左侧边栏',
    },
    updater: {
      'dialog-title': '发现新版本',
      'new-version-available': '发现新版本可用',
      'update-ready': '更新已就绪',
      'release-notes': '更新内容',
      'download-update': '下载更新',
      downloading: '下载中...',
      'install-now': '立即安装',
      retry: '重试',
      'manual-update-hint': '发现新版本。请拉取最新 docker 镜像或执行 git pull 进行更新——浏览器部署不支持应用内安装。',
    },
  },
};

export default locale;
