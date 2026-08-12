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
  },
};

export default locale;
