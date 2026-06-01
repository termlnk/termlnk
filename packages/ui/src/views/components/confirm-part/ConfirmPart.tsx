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

import type { IConfirmPartOptions } from './interface';
import { IConfirmService } from '@termlnk/core';
import { Confirm, useDependency } from '@termlnk/design';
import { useEffect, useState } from 'react';
import { CustomWrapper } from '../custom-wrapper';

/**
 * Subscribes to `IConfirmService.confirmOptions$` and renders one `Confirm`
 * per registered option. Locale-aware fields (`title`, `description`) go
 * through `CustomWrapper`, matching `DialogPart`'s approach so the design-
 * package `Confirm` stays locale-free.
 */
export function ConfirmPart() {
  const confirmService = useDependency(IConfirmService) as IConfirmService<IConfirmPartOptions>;

  const [confirmOptions, setConfirmOptions] = useState<IConfirmPartOptions[]>([]);

  useEffect(() => {
    const subscription = confirmService.confirmOptions$.subscribe((options) => {
      setConfirmOptions(options);
    });

    return () => subscription.unsubscribe();
  }, [confirmService]);

  return confirmOptions.map((options) => (
    <Confirm
      key={options.id}
      open={options.visible}
      title={options.title ? <CustomWrapper {...options.title} /> : undefined}
      description={options.description ? <CustomWrapper {...options.description} /> : undefined}
      cancelText={options.cancelText}
      confirmText={options.confirmText}
      confirmVariant={options.confirmVariant}
      onConfirm={options.onConfirm}
      onCancel={options.onCancel}
    />
  ));
}
