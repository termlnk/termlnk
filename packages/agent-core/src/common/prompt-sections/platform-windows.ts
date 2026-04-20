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

export const PLATFORM_WINDOWS_SECTION = `# Windows Environment

You are on a Windows system. Be aware of the following differences from Unix:

## PowerShell vs cmd
- If the terminal shell is **PowerShell** (\`powershell\` or \`pwsh\`):
  - Use \`Get-ChildItem\` (alias \`ls\`, \`dir\`) instead of Unix \`ls\`.
  - Use \`Get-Content\` (alias \`cat\`, \`type\`) instead of Unix \`cat\`.
  - Use \`Set-Location\` (alias \`cd\`) for navigation.
  - Environment variables: \`$env:PATH\`, not \`$PATH\`.
  - Pipe objects, not text: \`Get-Process | Where-Object { $_.CPU -gt 10 }\`.
  - Use \`Select-String\` instead of \`grep\`.
  - Use \`Set-Clipboard\` / \`Get-Clipboard\` for clipboard access.
- If the terminal shell is **cmd**:
  - Use \`dir\` instead of \`ls\`.
  - Use \`type\` instead of \`cat\`.
  - Environment variables: \`%PATH%\`, \`set VAR=value\`.
  - Use \`&&\` to chain commands, \`|\` for pipes.
  - Use \`clip\` for clipboard: \`echo text | clip\`.

## File system
- Path separator: \`\\\` (backslash). Forward \`/\` often works but prefer \`\\\`.
- Drive letters: \`C:\\\`, \`D:\\\`, etc.
- Case-insensitive file names (NTFS default).
- Home directory: \`%USERPROFILE%\` or \`$env:USERPROFILE\`.

## Package managers
- \`winget\` (built-in), \`choco\` (Chocolatey), \`scoop\` — check which is available.
- Use \`winget install <package>\` or \`choco install <package>\`.

## Process management
- \`Get-Process\` / \`Stop-Process\` (PowerShell) or \`tasklist\` / \`taskkill\` (cmd).
- \`Start-Process\` to launch programs.

## Networking
- \`Test-NetConnection\` (PowerShell) instead of \`ping\`/\`nc\`.
- \`Invoke-WebRequest\` or \`curl.exe\` (not the PowerShell alias) for HTTP.

## Execution policy
- PowerShell scripts may be blocked by execution policy. Check with \`Get-ExecutionPolicy\`.
- Do not change the execution policy (\`Set-ExecutionPolicy\`) without user approval — it affects system security.`;
