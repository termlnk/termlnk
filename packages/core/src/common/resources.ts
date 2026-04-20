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

import { CharCode } from './char-code';
import * as extpath from './extpath';
import * as paths from './path';
import { isLinux, isWindows } from './platform';
import { URI, uriToFsPath } from './uri';

export function originalFSPath(uri: URI): string {
  return uriToFsPath(uri, true);
}

export interface IUriKit {

  /**
   * Compares two uris.
   *
   * @param uri1 Uri
   * @param uri2 Uri
   * @param ignoreFragment Ignore the fragment (defaults to `false`)
   */
  compare(uri1: URI, uri2: URI, ignoreFragment?: boolean): number;

  /**
   * Tests whether two uris are equal
   *
   * @param uri1 Uri
   * @param uri2 Uri
   * @param ignoreFragment Ignore the fragment (defaults to `false`)
   */
  isEqual(uri1: URI | undefined, uri2: URI | undefined, ignoreFragment?: boolean): boolean;

  /**
   * Creates a key from a resource URI to be used to resource comparison and for resource maps.
   * @see {@link ResourceMap}
   * @param uri Uri
   * @param ignoreFragment Ignore the fragment (defaults to `false`)
   */
  getComparisonKey(uri: URI, ignoreFragment?: boolean): string;

  /**
   * Whether the casing of the path-component of the uri should be ignored.
   */
  ignorePathCasing(uri: URI): boolean;

  // --- path math

  basenameOrAuthority(resource: URI): string;

  /**
   * Returns the basename of the path component of an uri.
   * @param resource
   */
  basename(resource: URI): string;

  /**
   * Returns the extension of the path component of an uri.
   * @param resource
   */
  extname(resource: URI): string;

  /**
   * Return a URI representing the directory of a URI path.
   *
   * @param resource The input URI.
   * @returns The URI representing the directory of the input URI.
   */
  dirname(resource: URI): URI;

  /**
   * Join a URI path with path fragments and normalizes the resulting path.
   *
   * @param resource The input URI.
   * @param pathFragment The path fragment to add to the URI path.
   * @returns The resulting URI.
   */
  joinPath(resource: URI, ...pathFragment: string[]): URI;

  /**
   * Normalizes the path part of a URI: Resolves `.` and `..` elements with directory names.
   *
   * @param resource The URI to normalize the path.
   * @returns The URI with the normalized path.
   */
  normalizePath(resource: URI): URI;

  /**
   *
   * @param from
   * @param to
   */
  relativePath(from: URI, to: URI): string | undefined;

  /**
   * Resolves an absolute or relative path against a base URI.
   * The path can be relative or absolute posix or a Windows path
   */
  resolvePath(base: URI, path: string): URI;

  // --- misc

  /**
   * Returns true if the URI path is absolute.
   */
  isAbsolutePath(resource: URI): boolean;

  /**
   * Tests whether the two authorities are the same
   */
  isEqualAuthority(a1: string, a2: string): boolean;

  /**
   * Returns true if the URI path has a trailing path separator
   */
  hasTrailingPathSeparator(resource: URI, sep?: string): boolean;

  /**
   * Removes a trailing path separator, if there's one.
   * Important: Doesn't remove the first slash, it would make the URI invalid
   */
  removeTrailingPathSeparator(resource: URI, sep?: string): URI;

  /**
   * Adds a trailing path separator to the URI if there isn't one already.
   * For example, c:\ would be unchanged, but c:\users would become c:\users\
   */
  addTrailingPathSeparator(resource: URI, sep?: string): URI;
}

export class UriKit implements IUriKit {
  constructor(private _ignorePathCasing: (uri: URI) => boolean) { }

  compare(uri1: URI, uri2: URI, ignoreFragment: boolean = false): number {
    if (uri1 === uri2) {
      return 0;
    }
    return this.getComparisonKey(uri1, ignoreFragment).localeCompare(this.getComparisonKey(uri2, ignoreFragment));
  }

  isEqual(uri1: URI | undefined, uri2: URI | undefined, ignoreFragment: boolean = false): boolean {
    if (uri1 === uri2) {
      return true;
    }
    if (!uri1 || !uri2) {
      return false;
    }
    return this.getComparisonKey(uri1, ignoreFragment) === this.getComparisonKey(uri2, ignoreFragment);
  }

