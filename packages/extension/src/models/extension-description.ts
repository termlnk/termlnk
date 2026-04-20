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

import type { IExtensionManifest } from '../manifest/extension-manifest';
import type { ExtensionStatus } from './extension-status';

/**
 * Runtime description of an installed extension.
 */
export interface IExtensionDescription {
  /** Unique extension ID (publisher.name) */
  readonly id: string;

  /** Absolute path to extension directory */
  readonly extensionPath: string;

  /** Parsed and validated manifest */
  readonly manifest: IExtensionManifest;

  /** Current runtime status */
  status: ExtensionStatus;

  /** Error message if status is Error */
  error?: string;

  /** Whether this is a local development extension */
  readonly isDev?: boolean;
}

/**
 * Public info about an extension, exposed via termlnk.extensions API.
 */
export interface IExtensionInfo {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly isActive: boolean;
}

/**
 * Represents an activated extension.
 */
export interface IActivatedExtension {
  readonly id: string;
  readonly exports: any;
  readonly context: IExtensionContextLike;
  readonly module: IExtensionModule;
}

/**
 * The module shape an extension must export.
 */
export interface IExtensionModule {
  activate: (context: IExtensionContextLike, termlnk: any) => any;
  deactivate?: () => void | Promise<void>;
}

/**
 * Minimal context shape for typing purposes.
 */
export interface IExtensionContextLike {
  readonly subscriptions: { dispose(): void }[];
  readonly extensionPath: string;
  readonly extensionId: string;
}
