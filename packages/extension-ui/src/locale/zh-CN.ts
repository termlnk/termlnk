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
  'extension-ui': {
    menu: {
      extensions: '扩展',
    },
    action: {
      loadLocal: '加载本地扩展',
      refresh: '刷新',
      enable: '启用',
      disable: '禁用',
      uninstall: '卸载',
      remove: '移除',
      reload: '重新加载',
      selectDirectory: '选择扩展目录',
      installFromNpm: '从 npm 安装',
    },
    empty: '暂无已安装的扩展',
    status: {
      activated: '已激活',
      disabled: '已禁用',
      error: '错误',
      installed: '已安装',
    },
    tab: {
      installed: '已安装',
      marketplace: '市场',
    },
    marketplace: {
      search: '搜索市场...',
      install: '安装',
      installed: '已安装',
      installing: '安装中',
      loadFailed: '加载市场失败',
      empty: '暂无可用扩展',
      emptyHint: '点击头部的下载按钮可直接从 npm 安装。',
      installs: '{0} 次安装',
    },
    dialog: {
      installFromNpm: {
        title: '从 npm 安装扩展',
        extensionId: '扩展 ID',
        packageName: 'NPM 包名',
        version: '版本',
        submit: '安装',
        cancel: '取消',
      },
    },
  },
};

export default locale;
