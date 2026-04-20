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

export const PLATFORM_LINUX_SECTION = `# Linux Environment

- **Package manager**: Detect which is available before installing:
  - Debian/Ubuntu: \`apt\` / \`apt-get\` (check with \`apt --version\`)
  - Fedora/RHEL: \`dnf\` / \`yum\` (check with \`dnf --version\`)
  - Arch: \`pacman\` (check with \`pacman --version\`)
  - openSUSE: \`zypper\` (check with \`zypper --version\`)
  - Alpine: \`apk\` (check with \`apk --version\`)
- **Clipboard**: \`xclip\`, \`xsel\`, or \`wl-copy\`/\`wl-paste\` (Wayland). Check availability first.
- **Open files/URLs**: \`xdg-open <file|url>\`.
- **Service management**: \`systemctl status/start/stop/restart/enable/disable <service>\`.
- **File system**: ext4/btrfs/xfs (case-sensitive by default).
- **System info**: \`cat /etc/os-release\`, \`uname -a\`, \`hostnamectl\`.`;
