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
  'acp-ui': {
    'new-session': {
      'local-terminal': '新建本地终端',
      agents: 'AI Agent',
      'on-demand': '按需下载',
      'manage-agents': '管理 Agent…',
    },
    session: {
      stop: '停止',
      connecting: '连接中…',
      'message-placeholder': '向 Agent 发送消息…',
    },
    launch: {
      'failed-title': '无法启动 {0}',
      'failed-body-title': 'Agent 启动失败',
      retry: '重试',
    },
    settings: {
      tab: 'Agent',
      'tab-description': '支持 Agent Client Protocol 的编码 Agent。',
      providers: 'Providers',
      'no-providers': '尚未配置任何 Provider。',
      'add-provider': '添加 Provider',
      'search-providers': '搜索 providers',
      'no-matches': '没有匹配的结果。',
      'install-guide': '安装说明',
      add: '添加',
      remove: '移除',
      'model-count': '{0} 个 Model',
      status: {
        available: '可用',
        'on-demand': '首次运行时下载',
        'not-installed': '未安装',
        disabled: '已禁用',
      },
      'search-models': '搜索 Models',
      discovered: '已发现',
      'no-models': '该 Agent 未声明任何 Model。',
      'not-probed': '点击刷新以询问该 Agent 支持哪些能力。',
      'add-model': '添加 Model',
      'model-id-placeholder': '例如 anthropic/claude-opus-5',
      diagnose: '诊断',
      refresh: '刷新',
      'updated-at': '已更新 {0}',
      'just-now': '刚刚',
      'minutes-ago': '{0} 分钟前',
      'hours-ago': '{0} 小时前',
      'days-ago': '{0} 天前',
    },
  },
};

export default locale;
