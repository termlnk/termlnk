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
  'snippet-ui': {
    menu: {
      snippets: '代码片段',
    },
    explorer: {
      newSnippet: '新建片段',
      newPackage: '新建分组',
      search: '搜索...',
      empty: '暂无代码片段',
    },
    editor: {
      createTitle: '新建代码片段',
      editTitle: '编辑代码片段',
      label: '名称',
      labelPlaceholder: '片段名称',
      description: '描述',
      descriptionPlaceholder: '可选描述',
      package: '分组',
      noPackage: '未分组',
      script: '脚本',
      scriptPlaceholder: '# 在此输入命令',
      targets: '执行目标',
      addTargets: '添加目标',
      searchHost: '搜索主机名或地址...',
      noHosts: '暂无可用主机',
      run: '执行',
      paste: '粘贴',
      cancel: '取消',
      save: '保存',
      create: '创建',
    },
    contextMenu: {
      run: '执行',
      paste: '粘贴',
      edit: '编辑',
      duplicate: '复制',
      moveToPackage: '移至分组',
      delete: '删除',
      deletePackage: '删除分组',
      rename: '重命名',
    },
    confirm: {
      deletePackageDesc: '确定删除分组「{0}」吗？该分组中的所有代码片段也将一并删除。',
      delete: '删除',
      cancel: '取消',
    },
  },
};

export default locale;
