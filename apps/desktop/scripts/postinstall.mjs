import { execSync, spawnSync } from 'node:child_process';
import { chmodSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const shouldSkip = ['1', 'true'].includes(
  String(process.env.TERMLNK_SKIP_ELECTRON_POSTINSTALL ?? '').toLowerCase()
);

if (shouldSkip) {
  console.log('[postinstall] Skipping Electron binary download and native prebuild install');
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

// 2. Install Electron prebuilds for native modules (better-sqlite3)
//    node-pty uses N-API and its shipped prebuilds work directly with Electron.
//    better-sqlite3 uses V8 addon API and needs ABI-specific prebuilds.
const workspaceRoot = resolve(import.meta.dirname, '../../..');
const require_ = createRequire(resolve(workspaceRoot, 'package.json'));

const electronPkgPath = resolve(workspaceRoot, 'node_modules/electron/package.json');
let electronVersion;
try {
  electronVersion = JSON.parse(readFileSync(electronPkgPath, 'utf-8')).version;
} catch {
  console.warn('[postinstall] electron not found, skipping native prebuild install');
  process.exit(0);
}

const nativeModules = ['better-sqlite3'];

console.log(`[postinstall] Installing Electron ${electronVersion} prebuilds for: ${nativeModules.join(', ')}`);

for (const moduleName of nativeModules) {
  try {
    const moduleDir = dirname(require_.resolve(`${moduleName}/package.json`));
    execSync(
      `npx prebuild-install --runtime electron --target ${electronVersion} --arch ${process.arch} --tag-prefix v`,
      { cwd: moduleDir, stdio: 'inherit' }
    );
    console.log(`[postinstall] ${moduleName}: done`);
  } catch (err) {
    console.error(`[postinstall] ${moduleName}: failed`, err.message || err);
    process.exit(1);
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
