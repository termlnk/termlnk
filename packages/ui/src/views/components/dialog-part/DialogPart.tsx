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

import type { IDialogProps } from '@termlnk/design';
import type { ICustomWrapperProps } from '../custom-wrapper';
import { Dialog, useDependency } from '@termlnk/design';
import { useEffect, useMemo, useState } from 'react';
import { IDialogService } from '../../../services/dialog/dialog.service';
import { CustomWrapper } from '../custom-wrapper';

export type IDialogPartOptions = {
  id: string;
  children?: ICustomWrapperProps;
  title?: ICustomWrapperProps;
  footer?: ICustomWrapperProps;
} & Omit<IDialogProps, 'children' | 'title' | 'footer'>;

export function DialogPart() {
  const dialogService = useDependency(IDialogService);

  const [dialogOptions, setDialogOptions] = useState<IDialogPartOptions[]>([]);

  useEffect(() => {
    const subscription = dialogService.dialogOptions$.subscribe((options: IDialogPartOptions[]) => {
      setDialogOptions(options);
    });

    return () => subscription.unsubscribe();
  }, []);

  const attrs = useMemo(() => dialogOptions.map((options) => {
    const { children, title, footer, ...restProps } = options;

    const dialogProps = restProps as IDialogProps & { id: string };
    for (const key of ['children', 'title', 'footer']) {
      const k = key as keyof IDialogPartOptions;
      const props = options[k] as any;

      if (props) {
        (dialogProps as any)[k] = <CustomWrapper {...props} />;
      }
    }

    return dialogProps;
  }), [dialogOptions]);

  return attrs?.map((options) => (
    <Dialog key={options.id} {...options} />
  ));
}
