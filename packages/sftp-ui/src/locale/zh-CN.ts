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
    menu: {
      sftp: 'SFTP',
    },
    connection: {
      title: 'SFTP 连接',
      status: {
        connecting: '正在连接...',
        authenticating: '正在认证...',
        opening: '正在打开 SFTP...',
        ready: '已连接',
        error: '连接失败',
      },
      action: {
        close: '关闭',
        retry: '重试',
        continue: '继续',
      },
      password: {
        title: '需要密码',
        placeholder: '请输入密码',
      },
    },
    browser: {
      local: '本地',
      remote: '远程',
      empty: '空目录',
      loading: '加载中...',
      items: '{count} 个项目',
      selected: '已选择 {count} 项',
    },
    file: {
      name: '名称',
      size: '大小',
      modified: '修改时间',
      permissions: '权限',
    },
    action: {
      download: '下载',
      upload: '上传',
      rename: '重命名',
      delete: '删除',
      newFolder: '新建文件夹',
      permissions: '权限',
      refresh: '刷新',
    },
    transfer: {
      title: '传输',
      clearCompleted: '清除已完成',
    },
    dialog: {
      rename: {
        title: '重命名',
      },
      newFolder: {
        title: '新建文件夹',
        placeholder: '文件夹名称',
      },
      permissions: {
        title: '权限',
        owner: '所有者',
        group: '用户组',
        others: '其他',
        read: '读取',
        write: '写入',
        execute: '执行',
        octal: '八进制',
      },
    },
  },
};

export default locale;
