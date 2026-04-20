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
  'sftp-ui': {
    menu: { sftp: 'SFTP' },
    connection: {
      title: 'SFTP 連線',
      status: { connecting: '正在連線...', authenticating: '正在認證...', opening: '正在開啟 SFTP...', ready: '已連線', error: '連線失敗' },
      action: { close: '關閉', retry: '重試', continue: '繼續' },
      password: { title: '需要密碼', placeholder: '請輸入密碼' },
    },
    browser: { local: '本機', remote: '遠端', empty: '空目錄', loading: '載入中...', items: '{count} 個項目', selected: '已選擇 {count} 項' },
    file: { name: '名稱', size: '大小', modified: '修改時間', permissions: '權限' },
    action: { download: '下載', upload: '上傳', rename: '重新命名', delete: '刪除', newFolder: '新建資料夾', permissions: '權限', refresh: '重新整理' },
    transfer: { title: '傳輸', clearCompleted: '清除已完成' },
    dialog: {
      rename: { title: '重新命名' },
      newFolder: { title: '新建資料夾', placeholder: '資料夾名稱' },
      permissions: { title: '權限', owner: '擁有者', group: '使用者群組', others: '其他', read: '讀取', write: '寫入', execute: '執行', octal: '八進位' },
    },
  },
};

export default locale;
