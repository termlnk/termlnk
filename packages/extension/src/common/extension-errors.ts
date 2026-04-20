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
 * Base error class for extension system errors.
 */
export class ExtensionError extends Error {
  readonly extensionId: string;
  readonly originalCause?: unknown;

  constructor(
    extensionId: string,
    message: string,
    cause?: unknown
  ) {
    super(`[Extension ${extensionId}] ${message}`);
    this.name = 'ExtensionError';
    this.extensionId = extensionId;
    this.originalCause = cause;
  }
}

export class ExtensionManifestError extends ExtensionError {
  constructor(extensionId: string, message: string, cause?: unknown) {
    super(extensionId, `Manifest error: ${message}`, cause);
    this.name = 'ExtensionManifestError';
  }
}

export class ExtensionActivationError extends ExtensionError {
  constructor(extensionId: string, message: string, cause?: unknown) {
    super(extensionId, `Activation failed: ${message}`, cause);
    this.name = 'ExtensionActivationError';
  }
}

export class ExtensionInstallError extends ExtensionError {
  constructor(extensionId: string, message: string, cause?: unknown) {
    super(extensionId, `Installation failed: ${message}`, cause);
    this.name = 'ExtensionInstallError';
  }
}
