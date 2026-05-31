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
      owner: '擁有者',
      'co-pilot': '編輯者',
      observer: '觀看者',
    },
    'join-dialog': {
      title: '收到多人協作邀請',
      description: '有人邀請你加入終端會話。請在加入前檢查邀請詳情。',
      'session-label': '會話',
      'role-label': '角色',
      'expires-label': '到期時間',
      'copy-url': '複製 URL',
      join: '加入會話',
      joining: '正在加入...',
      dismiss: '關閉',
      unparsable: '無法解析此邀請連結。請發起方重新發送。',
      'join-failed': '加入會話失敗：',
      'error-invite-not-active': '這個邀請連結已經被使用或已失效。請讓主機重新發送新的邀請連結。',
    },
    remote: {
      'tab-name': '共享會話',
      'viewing-only': '僅旁觀',
      driving: '控制中',
      'waiting-for-frames': '等待主機的首批輸出…',
      'read-only-hint': '你以旁觀者身分加入。點擊「申請鍵盤」可申請控制權。',
      'driver-hint': '你正在控制鍵盤。鍵入的命令會在主機終端上執行，點擊「讓出鍵盤」可交回控制權。',
      'request-keyboard': '申請鍵盤',
      'release-keyboard': '讓出鍵盤',
      'view-only-badge': '唯讀分享',
      'view-only-hint': '主機以唯讀模式分享此會話。如需輸入，請聯絡主機切換為「允許輸入」模式。',
      popover: {
        'aria-label': '共享會話控制',
      },
      state: {
        pairing: '正在與主機配對…',
        connecting: '正在連接中繼…',
        connected: '已連接',
        disconnected: '已斷開',
        error: '連線錯誤',
        idle: '等待加入…',
      },
      toast: {
        'self-acquired': '你已取得控制權，開始輸入。',
        released: '鍵盤已釋放。',
        'taken-by-other': '其他人正在控制終端。',
      },
    },
  },
};

export default locale;
