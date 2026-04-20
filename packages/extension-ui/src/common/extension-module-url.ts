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

/**
 * Build a loadable module URL for an extension-contributed JS file.
 *
 * The renderer dynamic-imports extension code directly; the main process
 * registers a `termlnk-ext://` protocol that reads files from the extension's
 * installed or dev directory. Packing into a URL keeps the extension system
 * decoupled from the absolute filesystem layout and works identically in dev
 * mode and in packaged builds.
 *
 * Examples:
 *   resolveExtensionModuleUrl('foo.bar', './dist/index.js')
 *     → 'termlnk-ext://foo.bar/dist/index.js'
 *   resolveExtensionModuleUrl('foo.bar', 'views/panel.js')
 *     → 'termlnk-ext://foo.bar/views/panel.js'
 */
export function resolveExtensionModuleUrl(extensionId: string, relativePath: string): string {
  const trimmed = relativePath
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');
  const encoded = trimmed.split('/').map((seg) => encodeURIComponent(seg)).join('/');
  return `termlnk-ext://${extensionId}/${encoded}`;
}
