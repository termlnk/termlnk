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

import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './base';

export const PORT_FORWARDING_TYPES = ['local', 'remote', 'dynamic'] as const;
export type PortForwardingType = typeof PORT_FORWARDING_TYPES[number];

// hostId is intentionally not enforced as a foreign key. Sync convergence may
// briefly reference a host that has not yet been pulled on this device; a hard
// FK constraint would reject the row and diverge replicas. Orphaned rules
// simply fail at start() time with a clear error.
export const portForwardingRuleEntity = sqliteTable('port_forwarding_rule', {
  id: text('id').primaryKey().notNull(),
  label: text('label').notNull().default(''),
  type: text('type').notNull().$type<PortForwardingType>(),
  hostId: text('host_id').notNull(),
  bindAddress: text('bind_address').notNull().default('127.0.0.1'),
  bindPort: integer('bind_port').notNull(),
  destinationAddress: text('destination_address'),
  destinationPort: integer('destination_port'),
  sort: integer('sort').notNull().default(0),

  ...timestamps,
}, (table) => [
  index('idx_port_forwarding_rule_host_id').on(table.hostId),
]);

export type IPortForwardingRuleEntity = InferSelectModel<typeof portForwardingRuleEntity>;
export type IPortForwardingRuleEntityInsert = InferInsertModel<typeof portForwardingRuleEntity>;
