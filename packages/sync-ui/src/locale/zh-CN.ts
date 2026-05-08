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
      'sync-now': '立即同步',
      'force-resync': '从头同步',
      'force-resync-hint': '清空游标重新拉取全部数据。怀疑本地落后或数据损坏时使用。',
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
  },
};
