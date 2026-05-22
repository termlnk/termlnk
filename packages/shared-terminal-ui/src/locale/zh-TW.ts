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
      owner: '主控',
      'co-pilot': '協作者',
      observer: '旁觀者',
    },
    'join-dialog': {
      title: '收到多人協作邀請',
      description: '有人邀請你加入終端會話。請在加入前檢查邀請詳情。',
      'session-label': '會話',
      'role-label': '角色',
      'expires-label': '到期時間',
      'copy-url': '複製 URL',
      join: '加入會話',
      dismiss: '關閉',
      unparsable: '無法解析此邀請連結。請發起方重新發送。',
      'join-failed': '加入會話失敗：',
    },
    remote: {
      'viewing-only': '唯讀旁觀',
      'waiting-for-frames': '等待主機的首批輸出…',
      'read-only-hint': '你以旁觀者身分加入。點擊主機面板的「取鍵盤」按鈕可申請駕駛權。',
      state: {
        pairing: '正在與主機配對…',
        connecting: '正在連接中繼…',
        connected: '已連接',
        disconnected: '已斷開',
        error: '連線錯誤',
      },
    },
  },
};

export default locale;
