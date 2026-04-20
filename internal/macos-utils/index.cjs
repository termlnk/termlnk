/**
 * Loader for the compiled native addon.
 *
 * On macOS this loads the N-API .node binary.
 * On other platforms it exports a no-op stub so callers don't need
 * platform guards.
 */

'use strict';

if (process.platform === 'darwin') {
  const path = require('node:path');
  module.exports = require(path.join(__dirname, 'build', 'Release', 'macos_utils.node'));
} else {
  module.exports = {
    makeStationary() { /* no-op on non-macOS */ },
    disableFrameConstraint() { /* no-op on non-macOS */ },
    checkAccessibilityTrusted() { return false; },
    injectKeysByTty() { return false; },
    injectKeysByPid() { return false; },
  };
}
