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

export const PLATFORM_MACOS_SECTION = `# macOS Environment

- **Default shell**: zsh (since macOS Catalina). Use zsh syntax and features.
- **Package manager**: Homebrew (\`brew install/uninstall/update/upgrade\`). Check with \`brew --version\`.
- **Clipboard**: \`pbcopy\` (stdin → clipboard), \`pbpaste\` (clipboard → stdout).
- **Open files/URLs**: \`open <file|url>\` (uses default application).
- **System info**: \`sw_vers\` (macOS version), \`system_profiler\` (hardware details).
- **File system**: APFS (case-insensitive by default). Be aware of case preservation without case sensitivity.
- **Paths**: Use \`/\` separator. Home directory is \`/Users/<username>\`.
- **Services**: Use \`launchctl\` instead of \`systemctl\`.
- **Disk usage**: \`diskutil list\` for disk info, \`df -h\` for usage.`;
