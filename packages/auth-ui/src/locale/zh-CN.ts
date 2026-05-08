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
    login: {
      email: '邮箱',
      'email-placeholder': 'you@example.com',
      password: '密码',
      'password-placeholder': '主密码',
      'remember-me': '在本设备保持登录',
      submit: '登录',
      submitting: '登录中…',
      'no-account': '还没有账号？',
      'go-register': '立即注册',
    },
    register: {
      email: '邮箱',
      'email-placeholder': 'you@example.com',
      'display-name': '显示名称',
      'display-name-placeholder': '希望我们怎么称呼你？',
      'display-name-hint': '可选。留空时用邮箱前缀显示。',
      password: '主密码',
      'password-placeholder': '至少 {0} 位',
      'password-hint': '此密码用于派生所有同步数据的加密密钥。一旦遗忘无法找回。',
      'password-too-short': '密码至少需要 {0} 位。',
      'password-mismatch': '两次输入的密码不一致。',
      confirm: '确认密码',
      submit: '注册',
      submitting: '注册中…',
      'have-account': '已有账号？',
      'go-login': '直接登录',
    },
    account: {
      'email-verified': '邮箱已验证',
      'email-unverified': '邮箱未验证',
      logout: '退出登录',
      'logging-out': '退出中…',
    },
    gate: {
      'unavailable-title': '云同步未配置',
      'unavailable-detail': '当前版本未连接云端服务；服务可用后将在此处出现登录入口。',
    },
  },
};
