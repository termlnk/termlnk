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
        hostChain: '跳板机',
        advanced: '高级设置',
      },
      field: {
        label: '名称',
        addr: '地址',
        port: '端口',
        username: '用户名',
        password: '密码',
        privateKey: '私钥',
        passwordKeepBlank: '留空保留当前密码',
        privateKeyKeepBlank: '留空保留当前私钥',
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
      hostChain: {
        title: '跳板链',
        description: '依次经过下列跳板主机连接到目标。',
        usage: '{0} / {1}',
        localNode: '本地',
        targetNode: '目标',
        targetUnnamed: '当前主机',
        addPlaceholder: '添加跳板机',
        searchPlaceholder: '搜索主机名或地址...',
        noMatches: '没有匹配的主机',
        empty: '尚未配置跳板机，将直接连接到目标。',
        loading: '加载主机列表...',
        noAvailable: '没有可用的主机',
        maxReached: '已达跳板链最大深度（{0}）',
        missing: '主机已删除',
        dragHandle: '拖动以重排顺序',
        removeBastion: '移除该跳板',
      },
      delete: {
        title: '删除主机',
        confirm: '删除',
        cancel: '取消',
        message: '确定要删除 "{0}" 吗？',
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
        hostChainMaxDepth: '跳板链深度超过限制',
        hostChainSelfRef: '不能将自己作为跳板机',
        hostChainDuplicate: '跳板链中存在重复主机',
      },
    },
    connection: {
      step: {
        connect: '连接',
        chain: '跳板',
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
        viaHop: '经由 {0}',
      },
      fingerprint: {
        title: '{0} 的指纹已更改',
        subtitle: '检测到潜在的安全风险。',
        label: '新的 {0} 指纹为',
      },
      hop: {
        connecting: '正在连接跳板 {0} ({1}/{2})...',
        authenticating: '跳板 {0} 认证中 ({1}/{2})...',
        failed: '跳板 {0} 连接失败：{1}',
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
      'apply-error-fix': '应用 AI 错误修复建议',
      'close-active-tab': '关闭当前标签',
      'create-new-host': '新建主机',
      'delete-host': '删除主机',
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
    multiplayer: {
      tooltip: '多人协作',
      title: '多人协作',
      'copy-link': '复制链接',
      stop: '停止协作',
      'hint-empty': '复制链接以共享当前终端会话。加入者将显示在这里。',
      participants: '参与者：',
      you: '我',
      'take-keyboard': '接管键盘',
      'release-keyboard': '收回键盘',
      copied: '已复制',
      'copy-failed': '复制链接失败，请检查网络或登录状态。',
      policy: {
        label: '分享模式',
        'allow-input': '允许输入',
        'allow-input-hint': '加入者可申请控制键盘，同时只允许一人输入。',
        'view-only': '只读',
        'view-only-hint': '加入者只能观看，无法输入。适合演示场景。',
        'locked-hint': '分享期间模式锁定。停止分享后才能切换模式。',
      },
    },
  },
};

export default locale;
