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
  'terminal-ui': {
    menu: {
      host: 'Hosts',
    },
    'hosts-explorer': {
      title: '資源管理器',
      'add-host': '新建主機',
      'add-group': '新建分組',
      refresh: '重新整理',
      'context-menu': {
        rename: '重新命名',
        delete: '刪除',
      },
    },
    'host-dialog': {
      title: {
        create: '建立主機',
        edit: '編輯主機',
      },
      tab: {
        basic: '基本資訊',
        credential: '認證方式',
        proxy: '代理設定',
        hostChain: '跳板機',
        advanced: '進階設定',
      },
      field: {
        label: '名稱',
        addr: '位址',
        port: '連接埠',
        username: '使用者名稱',
        password: '密碼',
        privateKey: '私鑰',
        passwordKeepBlank: '留空保留目前密碼',
        privateKeyKeepBlank: '留空保留目前私鑰',
        parentGroup: '群組',
        rootGroup: '根目錄',
      },
      credential: {
        type: '認證類型',
        password: '密碼認證',
        rsa: '金鑰認證',
        key: '金鑰',
        identity: '身分',
        keyMissing: '所選金鑰已不存在，請重新選擇。',
        identityMissing: '所選身分已不存在，請重新選擇。',
      },
      proxy: {
        enable: '啟用代理',
        type: '代理類型',
        host: '代理位址',
        port: '代理連接埠',
      },
      hostChain: {
        title: '跳板鏈',
        description: '依序經過下列跳板主機連線到目標。',
        usage: '{0} / {1}',
        localNode: '本機',
        targetNode: '目標',
        targetUnnamed: '目前主機',
        addPlaceholder: '新增跳板機',
        searchPlaceholder: '搜尋主機名稱或位址...',
        noMatches: '沒有相符的主機',
        empty: '尚未設定跳板機，將直接連線到目標。',
        loading: '正在載入主機清單...',
        noAvailable: '沒有可用的主機',
        maxReached: '已達跳板鏈最大深度（{0}）',
        missing: '主機已移除',
        dragHandle: '拖曳以重新排序',
        removeBastion: '移除此跳板',
      },
      delete: {
        title: '刪除主機',
        confirm: '刪除',
        cancel: '取消',
        message: '確定要刪除 "{0}" 嗎？',
      },
      advanced: {
        timeout: '連線逾時(ms)',
        heartbeat: '心跳間隔(ms)',
        x11Forward: 'X11 轉發',
        termType: '終端機類型',
        encode: '編碼',
        fontFamily: '字型',
        fontSize: '字型大小',
        fontDefault: '預設',
        runScript: '連線後指令碼',
        runScriptPlaceholder: '# 連線後執行的指令碼',
      },
      btn: {
        test: '測試連線',
        cancel: '取消',
        create: '建立',
        edit: '儲存',
      },
      test: {
        success: '連線成功 ({0}ms)',
        failed: '連線失敗: {0}',
        validationFailed: '請先完善連線資訊',
      },
      validation: {
        labelRequired: '名稱不能為空',
        addrRequired: '位址不能為空',
        addrInvalid: '請輸入有效的 IP 位址或主機名稱',
        portMin: '連接埠最小為 1',
        portMax: '連接埠最大為 65535',
        portInvalid: '連接埠必須為整數',
        usernameRequired: '使用者名稱不能為空',
        privateKeyRequired: '私鑰不能為空',
        keyRequired: '請選擇一個金鑰',
        identityRequired: '請選擇一個身分',
        proxyHostRequired: '代理位址不能為空',
        proxyPortRequired: '代理連接埠不能為空',
        timeoutMin: '連線逾時最小為 1000ms',
        heartbeatMin: '心跳間隔最小為 1000ms',
        fontSizeMin: '字型大小最小為 8',
        fontSizeMax: '字型大小最大為 24',
        hostChainMaxDepth: '跳板鏈深度超過上限',
        hostChainSelfRef: '不能將自己作為跳板機',
        hostChainDuplicate: '跳板鏈中存在重複主機',
      },
    },
    connection: {
      step: {
        connect: '連線',
        chain: '跳板',
        verify: '驗證',
        shell: '終端機',
      },
      status: {
        connecting: '正在建立連線...',
        authenticating: '握手完成，正在認證...',
        openingShell: '正在啟動終端機...',
        auth: '需要認證。',
        authFailed: '認證失敗，請重試。',
        ready: '正在啟動終端機...',
        error: '連線失敗',
      },
      action: {
        close: '關閉',
        retry: '重試',
        continue: '繼續',
        replace: '取代',
        addNew: '作為新指紋新增',
        cancel: '取消',
      },
      password: {
        title: '密碼',
        placeholder: '請輸入密碼',
        remember: '儲存此主機密碼',
        viaHop: '經由 {0}',
      },
      fingerprint: {
        unknown: {
          title: '未知的主機金鑰',
          subtitle: '此前從未驗證過該伺服器的身分。請在信任前確認指紋。',
        },
        changed: {
          title: '主機金鑰已變更',
          subtitle: '偵測到潛在的安全風險。伺服器可能被重新安裝，或連線可能被攔截。',
        },
      },
      hop: {
        connecting: '正在連線跳板 {0} ({1}/{2})...',
        authenticating: '跳板 {0} 認證中 ({1}/{2})...',
        failed: '跳板 {0} 連線失敗：{1}',
      },
      logs: {
        title: '連線記錄',
      },
    },
    drop: {
      hint: '拖放檔案以貼上路徑',
    },
    keychain: {
      title: '金鑰鏈',
      tab: {
        keys: '金鑰',
        identities: '身分',
      },
      action: {
        newKey: '新增金鑰',
        generate: '產生金鑰',
        newIdentity: '新增身分',
        reveal: '顯示私鑰',
        cancel: '取消',
        save: '儲存',
      },
      empty: {
        keys: '尚無金鑰。產生或匯入一個 SSH 金鑰。',
        identities: '尚無身分。',
      },
      field: {
        label: '名稱',
        algorithm: '金鑰類型',
        bits: '位數',
        publicKey: '公鑰',
        privateKey: '私鑰',
        passphrase: '金鑰密語',
        savePassphrase: '儲存密語',
        cipher: '加密演算法',
        rounds: 'KDF 輪數',
        roundsHelp: '輪數越高，私鑰保護越強，但密語驗證越慢。',
        certificate: '憑證（選填）',
        username: '使用者名稱',
        password: '密碼',
        key: '金鑰',
        noKey: '不使用金鑰',
      },
      key: {
        generateTitle: '產生金鑰',
        newKeyTitle: '新增金鑰',
        editTitle: '編輯金鑰',
      },
      identity: {
        newTitle: '新增身分',
        editTitle: '編輯身分',
        keyMissing: '所選金鑰已不存在。',
      },
    },
    knownHosts: {
      title: '已知主機',
      empty: '尚無已知主機。首次連線後會記住主機金鑰。',
      action: {
        clearAll: '清除全部',
      },
      detail: {
        title: '主機金鑰詳情',
        host: '主機',
        port: '連接埠',
        keyType: '金鑰類型',
        fingerprint: '指紋',
        publicKey: '公鑰',
        close: '關閉',
      },
    },
    progress: {
      title: '終端機進度',
      source: 'OSC 9;4',
      indeterminateValue: '--',
      state: {
        running: '進行中',
        error: '錯誤',
        indeterminate: '無法確定',
        paused: '已暫停',
      },
    },
    group: {
      'default-name': '新建群組',
    },
    shortcuts: {
      'apply-error-fix': '套用 AI 錯誤修復建議',
      'close-active-tab': '關閉目前分頁',
      'create-new-host': '建立新主機',
      'delete-host': '刪除主機',
      'maximize-session': '最大化/還原工作階段',
      'open-local-terminal': '新建本機終端機',
      'select-tab': '按序號選擇分頁',
      'split-down': '向下分割',
      'split-right': '向右分割',
    },
    pane: {
      'split-right': '向右分割',
      'split-down': '向下分割',
      maximize: '最大化',
      restore: '還原',
      close: '關閉',
    },
    'tab-bar': {
      'new-session': '新建終端機',
      'close-session': '關閉終端機',
      'tab-list': '顯示分頁清單',
    },
    multiplayer: {
      tooltip: '多人協作',
      title: '多人協作',
      'copy-link': '複製連結',
      stop: '停止協作',
      'hint-empty': '複製連結以共享目前終端會話。加入者會顯示在這裡。',
      participants: '參與者：',
      you: '我',
      'take-keyboard': '接管鍵盤',
      'release-keyboard': '收回鍵盤',
      copied: '已複製',
      copying: '複製中...',
      'copy-failed': '複製連結失敗，請檢查網路或登入狀態。',
      policy: {
        label: '分享模式',
        'allow-input': '允許輸入',
        'allow-input-hint': '加入者可申請控制鍵盤，同時只允許一人輸入。',
        'view-only': '唯讀',
        'view-only-hint': '加入者只能觀看，無法輸入。適合示範場景。',
      },
    },
  },
};

export default locale;
