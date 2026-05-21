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
      title: '云同步',
      'toggle-label': '同步',
      'sync-now': '立即同步',
      'never-synced': '从未同步',
      'just-now': '刚刚同步过',
      'minutes-ago': '{0} 分钟前同步',
      'hours-ago': '{0} 小时前同步',
      'days-ago': '{0} 天前同步',
      pending: '{0} 项待推送',
    },
    state: {
      idle: '已同步',
      syncing: '同步中',
      offline: '离线',
      error: '错误',
      disabled: '未启用',
      'pending-push': '等待推送（{0} 项）',
    },
    error: {
      unauthenticated: '需要登录后同步',
      master_key_locked: '主密钥已锁定',
      network: '网络错误',
      rate_limited: '服务端限流',
      protocol_mismatch: '客户端/服务端协议不匹配',
      cipher_mismatch: '解密失败',
      server_error: '服务端错误',
      unknown: '未知错误',
    },
    backup: {
      title: '加密备份',
      description: '把主机、设置、AI Provider、MCP 服务器和 Skill 导出为单个加密文件，可在另一台设备还原。需先解锁主密钥。',
      'locked-hint': '请先登录——加密备份需要从主密码派生的 master key 才能加解密。',
      export: '导出…',
      import: '还原…',
      exporting: '加密并写入备份文件…',
      importing: '读取并解密备份文件…',
      'export-success': '备份已成功写入：',
      'import-success': '备份还原完成：',
      'counts-summary': '共 {0} 条记录',
      'import-confirm-title': '从加密备份还原？',
      'import-confirm-description': '此操作将清空当前所有的主机、配置、AI Provider、MCP 服务器和 Skill，并替换为备份文件中的内容，无法撤销。',
      'import-confirm-action': '替换并还原',
      cancel: '取消',
    },
  },
};
