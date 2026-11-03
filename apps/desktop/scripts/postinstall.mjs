import { execSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const shouldSkip = ['1', 'true'].includes(
  String(process.env.TERMLNK_SKIP_ELECTRON_POSTINSTALL ?? '').toLowerCase()
);

if (shouldSkip) {
  console.log('[postinstall] Skipping Electron binary download and native module setup');
  process.exit(0);
}

// 1. Download Electron binary
const electronInstallScript = resolve(import.meta.dirname, '../../../node_modules/electron/install.js');
const result = spawnSync(process.execPath, [electronInstallScript], {
  env: process.env,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const require_ = createRequire(resolve(workspaceRoot, 'package.json'));

// 2. Build node-pty from source on Linux
//    The node-pty npm tarball ships prebuilds only for darwin/win32 — there is
//    no linux-<arch> pty.node. node-pty's own install script
//    (scripts/prebuild.js || node-gyp rebuild) is disabled by
//    `allowBuilds: node-pty: false` in pnpm-workspace.yaml, so without this
//    step Linux packages (AppImage/deb/rpm) would silently ship without the
//    native module and crash on startup (see issue #7). node-pty is N-API, so
//    a plain node-gyp rebuild against the system Node headers also loads under
//    Electron — the same reason its shipped prebuilds work there.
if (process.platform === 'linux') {
  const nodePtyDir = dirname(require_.resolve('node-pty/package.json'));
  const prebuildDir = resolve(nodePtyDir, 'prebuilds', `${process.platform}-${process.arch}`);
  const buildRelease = resolve(nodePtyDir, 'build/Release/pty.node');
  if (existsSync(prebuildDir) || existsSync(buildRelease)) {
    console.log(`[postinstall] node-pty: native pty.node available for ${process.platform}-${process.arch}`);
  } else {
    const nodeGypCli = require_.resolve('node-gyp/bin/node-gyp.js');
    console.log(`[postinstall] node-pty: no ${process.platform}-${process.arch} prebuild, building from source...`);
    execSync(`${process.execPath} "${nodeGypCli}" rebuild`, { cwd: nodePtyDir, stdio: 'inherit' });
    if (!existsSync(buildRelease)) {
      console.error(`[postinstall] node-pty: build did not produce ${buildRelease}`);
      process.exit(1);
    }
    console.log('[postinstall] node-pty: built from source');
  }
}

// 3. Fix node-pty spawn-helper executable permission
//    The prebuilt spawn-helper binary may lack +x after pnpm install,
//    causing posix_spawnp to fail in dev mode.
if (process.platform !== 'win32') {
  const spawnHelper = resolve(
    workspaceRoot,
    `node_modules/node-pty/prebuilds/${process.platform}-${process.arch}/spawn-helper`
  );
  try {
    chmodSync(spawnHelper, 0o755);
    console.log('[postinstall] node-pty spawn-helper: chmod +x done');
  } catch {
    console.warn('[postinstall] node-pty spawn-helper: not found, skipping chmod');
  }
}