  getComparisonKey(uri: URI, ignoreFragment: boolean = false): string {
    return uri.with({
      path: this._ignorePathCasing(uri) ? uri.path.toLowerCase() : undefined,
      fragment: ignoreFragment ? null : undefined,
    }).toString();
  }

  ignorePathCasing(uri: URI): boolean {
    return this._ignorePathCasing(uri);
  }

  // --- path math

  joinPath(resource: URI, ...pathFragment: string[]): URI {
    return URI.joinPath(resource, ...pathFragment);
  }

  basenameOrAuthority(resource: URI): string {
    return basename(resource) || resource.authority;
  }

  basename(resource: URI): string {
    return paths.posix.basename(resource.path);
  }

  extname(resource: URI): string {
    return paths.posix.extname(resource.path);
  }

  dirname(resource: URI): URI {
    if (resource.path.length === 0) {
      return resource;
    }
    let dirname;
    if (resource.scheme === 'file') {
      dirname = URI.file(paths.dirname(originalFSPath(resource))).path;
    } else {
      dirname = paths.posix.dirname(resource.path);
      if (resource.authority && dirname.length && dirname.charCodeAt(0) !== CharCode.Slash) {
        console.error(`dirname("${resource.toString})) resulted in a relative path`);
        dirname = '/'; // If a URI contains an authority component, then the path component must either be empty or begin with a CharCode.Slash ("/") character
      }
    }
    return resource.with({
      path: dirname,
    });
  }

  normalizePath(resource: URI): URI {
    if (!resource.path.length) {
      return resource;
    }
    let normalizedPath: string;
    if (resource.scheme === 'file') {
      normalizedPath = URI.file(paths.normalize(originalFSPath(resource))).path;
    } else {
      normalizedPath = paths.posix.normalize(resource.path);
    }
    return resource.with({
      path: normalizedPath,
    });
  }

  relativePath(from: URI, to: URI): string | undefined {
    if (from.scheme !== to.scheme || !isEqualAuthority(from.authority, to.authority)) {
      return undefined;
    }
    if (from.scheme === 'file') {
      const relativePath = paths.relative(originalFSPath(from), originalFSPath(to));
      return isWindows ? extpath.toSlashes(relativePath) : relativePath;
    }
    let fromPath = from.path || '/';
    const toPath = to.path || '/';
    if (this._ignorePathCasing(from)) {
      // make casing of fromPath match toPath
      let i = 0;
      for (const len = Math.min(fromPath.length, toPath.length); i < len; i++) {
        if (fromPath.charCodeAt(i) !== toPath.charCodeAt(i)) {
          if (fromPath.charAt(i).toLowerCase() !== toPath.charAt(i).toLowerCase()) {
            break;
          }
        }
      }
      fromPath = toPath.substr(0, i) + fromPath.substr(i);
    }
    return paths.posix.relative(fromPath, toPath);
  }

  resolvePath(base: URI, path: string): URI {
    if (base.scheme === 'file') {
      const newURI = URI.file(paths.resolve(originalFSPath(base), path));
      return base.with({
        authority: newURI.authority,
        path: newURI.path,
      });
    }
    path = extpath.toPosixPath(path); // we allow path to be a windows path
    return base.with({
      path: paths.posix.resolve(base.path, path),
    });
  }

  // --- misc

  isAbsolutePath(resource: URI): boolean {
    return !!resource.path && resource.path[0] === '/';
  }

  isEqualAuthority(a1: string | undefined, a2: string | undefined) {
    return a1 === a2 || (a1 !== undefined && a2 !== undefined && a1.toLowerCase() === a2.toLowerCase());
  }

  hasTrailingPathSeparator(resource: URI, sep: string = paths.sep): boolean {
    if (resource.scheme === 'file') {
      const fsp = originalFSPath(resource);
      return fsp.length > extpath.getRoot(fsp).length && fsp.at(-1) === sep;
    } else {
      const p = resource.path;
      return (p.length > 1 && p.charCodeAt(p.length - 1) === CharCode.Slash) && !(/^[a-zA-Z]:(\/$|\\$)/.test(resource.fsPath)); // ignore the slash at offset 0
    }
  }

