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

import type { ExtensionPermission } from '../manifest/extension-manifest';
import type { IPermissionService } from './permission.service';

/**
 * Per-method permission manifest for an API slice.
 *
 * Keys are method names on the target object; each value is the permission
 * (or list of permissions) the extension must hold to call that method.
 * Methods absent from the manifest are passed through untouched.
 */
export type PermissionManifest<T extends object> = {
  readonly [K in keyof T]?: ExtensionPermission | ReadonlyArray<ExtensionPermission>;
};

/**
 * Wrap `target` in a Proxy that invokes `permissionService.require(...)`
 * before delegating to each declared method.
 *
 * This reduces repeated `await this._permission.require(...)` boilerplate in
 * every API slice (commands, ui, tools, providers, …) to a single manifest
 * object per slice.
 *
 * The proxy only gates *function* properties listed in `manifest`. Every
 * other property read — including observables, ids, and paths — passes
 * through synchronously so the extension-facing shape is preserved.
 */
export function createGatedAPI<T extends object>(
  target: T,
  manifest: PermissionManifest<T>,
  permissionService: IPermissionService,
  extensionId: string
): T {
  return new Proxy(target, {
    get(obj, prop, receiver): unknown {
      const raw = Reflect.get(obj, prop, receiver);
      const required = manifest[prop as keyof T];
      if (!required || typeof raw !== 'function') {
        return raw;
      }

      return async function gated(this: unknown, ...args: unknown[]): Promise<unknown> {
        await permissionService.require(extensionId, required);
        return (raw as (...a: unknown[]) => unknown).apply(obj, args);
      };
    },
  });
}
