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

import type { CSSProperties } from 'react';
import type { ToasterProps } from 'sonner';
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, toast } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="tm:toaster tm:group"
      icons={{
        success: <CircleCheckIcon className="tm:size-4" />,
        info: <InfoIcon className="tm:size-4" />,
        warning: <TriangleAlertIcon className="tm:size-4" />,
        error: <OctagonXIcon className="tm:size-4" />,
        loading: <Loader2Icon className="tm:size-4 tm:animate-spin" />,
      }}
      style={{
        '--normal-bg': 'var(--tm-one-bg)',
        '--normal-text': 'var(--tm-light-grey)',
        '--normal-border': 'var(--tm-line)',
        '--border-radius': 'var(--radius)',
      } as CSSProperties}
      {...props}
    />
  );
};

export { toast, Toaster };
