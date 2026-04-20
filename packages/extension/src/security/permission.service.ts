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
import { createIdentifier, Disposable } from '@termlnk/core';

/**
 * Outcome of a permission check.
 *
 * - `granted`: the extension declared this permission and the user has
 *   approved it (or it is auto-granted per host policy).
 * - `denied`: the extension declared it but the user refused.
 * - `not-declared`: the extension never listed this permission in its
 *   manifest — the host treats this as a hard error to avoid accidental
 *   privilege escalation at runtime.
 */
export type PermissionDecision = 'granted' | 'denied' | 'not-declared';

export class PermissionNotDeclaredError extends Error {
  constructor(public readonly extensionId: string, public readonly permission: string) {
    super(`Extension "${extensionId}" attempted to use permission "${permission}" that was not declared in its manifest`);
    this.name = 'PermissionNotDeclaredError';
  }
}

export class PermissionDeniedError extends Error {
  constructor(public readonly extensionId: string, public readonly permission: string) {
    super(`Extension "${extensionId}" does not have permission "${permission}"`);
    this.name = 'PermissionDeniedError';
  }
}

export interface IPermissionService {
  /**
   * Declare the set of permissions an extension advertises in its
   * manifest. Call once at contribution-registration time.
   */
  declare(extensionId: string, permissions: ReadonlyArray<ExtensionPermission>): void;

  /**
   * Forget every record tied to `extensionId`. Called when an extension is
   * uninstalled so re-installed copies get a clean slate.
   */
  clear(extensionId: string): void;

  /**
   * Synchronously check without prompting. Useful for read-only diagnostics.
   */
  check(extensionId: string, permission: ExtensionPermission): PermissionDecision;

  /**
   * Assert that the extension is allowed to use this permission. Throws
   * `PermissionNotDeclaredError` when the manifest omitted it, or
   * `PermissionDeniedError` when the user refused.
   *
   * If the permission is declared but not yet decided, the implementation
   * is free to request user approval via `request()`; the MVP grants on
   * declaration (no UI prompt yet) to keep the surface shippable. When the
   * future prompt UI lands this method starts returning a Promise; callers
   * already await it so no breakage.
   */
  require(extensionId: string, permission: ExtensionPermission | ReadonlyArray<ExtensionPermission>): Promise<void>;

  /**
   * Explicit user-driven grant/revoke. Used by the settings UI.
   */
  setDecision(extensionId: string, permission: ExtensionPermission, decision: 'granted' | 'denied'): void;
}

export const IPermissionService = createIdentifier<IPermissionService>('extension.permission-service');

interface IRecord {
  readonly declared: Set<ExtensionPermission>;
  readonly decisions: Map<ExtensionPermission, 'granted' | 'denied'>;
}

export class PermissionService extends Disposable implements IPermissionService {
  private readonly _records = new Map<string, IRecord>();

  override dispose(): void {
    super.dispose();
    this._records.clear();
  }

  declare(extensionId: string, permissions: ReadonlyArray<ExtensionPermission>): void {
    const record = this._ensureRecord(extensionId);
    for (const p of permissions) {
      record.declared.add(p);
    }
  }

  clear(extensionId: string): void {
    this._records.delete(extensionId);
  }

  check(extensionId: string, permission: ExtensionPermission): PermissionDecision {
    const record = this._records.get(extensionId);
    if (!record || !this._matches(record.declared, permission)) {
      return 'not-declared';
    }
    const decided = this._lookupDecision(record.decisions, permission);
    if (decided === undefined) {
      // MVP policy: declared is enough. A future prompt flow will invert
      // this default (declared → pending → user-approved).
      return 'granted';
    }
    return decided;
  }

  async require(
    extensionId: string,
    permission: ExtensionPermission | ReadonlyArray<ExtensionPermission>
  ): Promise<void> {
    const list = Array.isArray(permission) ? permission : [permission as ExtensionPermission];
    for (const p of list) {
      const decision = this.check(extensionId, p);
      if (decision === 'not-declared') {
        throw new PermissionNotDeclaredError(extensionId, p);
      }
      if (decision === 'denied') {
        throw new PermissionDeniedError(extensionId, p);
      }
    }
  }

  setDecision(extensionId: string, permission: ExtensionPermission, decision: 'granted' | 'denied'): void {
    const record = this._ensureRecord(extensionId);
    record.decisions.set(permission, decision);
  }

  private _ensureRecord(extensionId: string): IRecord {
    let record = this._records.get(extensionId);
    if (!record) {
      record = { declared: new Set(), decisions: new Map() };
      this._records.set(extensionId, record);
    }
    return record;
  }

  /**
   * Domain permissions are `network:domain:<host>` — exact-match test with
   * a glob-ish fallback (the manifest author can declare `network:domain:*`
   * to allow any host).
   */
  private _matches(declared: Set<ExtensionPermission>, needed: ExtensionPermission): boolean {
    if (declared.has(needed)) {
      return true;
    }
    if (needed.startsWith('network:domain:') && declared.has('network:domain:*' as ExtensionPermission)) {
      return true;
    }
    return false;
  }

  private _lookupDecision(
    decisions: Map<ExtensionPermission, 'granted' | 'denied'>,
    permission: ExtensionPermission
  ): 'granted' | 'denied' | undefined {
    if (decisions.has(permission)) {
      return decisions.get(permission);
    }
    if (permission.startsWith('network:domain:') && decisions.has('network:domain:*' as ExtensionPermission)) {
      return decisions.get('network:domain:*' as ExtensionPermission);
    }
    return undefined;
  }
}
