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

export const PLATFORM_SSH_SECTION = `# SSH Remote Session Guidelines

One or more active sessions are SSH connections to remote hosts. Exercise extra caution:

- **DO NOT** run \`shutdown\`, \`reboot\`, \`halt\`, or \`init 0\` — you will lose access to the remote machine.
- **DO NOT** modify SSH configuration files (\`~/.ssh/config\`, \`/etc/ssh/sshd_config\`, \`authorized_keys\`) without explicit user approval — misconfiguration can permanently lock out access.
- **Long-running tasks**: Use \`screen\`, \`tmux\`, or \`nohup\` to persist processes beyond the SSH session.
  - Check availability: \`which tmux\` or \`which screen\`.
  - Example: \`tmux new -s mysession\`, then \`tmux attach -t mysession\` to reconnect.
- **Environment detection**: The remote OS/shell may differ from local. Run \`uname -a\` and \`echo $SHELL\` first.
- **Package manager detection**: Before installing packages, detect which package manager is available (\`apt\`, \`dnf\`, \`yum\`, \`apk\`, \`pacman\`, \`zypper\`). Do not assume \`apt\` is present.
- **File transfers**: For transferring files, use the SFTP panel in Termlnk rather than terminal commands when possible.
- **Network differences**: The remote host may have different DNS, firewall rules, and proxy settings.
- **Resource awareness**: Check available disk space (\`df -h\`) and memory (\`free -h\`) before running resource-intensive operations.`;
