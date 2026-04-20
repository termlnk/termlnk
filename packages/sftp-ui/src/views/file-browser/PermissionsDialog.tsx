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

import { Button } from '@termlnk/design';
import { useCallback, useState } from 'react';

interface IPermissionsDialogProps {
  filename: string;
  currentMode: number;
  onSubmit: (mode: number) => void;
  onCancel: () => void;
}

const permLabels = ['Read', 'Write', 'Execute'];
const groups = ['Owner', 'Group', 'Others'];

export function PermissionsDialog({ filename, currentMode, onSubmit, onCancel }: IPermissionsDialogProps) {
  const [perms, setPerms] = useState(() => {
    const mode = currentMode & 0o777;
    const bits: boolean[][] = [];
    for (let g = 2; g >= 0; g--) {
      const group: boolean[] = [];
      for (let p = 2; p >= 0; p--) {
        group.push(((mode >> (g * 3 + p)) & 1) === 1);
      }
      bits.push(group);
    }
    return bits;
  });

  const handleToggle = useCallback((groupIdx: number, permIdx: number) => {
    setPerms((prev) => {
      const next = prev.map((g) => [...g]);
      next[groupIdx][permIdx] = !next[groupIdx][permIdx];
      return next;
    });
  }, []);

  const computeMode = useCallback((): number => {
    let mode = 0;
    for (let g = 0; g < 3; g++) {
      for (let p = 0; p < 3; p++) {
        if (perms[g][p]) {
          mode |= 1 << ((2 - g) * 3 + (2 - p));
        }
      }
    }
    return mode;
  }, [perms]);

  const handleSubmit = useCallback(() => {
    onSubmit(computeMode());
  }, [computeMode, onSubmit]);

  const octalValue = computeMode().toString(8).padStart(3, '0');

  return (
    <div className="tm:fixed tm:inset-0 tm:z-50 tm:flex tm:items-center tm:justify-center tm:bg-black/50">
      <div className="tm:w-80 tm:rounded-lg tm:border tm:border-line tm:bg-one-bg tm:p-4">
        <div className="tm:mb-1 tm:text-[14px] tm:font-medium tm:text-light-grey">Permissions</div>
        <div className="tm:mb-3 tm:truncate tm:text-[12px] tm:text-grey-fg2">{filename}</div>

        <div className="tm:mb-3 tm:space-y-2">
          {groups.map((group, gi) => (
            <div key={group} className="tm:flex tm:items-center tm:gap-3">
              <span className="tm:w-14 tm:text-[12px] tm:text-grey-fg2">{group}</span>
              {permLabels.map((label, pi) => (
                <label key={label} className="tm:flex tm:items-center tm:gap-1 tm:text-[11px] tm:text-grey-fg2">
                  <input
                    type="checkbox"
                    checked={perms[gi][pi]}
                    onChange={() => handleToggle(gi, pi)}
                    className="tm:rounded-sm tm:border-line"
                  />
                  {label[0]}
                </label>
              ))}
            </div>
          ))}
        </div>

        <div className="tm:mb-3 tm:text-[12px] tm:text-grey-fg">
          Octal:
          {' '}
          <span className="tm:font-mono tm:text-light-grey">{octalValue}</span>
        </div>

        <div className="tm:flex tm:justify-end tm:gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit}>Apply</Button>
        </div>
      </div>
    </div>
  );
}
