CREATE TABLE `sync_cursor` (
	`resource` text PRIMARY KEY,
	`cursor` text NOT NULL,
	`last_pulled_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_field_meta` (
	`resource` text NOT NULL,
	`entity_id` text NOT NULL,
	`field` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `sync_field_meta_pk` PRIMARY KEY(`resource`, `entity_id`, `field`)
);
--> statement-breakpoint
CREATE TABLE `sync_outbox` (
	`id` text PRIMARY KEY,
	`client_mut_id` integer NOT NULL,
	`resource` text NOT NULL,
	`op` text NOT NULL,
	`entity_id` text NOT NULL,
	`payload` blob,
	`base_version` integer,
	`created_at` integer NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_row_meta` (
	`resource` text NOT NULL,
	`entity_id` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `sync_row_meta_pk` PRIMARY KEY(`resource`, `entity_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_sync_outbox_resource` ON `sync_outbox` (`resource`);--> statement-breakpoint
CREATE INDEX `idx_sync_outbox_client_mut_id` ON `sync_outbox` (`client_mut_id`);