  removeTrailingPathSeparator(resource: URI, sep: string = paths.sep): URI {
    // Make sure that the path isn't a drive letter. A trailing separator there is not removable.
    if (hasTrailingPathSeparator(resource, sep)) {
      return resource.with({ path: resource.path.substr(0, resource.path.length - 1) });
    }
    return resource;
  }

  addTrailingPathSeparator(resource: URI, sep: string = paths.sep): URI {
    let isRootSep: boolean = false;
    if (resource.scheme === 'file') {
      const fsp = originalFSPath(resource);
      isRootSep = ((fsp !== undefined) && (fsp.length === extpath.getRoot(fsp).length) && (fsp.at(-1) === sep));
    } else {
      sep = '/';
      const p = resource.path;
      isRootSep = p.length === 1 && p.charCodeAt(p.length - 1) === CharCode.Slash;
    }
    if (!isRootSep && !hasTrailingPathSeparator(resource, sep)) {
      return resource.with({ path: `${resource.path}/` });
    }
    return resource;
  }
}

/**
 * Unbiased utility that takes uris "as they are". This means it can be interchanged with
 * uri#toString() usages. The following is true
 * ```
 * assertEqual(aUri.toString() === bUri.toString(), uriKit.isEqual(aUri, bUri))
 * ```
 */
export const defaultUriKit = new UriKit(() => false);

/**
 * BIASED utility that _mostly_ ignored the case of urs paths. ONLY use this util if you
 * understand what you are doing.
 *
 * This utility is INCOMPATIBLE with `uri.toString()`-usages and both CANNOT be used interchanged.
 *
 * When dealing with uris from files or documents, `uriKit` (the unbiased friend)is sufficient
 * because those uris come from a "trustworthy source". When creating unknown uris it's always
 * better to use `IUriIdentityService` which exposes an `IExtUri`-instance which knows when path
 * casing matters.
 */
export const uriKitBiasedIgnorePathCase = new UriKit((uri) => {
  // A file scheme resource is in the same platform as code, so ignore case for non linux platforms
  // Resource can be from another platform. Lowering the case as an hack. Should come from File system provider
  return uri.scheme === 'file' ? !isLinux : true;
});

/**
 * BIASED utility that always ignores the casing of uris paths. ONLY use this util if you
 * understand what you are doing.
 *
 * This utility is INCOMPATIBLE with `uri.toString()`-usages and both CANNOT be used interchanged.
 *
 * When dealing with uris from files or documents, `uriKit` (the unbiased friend)is sufficient
 * because those uris come from a "trustworthy source". When creating unknown uris it's always
 * better to use `IUriIdentityService` which exposes an `IUriKit`-instance which knows when path
 * casing matters.
 */
export const uriKitIgnorePathCase = new UriKit((_) => true);

export const isEqual = defaultUriKit.isEqual.bind(defaultUriKit);
export const getComparisonKey = defaultUriKit.getComparisonKey.bind(defaultUriKit);
export const basenameOrAuthority = defaultUriKit.basenameOrAuthority.bind(defaultUriKit);
export const basename = defaultUriKit.basename.bind(defaultUriKit);
export const extname = defaultUriKit.extname.bind(defaultUriKit);
export const dirname = defaultUriKit.dirname.bind(defaultUriKit);
export const joinPath = defaultUriKit.joinPath.bind(defaultUriKit);
export const normalizePath = defaultUriKit.normalizePath.bind(defaultUriKit);
export const relativePath = defaultUriKit.relativePath.bind(defaultUriKit);
export const resolvePath = defaultUriKit.resolvePath.bind(defaultUriKit);
export const isAbsolutePath = defaultUriKit.isAbsolutePath.bind(defaultUriKit);
export const isEqualAuthority = defaultUriKit.isEqualAuthority.bind(defaultUriKit);
export const hasTrailingPathSeparator = defaultUriKit.hasTrailingPathSeparator.bind(defaultUriKit);
export const removeTrailingPathSeparator = defaultUriKit.removeTrailingPathSeparator.bind(defaultUriKit);
export const addTrailingPathSeparator = defaultUriKit.addTrailingPathSeparator.bind(defaultUriKit);
