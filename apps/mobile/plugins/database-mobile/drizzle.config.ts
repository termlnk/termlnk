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

import { defineConfig } from 'drizzle-kit';

// `driver: 'expo'` makes drizzle-kit emit migrations/migrations.js that imports each
// `.sql`. We bypass that file at runtime by transforming the SQL files into a plain
// TypeScript map via scripts/build-migrations.mjs — see src/migrations/index.generated.ts.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: [
    './src/entities/host.ts',
    './src/entities/identity.ts',
    './src/entities/ssh-key.ts',
    './src/entities/known-host.ts',
    './src/entities/recent-session.ts',
    './src/entities/port-forwarding-rule.ts',
    './src/entities/snippet.ts',
    './src/entities/config-kv.ts',
    './src/entities/sync-outbox.ts',
    './src/entities/sync-row-meta.ts',
    './src/entities/sync-field-meta.ts',
    './src/entities/sync-cursor.ts',
  ],
  out: './src/migrations',
  migrations: { table: '__drizzle_migrations' },
});
