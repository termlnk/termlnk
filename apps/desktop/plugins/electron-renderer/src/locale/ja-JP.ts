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
  'electron-renderer': {
    header: {
      'pin-enable': 'ウィンドウを最前面に固定',
      'pin-disable': '最前面固定を解除',
    },
    'platform-tab': {
      label: 'プラットフォーム',
      description: 'OSレベルの統合：トレイ、自動起動、ディスプレイ電源管理',
      'tray-enable': 'システムトレイを有効化',
      'tray-enable-description': 'システム通知エリアにアプリアイコンを表示し、クイックアクセスメニューを提供',
      'close-to-tray': 'トレイに最小化',
      'close-to-tray-description': '閉じるときにアプリを終了せず、システムトレイに隠す',
      'startup-title': 'スタートアップ',
      'auto-launch': 'ログイン時に起動',
      'auto-launch-description': 'システムログイン時にTermlnkを自動起動',
      'keep-awake-title': 'ディスプレイをスリープさせない',
      'keep-awake-description': 'Agent セッション実行中はディスプレイのスリープを防止',
    },
  },
};

export default locale;
