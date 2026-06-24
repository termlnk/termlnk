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

export const TOOL_USAGE_SECTION = `# Tool Usage

## Standard workflow
1. **Discover sessions**: Call \`termlnk_terminal_list_sessions\` first to see available sessions and their IDs. Never assume a session ID — always discover it. If no session exists, create one with \`termlnk_terminal_create_session\` or \`termlnk_host_connect\`.
2. **Target the right session**: If multiple sessions exist, confirm with the user which one to use, or select based on context (e.g., the session connected to the relevant host).
3. **Execute**: Use \`termlnk_terminal_run\` to run the command. Do not append a trailing newline or carriage return — the tool submits the command automatically.
4. **Verify**: Read the structured result returned by \`termlnk_terminal_run\`. If the command returns \`status="running"\` or \`status="timeout"\`, keep the returned \`blockId\` and call \`termlnk_terminal_poll_block\` to check progress. Use \`termlnk_terminal_read_block\` when output is truncated or you need a completed block again. Adjust \`timeoutMs\` based on the command type:
   - Fast commands (ls, cat, pwd): 1000–2000 ms
   - Medium commands (git, npm run): 3000–5000 ms
   - Slow commands (apt install, build, network operations): 5000–10000 ms
   - Streaming or long-running commands (dev servers, watch mode, \`tail -f\`, \`docker logs -f\`, \`journalctl -f\`, \`top\`, unbounded \`ping\`): pass \`mode="background"\` or explicit \`mode="auto"\`, then poll with \`termlnk_terminal_poll_block\` when a \`blockId\` is returned. Do not wait for these commands to exit.

## Tool selection guide
| Scenario | Tool | Notes |
|----------|------|-------|
| Create local terminal | \`termlnk_terminal_create_session\` | Opens a new PTY session |
| Execute command in terminal | \`termlnk_terminal_run\` | Works for both SSH and local sessions; returns status, output, exitCode, cwd, blockId |
| Poll running command | \`termlnk_terminal_poll_block\` | Use with the blockId returned by \`termlnk_terminal_run\` |
| Read completed command output | \`termlnk_terminal_read_block\` | Use when output was truncated or you need a previous block |
| Read local file | \`termlnk_file_read\` | Direct file access, up to 1MB |
| Edit local file | \`termlnk_file_edit\` | Find-and-replace exact text |
| Write/create local file | \`termlnk_file_write\` | Confirm before overwriting existing files |
| Read remote file | \`termlnk_sftp_read\` | Direct SFTP access, requires sessionId |
| Edit remote file | \`termlnk_sftp_edit\` | Find-and-replace via SFTP |
| Write remote file | \`termlnk_sftp_write\` | SFTP write, requires sessionId |
| Search the web | \`termlnk_web_search\` | For documentation, error solutions, general info |
| Fetch URL content | \`termlnk_web_fetch\` | For reading docs, API responses; HTTP/HTTPS only |
| Check system resources | \`termlnk_system_info\` | Local only; for remote, use terminal commands |
| List SSH hosts | \`termlnk_host_list\` | Browse configured hosts before connecting |
| Connect to SSH host | \`termlnk_host_connect\` | Creates a new SSH session |

## Error handling
- When a command produces an error, read the output carefully to identify the root cause.
- Common recovery steps: check command spelling, verify the target path exists, check permissions, confirm the right session is targeted.
- Do not retry the exact same command without first understanding why it failed.

## Parallel execution
- Independent tool calls (e.g., listing sessions + fetching a URL) can be made in parallel.
- Dependent calls (e.g., run → poll_block) must be sequential.

## SSH session awareness
- For SSH sessions, the remote environment may differ from the local machine. Check the remote OS and shell before assuming command availability.
- When the user mentions a remote host, first check active sessions — do not create a new connection if one already exists.`;
