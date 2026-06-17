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
      snippets: 'スニペット',
    },
    explorer: {
      newSnippet: '新規スニペット',
      newPackage: '新規パッケージ',
      search: '検索...',
      empty: 'スニペットはありません',
    },
    editor: {
      createTitle: '新規スニペット',
      editTitle: 'スニペットを編集',
      label: '名前',
      labelPlaceholder: 'スニペット名',
      description: '説明',
      descriptionPlaceholder: '任意の説明',
      package: 'パッケージ',
      noPackage: 'パッケージなし',
      script: 'スクリプト',
      scriptPlaceholder: '# コマンドを入力',
      targets: '実行対象',
      addTargets: '対象を追加',
      run: '実行',
      paste: '貼り付け',
      cancel: 'キャンセル',
      save: '保存',
      create: '作成',
    },
    contextMenu: {
      run: '実行',
      paste: '貼り付け',
      edit: '編集',
      duplicate: '複製',
      moveToPackage: 'パッケージに移動',
      delete: '削除',
      deletePackage: 'パッケージを削除',
      rename: '名前変更',
    },
    confirm: {
      deletePackageDesc: 'パッケージ「{0}」を削除しますか？パッケージ内のすべてのスニペットも削除されます。',
      delete: '削除',
      cancel: 'キャンセル',
    },
  },
};

export default locale;
