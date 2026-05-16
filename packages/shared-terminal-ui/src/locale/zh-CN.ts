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
      mandatory: '强制录制中',
      'mandatory-hint': '审计员在线时录制为强制状态，需先移除审计员才能停止。',
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
    'recording-policy': {
      title: '录制策略',
      description: '新协作会话的默认录制行为。审计员加入时始终强制开启录制。',
      'default-on': '默认开启录制',
      'default-on-hint': '每个新协作会话将自动开始录制。',
    },
    'outstanding-invites': {
      title: '有效邀请',
      description: '仍可兑换的邀请链接。撤销后该链接不再可用。',
      unavailable: '当前运行环境不支持邀请管理。',
      empty: '当前没有有效邀请。',
    },
    'invite-history': {
      title: '邀请历史',
      description: '已兑换、已撤销、已过期的邀请记录。',
      empty: '暂无历史邀请。',
    },
    'invite-row': {
      'single-use': '单次使用',
      session: '会话 {0}',
      'expires-at': '过期时间 {0}',
      'expired-at': '已于 {0} 过期',
      'consumed-at': '已于 {0} 兑换',
      'revoked-at': '已于 {0} 撤销',
      revoke: '撤销',
    },
    'invite-status': {
      active: '有效',
      consumed: '已兑换',
      revoked: '已撤销',
      expired: '已过期',
    },
    'invite-role': {
      owner: '主控',
      'co-pilot': '协作者',
      observer: '旁观者',
      auditor: '审计员',
    },
  },
};

export default locale;
