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

type TranslateFn = (key: string, ...args: string[]) => string;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const DAYS_PER_WEEK = 7;

export function formatRelativeTime(timestamp: number, t: TranslateFn, dateLocale: string): string {
  const diff = Date.now() - timestamp;

  const days = Math.floor(diff / MS_PER_DAY);
  if (days >= DAYS_PER_WEEK) {
    return new Date(timestamp).toLocaleDateString(dateLocale);
  }
  if (days > 0) {
    return t('ui.notification-panel.time.days-ago', String(days));
  }

  const hours = Math.floor(diff / MS_PER_HOUR);
  if (hours > 0) {
    return t('ui.notification-panel.time.hours-ago', String(hours));
  }

  const minutes = Math.floor(diff / MS_PER_MINUTE);
  if (minutes > 0) {
    return t('ui.notification-panel.time.minutes-ago', String(minutes));
  }

  return t('ui.notification-panel.time.just-now');
}
