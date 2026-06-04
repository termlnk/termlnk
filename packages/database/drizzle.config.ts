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

import { homedir } from 'node:os';
import { join } from 'node:path';
import * as process from 'node:process';
import { defineConfig } from 'drizzle-kit';

const dbPath = process.env.TERMLNK_DB_PATH || join(homedir(), '.config', 'termlnk', 'termlnk.db');

export default defineConfig({
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath,
  },
  schema: [
    './src/entities/chat.ts',
    './src/entities/collab-invite-token.ts',
    './src/entities/config.ts',
    './src/entities/host.ts',
    './src/entities/identity.ts',
    './src/entities/known-host.ts',
    './src/entities/mcp-oauth-token.ts',
    './src/entities/mcp-server.ts',
    './src/entities/provider.ts',
    './src/entities/skill.ts',
    './src/entities/ssh-key.ts',
    './src/entities/sync-cursor.ts',
    './src/entities/sync-field-meta.ts',
    './src/entities/sync-outbox.ts',
    './src/entities/sync-row-meta.ts',
    './src/entities/terminal-session-backup.ts',
  ],
  out: './src/migrations',

  migrations: {
    table: '__drizzle_migrations',
  },
});
