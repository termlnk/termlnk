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

import { useCallback, useState } from 'react';

export interface ColorPickerProps {
  /** 颜色值 (#RRGGBB) */
  value: string;
  /** 颜色变更回调 */
  onChange?: (value: string) => void;
  /** 标签 */
  label?: string;
  /** 禁用状态 */
  disabled?: boolean;
}

/**
 * 颜色选择器组件
 */
export function ColorPicker({
  value,
  onChange,
  label,
  disabled = false,
}: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(value);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // 验证是否为有效的 hex 颜色
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange?.(newValue);
    }
  }, [onChange]);

  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
  }, [onChange]);

  return (
    <div className="tm:flex tm:items-center tm:gap-3">
      {/* 颜色预览/选择器 */}
      <div className="tm:relative">
        <input
          type="color"
          value={value}
          onChange={handleColorChange}
          disabled={disabled}
          className={`
            tm:size-10 tm:cursor-pointer tm:rounded-sm tm:border tm:border-line
            tm:disabled:cursor-not-allowed tm:disabled:opacity-50
          `}
          style={{ backgroundColor: value }}
        />
      </div>

      {/* 颜色值输入 */}
      <div className="tm:flex-1">
        {label && (
          <label className="tm:mb-1 tm:block tm:text-xs tm:text-grey-fg">
            {label}
          </label>
        )}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder="#000000"
          className={`
            tm:w-full tm:rounded-sm tm:border tm:border-line tm:bg-one-bg tm:px-2 tm:py-1 tm:font-mono tm:text-sm
            tm:text-base05
            tm:focus:border-blue tm:focus:outline-none
            tm:disabled:cursor-not-allowed tm:disabled:opacity-50
          `}
        />
      </div>
    </div>
  );
}
