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
  design: {
    Confirm: {
      cancel: 'キャンセル',
      confirm: 'OK',
    },
    CascaderList: {
      empty: 'なし',
    },
    Calendar: {
      year: '年',
      weekDays: ['日', '月', '火', '水', '木', '金', '土'],
      months: [
        '1月',
        '2月',
        '3月',
        '4月',
        '5月',
        '6月',
        '7月',
        '8月',
        '9月',
        '10月',
        '11月',
        '12月',
      ],
    },
    Select: {
      empty: 'なし',
    },
    ColorPicker: {
      more: 'その他の色',
      cancel: 'キャンセル',
      confirm: 'OK',
    },
    GradientColorPicker: {
      linear: '線形',
      radial: '放射状',
      angular: '角度',
      diamond: 'ダイヤモンド',
      offset: 'オフセット',
      angle: '角度',
      flip: '反転',
      delete: '削除',
    },
  },
};

export default locale;
