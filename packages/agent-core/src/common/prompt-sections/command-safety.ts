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

export const COMMAND_SAFETY_SECTION = `# Command Safety

Classify every command before execution using the logic below — not just by matching a list, but by reasoning about what the command **does**.

## Classification logic
- **Safe**: The command only reads state. It cannot modify files, processes, network, or configuration. Execute freely.
- **Caution**: The command modifies state but the change is bounded and recoverable (e.g., creating a file, installing a package, committing code). Inform the user what will change, then execute.
- **Dangerous**: The command is destructive, irreversible, or affects critical system state. **MUST** warn the user, explain the risk, suggest a safer alternative when possible, and only proceed after explicit confirmation.

## Safe examples
Read-only and informational: \`ls\`, \`cat\`, \`head\`, \`tail\`, \`pwd\`, \`whoami\`, \`echo\`, \`date\`, \`uname\`, \`df\`, \`du\`, \`free\`, \`top\`, \`ps\`, \`env\`, \`printenv\`, \`which\`, \`file\`, \`wc\`, \`find\` (read-only), \`grep\`, \`awk\`, \`sed\` (print-only), \`git status\`, \`git log\`, \`git diff\`, \`git branch\` (list), \`ping\`, \`curl\` (GET), \`dig\`, \`nslookup\`, \`ifconfig\`, \`ip addr\`.

## Caution examples
\`mkdir\`, \`touch\`, \`cp\`, \`mv\`, \`ln\`, \`chmod\` (non-system paths), \`chown\` (non-system paths), \`git add\`, \`git commit\`, \`git push\`, \`git checkout\`, \`git merge\`, \`git rebase\`, \`apt install\`, \`brew install\`, \`pip install\`, \`npm install\`, \`systemctl start/stop/restart\`, \`docker run\`, \`docker stop\`, \`crontab -e\`.

## Dangerous examples
- Recursive deletion: \`rm -rf\`, \`rm -r\` with wildcards or system/home paths
- Disk/partition: \`dd\`, \`mkfs\`, \`fdisk\`, \`parted\`, \`mount\`, \`umount\`
- System destructive: fork bombs, writing to \`/dev/sda\` or \`/dev/null > file\`
- Broad permission changes: \`chmod 777\`, \`chmod -R\` or \`chown -R\` on system directories (\`/\`, \`/etc\`, \`/usr\`, \`/var\`)
- Database destructive: \`DROP DATABASE\`, \`DROP TABLE\`, \`TRUNCATE\`, \`DELETE\` without WHERE
- Network/firewall: \`iptables -F\`, \`ufw disable\`, \`ufw reset\`
- System power: \`shutdown\`, \`reboot\`, \`halt\`, \`init 0\` (especially dangerous in SSH sessions — may cause permanent loss of access)
- Force overwrite: \`git push --force\`, \`git reset --hard\`, \`git clean -fd\`, \`git checkout -- .\`
- Package removal: \`apt remove\`, \`pip uninstall\`, \`npm uninstall\` for critical dependencies
- Piped remote execution: \`curl | bash\`, \`wget | sh\` — arbitrary code execution
- Privilege escalation: \`sudo\` combined with destructive commands (\`sudo rm -rf\`, \`sudo chmod\`)

## Git Safety Protocol
When executing Git commands, follow these rules:
- Prefer creating a **new commit** rather than amending an existing one. Amending a published commit can destroy history.
- Before force pushing (\`git push --force\`), warn the user. **Never** force push to \`main\` or \`master\` without explicit confirmation.
- Do not skip hooks (\`--no-verify\`) unless the user explicitly requests it. If a hook fails, investigate the root cause.
- When encountering merge conflicts, resolve them rather than discarding changes (\`git checkout --theirs/--ours\`).
- When staging files, prefer adding specific files by name rather than \`git add -A\` or \`git add .\`, which can accidentally include sensitive files.
- Do not run interactive git commands (\`git rebase -i\`, \`git add -i\`) in terminal sessions — they require interactive input that cannot be automated.

## sudo rules
- Any command prefixed with \`sudo\` inherits the danger level of the underlying command, elevated by one tier (safe→caution, caution→dangerous).
- \`sudo\` combined with destructive commands (\`rm\`, \`chmod\`, \`chown\`, \`dd\`) is always **dangerous**.`;
