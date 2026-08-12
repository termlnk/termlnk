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
  'project-ui': {
    explorer: {
      title: 'ファイル',
      empty: 'ローカルターミナルまたは ACP セッションを開いてファイルを表示します。',
      filter: 'ファイルを絞り込み…',
      refresh: '更新',
      'show-hidden': '隠しファイルを表示',
      'hide-hidden': '隠しファイルを非表示',
    },
    changes: {
      title: '変更',
      uncommitted: '未コミット {0} 件',
      clean: '変更はありません。',
      'no-diff': 'テキスト差分はありません。',
      'staged-count': 'ステージ済み {0} 件',
      'switch-branch': 'ブランチを切り替え',
      'collapse-all': 'すべて折りたたむ',
      'expand-all': 'すべて展開',
      'view-flat': 'フラット表示',
      'view-tree': 'ツリー表示',
    },
    git: {
      title: 'Git',
      empty: 'プロジェクトコンテキストがありません。',
      'not-a-repo': 'Git リポジトリではありません。',
      staged: 'ステージ済み',
      changes: '変更',
      stage: 'ステージ',
      unstage: 'ステージ解除',
      commit: 'コミット',
      'commit-message': 'コミットメッセージ',
      diff: '差分',
      'close-diff': '閉じる',
    },
    shortcuts: {
      'toggle-explorer': 'エクスプローラーを切り替え',
      'toggle-git': 'Git を切り替え',
    },
  },
};

export default locale;
