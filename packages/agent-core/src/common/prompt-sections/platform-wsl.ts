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

export const PLATFORM_WSL_SECTION = `# WSL (Windows Subsystem for Linux) Environment

You are running inside WSL. This is a Linux environment hosted on Windows with special interop:

- **Windows drives**: Accessible at \`/mnt/c/\`, \`/mnt/d/\`, etc.
- **Windows tools**: Call Windows executables by appending \`.exe\`:
  - \`explorer.exe .\` — open current directory in Windows Explorer
  - \`notepad.exe file.txt\` — open file in Notepad
  - \`clip.exe\` — Windows clipboard: \`echo text | clip.exe\`
  - \`cmd.exe /c <command>\` — run Windows cmd commands
  - \`powershell.exe -c <command>\` — run PowerShell commands
- **Path conversion**: Use \`wslpath\` to convert between Linux and Windows paths:
  - \`wslpath -w /home/user\` → \`\\\\\\\\wsl$\\\\...\`
  - \`wslpath -u 'C:\\\\Users'\` → \`/mnt/c/Users\`
- **Networking**: WSL shares the Windows network stack. \`localhost\` in WSL reaches Windows services.
- **File permissions**: Files on Windows drives (\`/mnt/\`) may not support Unix permissions correctly.
- **Performance**: Operations on \`/mnt/\` drives are slower than on the native Linux filesystem (\`/home/\`). Prefer working in \`/home/\` when possible.`;
