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
  'auth-ui': {
    welcome: {
      title: '欢迎使用 Termlnk',
      subtitle: '登录或注册，同步你的主机与配置。',
    },
    switch: {
      'to-register-prompt': '还没有账号？',
      'to-register-action': '注册',
      'to-login-prompt': '已有账号？',
      'to-login-action': '登录',
    },
    login: {
      email: '邮箱',
      'email-placeholder': 'you@example.com',
      password: '密码',
      'password-placeholder': '请输入你的密码',
      'trust-banner': '密码仅在本机派生，不会发送到服务器。',
      'remember-me': '在本设备保持登录',
      submit: '登录',
      submitting: '登录中…',
      google: '使用 Google 继续',
      'or-divider': '或',
    },
    vault: {
      'setup-title': '设置加密密码',
      'setup-subtitle': '此密码用于端到端加密你的同步数据。它独立于你的 Google 账号，一旦遗失将无法恢复。',
      'unlock-title': '解锁你的数据',
      'unlock-subtitle': '输入加密密码以在本设备上解密你的同步数据。',
      password: '加密密码',
      'password-placeholder': '至少 {0} 个字符',
      confirm: '确认密码',
      'confirm-placeholder': '再次输入密码',
      'too-short': '请至少使用 {0} 个字符。',
      mismatch: '两次输入的密码不一致。',
      warning: '如果忘记此密码，你的同步数据将无法恢复。',
      'setup-submit': '设置密码并继续',
      'unlock-submit': '解锁',
      submitting: '处理中…',
      'sign-out': '改为退出登录',
    },
    register: {
      email: '邮箱',
      'email-placeholder': 'you@example.com',
      'display-name': '显示名称',
      'display-name-placeholder': '希望我们怎么称呼你？',
      'display-name-hint': '可选。留空时用邮箱前缀显示。',
      password: '密码',
      'password-placeholder': '至少 {0} 位',
      'password-hint': '此密码用于派生所有同步数据的加密密钥。一旦遗忘无法找回。',
      'password-too-short': '密码至少需要 {0} 位。',
      'password-mismatch': '两次输入的密码不一致。',
      confirm: '确认密码',
      submit: '注册',
      submitting: '注册中…',
    },
    account: {
      'email-verified': '邮箱已验证',
      'email-unverified': '邮箱未验证',
      'joined-at': '加入于 {0}',
      logout: '退出登录',
      'logging-out': '退出中…',
    },
    'account-dialog': {
      title: '账号',
      'tooltip-login': '登录 / 注册',
      'tooltip-account': '账号',
      'sync-title': '云同步',
      'sync-description': '同步引擎的运行状态及各资源的同步进度',
    },
    gate: {
      'unavailable-title': '云同步未配置',
      'unavailable-detail': '当前版本未连接云端服务；服务可用后将在此处出现登录入口。',
    },
    'change-password': {
      title: '修改密码',
      subtitle: '更新你的账号密码。其他所有设备将被退出登录。',
      current: '当前密码',
      'current-placeholder': '输入当前密码',
      new: '新密码',
      'new-placeholder': '至少 {0} 个字符',
      confirm: '确认新密码',
      'confirm-placeholder': '再次输入新密码',
      'too-short': '密码至少需要 {0} 个字符。',
      mismatch: '两次输入的密码不一致。',
      warning: '修改密码后，所有其他设备将被登出。它们需要使用新密码重新登录。',
      submit: '修改密码',
      submitting: '修改中…',
      success: '密码修改成功。',
    },
    devices: {
      title: '已登录设备',
      description: '当前账号下的所有已登录设备。如果有不认识的设备，请立即撤销。',
      refresh: '刷新',
      empty: '暂无已登录设备。',
      'this-device': '当前设备',
      'unnamed-device': '未命名设备',
      'last-seen': '最近活跃 {0}',
      created: '加入于 {0}',
      revoke: '撤销',
      revoking: '撤销中…',
      cancel: '取消',
      'revoke-confirm-title': '撤销该设备？',
      'revoke-confirm-current': '"{0}" 是你正在使用的设备。撤销后会很快被登出。',
      'revoke-confirm-other': '"{0}" 将被强制登出，下次刷新时需要重新登录。',
      'gated-hint': '登录后可管理设备列表。',
      time: {
        'just-now': '刚刚',
        'minutes-ago': '{0} 分钟前',
        'hours-ago': '{0} 小时前',
        'days-ago': '{0} 天前',
      },
    },
  },
};
