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
      start: '錄製',
      stop: '停止',
    },
    'session-state': {
      idle: '閒置',
      active: '活躍',
      recording: '錄製中',
      closed: '已關閉',
    },
  },
};

export default locale;
