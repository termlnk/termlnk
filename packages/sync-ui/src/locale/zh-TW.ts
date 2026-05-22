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

export default {
  'sync-ui': {
    status: {
      title: '雲端同步',
      'toggle-label': '同步',
      'sync-now': '立即同步',
      'never-synced': '從未同步',
      'just-now': '剛剛同步過',
      'minutes-ago': '{0} 分鐘前同步',
      'hours-ago': '{0} 小時前同步',
      'days-ago': '{0} 天前同步',
      pending: '{0} 項待推送',
    },
    state: {
      idle: '已同步',
      syncing: '同步中',
      offline: '離線',
      error: '錯誤',
      disabled: '未啟用',
      'pending-push': '等待推送（{0} 項）',
    },
    error: {
      unauthenticated: '需要登入後同步',
      master_key_locked: '主金鑰已鎖定，請重新登入以繼續同步',
      network: '網路錯誤',
      rate_limited: '伺服器限流',
      protocol_mismatch: '客戶端／伺服器協定不匹配',
      cipher_mismatch: '解密失敗',
      server_error: '伺服器錯誤',
      unknown: '未知錯誤',
      action: {
        'sign-in-again': '重新登入',
      },
    },
    backup: {
      title: '加密備份',
      description: '將主機、設定、AI Provider、MCP 伺服器和 Skill 匯出為單一加密檔案，可在另一台裝置還原。需先解鎖主金鑰。',
      'locked-hint': '請先登入——加密備份需要從主密碼派生的 master key 才能加解密。',
      export: '匯出…',
      import: '還原…',
      exporting: '加密並寫入備份檔案…',
      importing: '讀取並解密備份檔案…',
      'export-success': '備份已成功寫入：',
      'import-success': '備份還原完成：',
      'counts-summary': '共 {0} 筆紀錄',
      'import-confirm-title': '從加密備份還原？',
      'import-confirm-description': '此操作將清空目前所有的主機、設定、AI Provider、MCP 伺服器和 Skill，並替換為備份檔案中的內容，無法撤銷。',
      'import-confirm-action': '替換並還原',
      cancel: '取消',
    },
  },
};
