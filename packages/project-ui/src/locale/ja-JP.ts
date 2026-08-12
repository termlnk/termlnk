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
      title: 'エクスプローラー',
      empty: 'ローカルターミナルまたは ACP セッションを開いてファイルを表示します。',
      filter: 'ファイルを絞り込み…',
      refresh: '更新',
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
