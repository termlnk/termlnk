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

const locale = {
  'port-forwarding-ui': {
    menu: {
      title: '端口转发',
    },
    list: {
      empty: '暂无端口转发规则。点击「+」创建第一条规则。',
      newLocal: '本地转发',
      newRemote: '远程转发',
      newDynamic: '动态转发',
    },
    editor: {
      title: '端口转发',
      typeLocal: '本地',
      typeRemote: '远程',
      typeDynamic: '动态',
      label: '标签',
      localPort: '本地端口',
      remotePort: '远程端口',
      bindAddress: '监听地址',
      bindAddressRemoteTip: '若要绑定所有网卡（0.0.0.0）以允许外部访问，需在远程服务器的 sshd_config 中将 GatewayPorts 设为 yes 或 clientspecified。',
      intermediateHost: '中转主机',
      remoteHost: '远程主机',
      destinationAddress: '目标地址',
      destinationPort: '目标端口',
      addHost: '选择主机',
      removeHost: '移除主机',
    },
    diagram: {
      localMachine: '本机',
      intermediateHost: '中转主机',
      remoteHost: '远程主机',
      target: '目标',
    },
    status: {
      idle: '空闲',
      starting: '启动中',
      authenticating: '认证中',
      active: '活跃',
      failed: '失败',
      stopping: '停止中',
      closed: '已关闭',
    },
    action: {
      start: '启动',
      stop: '停止',
      restart: '重启',
      edit: '编辑',
      delete: '删除',
      save: '保存',
      cancel: '取消',
      create: '创建',
    },
    auth: {
      connectionFailed: '连接已失败，请关闭此对话框后重试。',
      hostKey: {
        unknownTitle: '未知的主机密钥',
        unknownSubtitle: '此服务器的身份尚未验证过。请确认指纹后再信任该服务器。',
        changedTitle: '主机密钥已更改',
        changedSubtitle: '检测到潜在的安全风险。服务器可能已重新安装，或连接可能被拦截。',
        algorithm: '算法',
        fingerprint: '指纹',
        previousFingerprint: '原指纹',
        addAndContinue: '添加并继续',
        replace: '替换并继续',
        acceptOnce: '仅本次接受',
        reject: '取消',
      },
      keyboardInteractive: {
        title: '需要认证',
        submit: '提交',
        cancel: '取消',
      },
      changePassword: {
        title: '需要更改密码',
        placeholder: '新密码',
      },
    },
    confirm: {
      delete: {
        title: '删除转发规则',
        description: '此操作无法撤销。',
      },
    },
  },
};

export default locale;
