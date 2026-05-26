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
    'invite-role': {
      owner: '拥有者',
      'co-pilot': '编辑者',
      observer: '观看者',
    },
    'join-dialog': {
      title: '收到多人协作邀请',
      description: '有人邀请你加入终端会话。请在加入前检查邀请详情。',
      'session-label': '会话',
      'role-label': '角色',
      'expires-label': '到期时间',
      'copy-url': '复制 URL',
      join: '加入会话',
      dismiss: '关闭',
      unparsable: '无法解析此邀请链接。请发起方重新发送。',
      'join-failed': '加入会话失败：',
    },
    remote: {
      'tab-name': '共享会话',
      'viewing-only': '仅旁观',
      driving: '控制中',
      'waiting-for-frames': '等待主机的首批输出…',
      'read-only-hint': '你以旁观者身份加入。点击"申请键盘"可申请控制权。',
      'driver-hint': '你正在控制键盘。键入的命令会在主机终端上执行，点击"让出键盘"可交回控制权。',
      'request-keyboard': '申请键盘',
      'release-keyboard': '让出键盘',
      popover: {
        'aria-label': '共享会话控制',
      },
      state: {
        pairing: '正在与主机配对…',
        connecting: '正在连接中继…',
        connected: '已连接',
        disconnected: '已断开',
        error: '连接错误',
        idle: '等待加入…',
      },
    },
  },
};

export default locale;
