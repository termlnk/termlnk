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

interface IEmptyStateProps {
  t: (key: string, ...args: string[]) => string;
}

export function EmptyState({ t }: IEmptyStateProps) {
  return (
    <div className="tm:flex tm:flex-col tm:items-center tm:justify-center tm:py-10 tm:text-grey-fg">
      <span className="tm:text-xs tm:text-grey-fg">{t('ui.notification-panel.empty')}</span>
    </div>
  );
}
