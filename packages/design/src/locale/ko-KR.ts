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
      cancel: '취소',
      confirm: '확인',
    },
    CascaderList: {
      empty: '없음',
    },
    Calendar: {
      year: '년',
      weekDays: ['일', '월', '화', '수', '목', '금', '토'],
      months: [
        '1월',
        '2월',
        '3월',
        '4월',
        '5월',
        '6월',
        '7월',
        '8월',
        '9월',
        '10월',
        '11월',
        '12월',
      ],
    },
    Select: {
      empty: '없음',
    },
    ColorPicker: {
      more: '더 많은 색상',
      cancel: '취소',
      confirm: '확인',
    },
    GradientColorPicker: {
      linear: '선형',
      radial: '방사형',
      angular: '각도',
      diamond: '다이아몬드',
      offset: '오프셋',
      angle: '각도',
      flip: '반전',
      delete: '삭제',
    },
  },
};

export default locale;
