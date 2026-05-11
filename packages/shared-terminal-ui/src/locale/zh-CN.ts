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
  'shared-terminal-ui': {
    tab: {
      label: '共享终端',
      description: '查看共享会话、生成邀请链接，并控制本地录制。',
    },
    panel: {
      title: '共享终端',
      unavailable: '当前运行环境没有可用的共享终端服务。',
    },
    invite: {
      create: '邀请',
      copy: '复制链接',
    },
    sessions: {
      title: '会话',
      description: '可通过邀请链接镜像的活跃 PTY 会话。',
      empty: '暂无活跃共享 PTY 会话。',
      participants: '{0} 个参与者',
      driver: 'Driver {0}',
    },
    recording: {
      active: '录制中',
      start: '录制',
      stop: '停止',
    },
    'session-state': {
      idle: '空闲',
      active: '活跃',
      recording: '录制中',
      closed: '已关闭',
    },
    driver: {
      label: '当前操作者：{0}',
      none: '无',
      locked: '已锁定',
      typing: '输入中',
      'other-writers': '另有 {0} 个可写参与者',
      take: '接管键盘',
      release: '让出键盘',
      lock: '锁定为我',
      unlock: '解锁',
    },
  },
};

export default locale;
