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
      label: '共享終端',
      description: '檢視共享工作階段、產生邀請連結，並控制本機錄製。',
    },
    panel: {
      title: '共享終端',
      unavailable: '目前執行環境沒有可用的共享終端服務。',
    },
    invite: {
      create: '邀請',
      copy: '複製連結',
    },
    sessions: {
      title: '工作階段',
      description: '可透過邀請連結鏡像的活躍 PTY 工作階段。',
      empty: '目前沒有活躍共享 PTY 工作階段。',
      participants: '{0} 位參與者',
      driver: 'Driver {0}',
    },
    recording: {
      active: '錄製中',
      mandatory: '強制錄製中',
      'mandatory-hint': '稽核員在線時錄製為強制狀態，需先移除稽核員才能停止。',
      start: '錄製',
      stop: '停止',
    },
    'session-state': {
      idle: '閒置',
      active: '活躍',
      recording: '錄製中',
      closed: '已關閉',
    },
    driver: {
      label: '目前操作者：{0}',
      none: '無',
      locked: '已鎖定',
      typing: '輸入中',
      'other-writers': '另有 {0} 個可寫入參與者',
      take: '接管鍵盤',
      release: '釋放鍵盤',
      lock: '鎖定為我',
      unlock: '解鎖',
    },
    'recording-policy': {
      title: '錄製策略',
      description: '新協作會話的預設錄製行為。稽核員加入時一律強制開啟錄製。',
      'default-on': '預設開啟錄製',
      'default-on-hint': '每個新協作會話會自動開始錄製。',
    },
    'outstanding-invites': {
      title: '有效邀請',
      description: '仍可使用的邀請連結。撤銷後該連結不再可用。',
      unavailable: '目前執行環境不支援邀請管理。',
      empty: '目前沒有有效的邀請。',
    },
    'invite-history': {
      title: '邀請歷史',
      description: '已兌換、已撤銷、已過期的邀請紀錄。',
      empty: '尚無歷史邀請。',
    },
    'invite-row': {
      'single-use': '單次使用',
      session: '會話 {0}',
      'expires-at': '到期時間 {0}',
      'expired-at': '已於 {0} 過期',
      'consumed-at': '已於 {0} 使用',
      'revoked-at': '已於 {0} 撤銷',
      revoke: '撤銷',
    },
    'invite-status': {
      active: '有效',
      consumed: '已使用',
      revoked: '已撤銷',
      expired: '已過期',
    },
    'invite-role': {
      owner: '主控',
      'co-pilot': '協作者',
      observer: '旁觀者',
      auditor: '稽核員',
    },
  },
};

export default locale;
