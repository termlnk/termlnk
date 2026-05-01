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
      title: '资源管理器',
      'add-host': '新建主机',
      'add-group': '新建分组',
      refresh: '刷新',
      'context-menu': {
        rename: '重命名',
        delete: '删除',
      },
    },
    'host-dialog': {
      title: {
        create: '创建主机',
        edit: '编辑主机',
      },
      tab: {
        basic: '基本信息',
        credential: '认证方式',
        proxy: '代理设置',
        advanced: '高级设置',
      },
      field: {
        label: '名称',
        addr: '地址',
        port: '端口',
        username: '用户名',
        password: '密码',
        privateKey: '私钥',
        parentGroup: '分组',
        rootGroup: '根目录',
      },
      credential: {
        type: '认证类型',
        password: '密码认证',
        rsa: '密钥认证',
      },
      proxy: {
        enable: '启用代理',
        type: '代理类型',
        host: '代理地址',
        port: '代理端口',
      },
      advanced: {
        timeout: '连接超时(ms)',
        heartbeat: '心跳间隔(ms)',
        x11Forward: 'X11 转发',
        termType: '终端类型',
        encode: '编码',
        fontFamily: '字体',
        fontSize: '字体大小',
        fontDefault: '默认',
        runScript: '连接后脚本',
        runScriptPlaceholder: '# 连接后执行的脚本',
      },
      btn: {
        test: '测试连接',
        cancel: '取消',
        create: '创建',
        edit: '保存',
      },
      test: {
        success: '连接成功 ({0}ms)',
        failed: '连接失败: {0}',
        validationFailed: '请先完善连接信息',
      },
      validation: {
        labelRequired: '名称不能为空',
        addrRequired: '地址不能为空',
        addrInvalid: '请输入有效的 IP 地址或主机名',
        portMin: '端口号最小为 1',
        portMax: '端口号最大为 65535',
        portInvalid: '端口号必须为整数',
        usernameRequired: '用户名不能为空',
        privateKeyRequired: '私钥不能为空',
        proxyHostRequired: '代理地址不能为空',
        proxyPortRequired: '代理端口不能为空',
        timeoutMin: '连接超时最小为 1000ms',
        heartbeatMin: '心跳间隔最小为 1000ms',
        fontSizeMin: '字体大小最小为 8',
        fontSizeMax: '字体大小最大为 24',
      },
    },
    connection: {
      step: {
        connect: '连接',
        verify: '验证',
        shell: '终端',
      },
      status: {
        connecting: '正在建立连接...',
        authenticating: '握手完成，正在认证...',
        openingShell: '正在启动终端...',
        auth: '需要认证。',
        authFailed: '认证失败，请重试。',
        ready: '正在启动终端...',
        error: '连接失败',
      },
      action: {
        close: '关闭',
        retry: '重试',
        continue: '继续',
        replace: '替换',
        addNew: '作为新指纹添加',
        cancel: '取消',
      },
      password: {
        title: '密码',
        placeholder: '请输入密码',
        remember: '保存此主机密码',
      },
      fingerprint: {
        title: '{0} 的指纹已更改',
        subtitle: '检测到潜在的安全风险。',
        label: '新的 {0} 指纹为',
      },
      logs: {
        title: '连接日志',
      },
    },
    drop: {
      hint: '拖放文件以粘贴路径',
    },
    progress: {
      title: '终端进度',
      source: 'OSC 9;4',
      indeterminateValue: '--',
      state: {
        running: '进行中',
        error: '错误',
        indeterminate: '无法确定',
        paused: '已暂停',
      },
    },
    group: {
      'default-name': '新建分组',
    },
    shortcuts: {
      'close-active-tab': '关闭当前标签',
      'create-new-host': '新建主机',
      'maximize-session': '最大化/还原会话',
      'open-local-terminal': '新建本地终端',
    },
    pane: {
      'split-right': '向右分屏',
      'split-down': '向下分屏',
      maximize: '最大化',
      restore: '还原',
      close: '关闭',
    },
    'tab-bar': {
      'new-session': '新建终端',
      'close-session': '关闭终端',
      'tab-list': '显示标签列表',
    },
  },
};

export default locale;
