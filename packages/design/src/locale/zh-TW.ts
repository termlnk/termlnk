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
      cancel: '取消',
      confirm: '確定',
    },
    CascaderList: {
      empty: '無',
    },
    Calendar: {
      year: '年',
      weekDays: ['日', '一', '二', '三', '四', '五', '六'],
      months: [
        '一月',
        '二月',
        '三月',
        '四月',
        '五月',
        '六月',
        '七月',
        '八月',
        '九月',
        '十月',
        '十一月',
        '十二月',
      ],
    },
    Select: {
      empty: '無',
    },
    ColorPicker: {
      more: '更多顏色',
      cancel: '取消',
      confirm: '確定',
    },
    GradientColorPicker: {
      linear: '線性',
      radial: '徑向',
      angular: '角向',
      diamond: '菱形',
      offset: '偏移',
      angle: '角度',
      flip: '翻轉',
      delete: '刪除',
    },
  },
};

export default locale;
