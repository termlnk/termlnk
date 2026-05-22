CREATE TABLE `collab_invite_token` (
	`invite_id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`capability_hash` text NOT NULL,
	`capability_version` integer NOT NULL,
	`capability_nonce` text NOT NULL,
	`eph_pub_b64` text NOT NULL,
	`eph_priv_cipher` text NOT NULL,
	`exp` integer NOT NULL,
	`single_use` integer NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`consumed_at` integer,
	`revoked_at` integer,
	`server_synced_at` integer
);
--> statement-breakpoint
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
CREATE INDEX `idx_collab_invite_token_status` ON `collab_invite_token` (`status`);--> statement-breakpoint
CREATE INDEX `idx_collab_invite_token_exp` ON `collab_invite_token` (`exp`);--> statement-breakpoint
CREATE INDEX `idx_collab_invite_token_session_id` ON `collab_invite_token` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_sync_outbox_resource` ON `sync_outbox` (`resource`);--> statement-breakpoint
CREATE INDEX `idx_sync_outbox_client_mut_id` ON `sync_outbox` (`client_mut_id`);