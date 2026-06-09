CREATE TABLE `hosts` (
	`id` text PRIMARY KEY,
	`pid` text DEFAULT 'root' NOT NULL,
	`tree` text,
	`label` text NOT NULL,
	`type` text NOT NULL,
	`addr` text,
	`port` integer,
	`sort` integer DEFAULT 0 NOT NULL,
	`credential_ct` text,
	`proxy_ct` text,
	`settings_json` text,
	`host_chain_ids_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `identities` (
	`id` text PRIMARY KEY,
	`label` text NOT NULL,
	`username` text,
	`password_ct` text,
	`key_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ssh_keys` (
	`id` text PRIMARY KEY,
	`label` text NOT NULL,
	`algorithm` text,
	`bits` integer,
	`private_key_ct` text,
	`public_key` text,
	`certificate` text,
	`passphrase_ct` text,
	`save_passphrase` integer DEFAULT false NOT NULL,
	`source` text,
	`public_key_fingerprint` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `known_hosts` (
	`id` text PRIMARY KEY,
	`host` text NOT NULL,
	`port` integer DEFAULT 22 NOT NULL,
	`key_type` text NOT NULL,
	`fingerprint` text NOT NULL,
	`public_key` text,
	`last_seen_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recent_sessions` (
	`host_id` text NOT NULL,
	`kind` text NOT NULL,
	`last_used_at` integer NOT NULL,
	CONSTRAINT `recent_sessions_pk` PRIMARY KEY(`host_id`, `kind`)
);
--> statement-breakpoint
CREATE TABLE `config` (
	`key` text PRIMARY KEY,
	`value_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
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
CREATE TABLE `sync_field_meta` (
	`resource` text NOT NULL,
	`entity_id` text NOT NULL,
	`field` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `sync_field_meta_pk` PRIMARY KEY(`resource`, `entity_id`, `field`)
);
--> statement-breakpoint
CREATE TABLE `sync_cursor` (
	`resource` text PRIMARY KEY,
	`cursor` text NOT NULL,
	`last_pulled_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_hosts_pid` ON `hosts` (`pid`);--> statement-breakpoint
CREATE INDEX `idx_hosts_sort` ON `hosts` (`sort`);--> statement-breakpoint
CREATE INDEX `idx_known_hosts_lookup` ON `known_hosts` (`host`,`port`);--> statement-breakpoint
CREATE INDEX `idx_recent_sessions_last_used_at` ON `recent_sessions` (`last_used_at`);--> statement-breakpoint
CREATE INDEX `idx_sync_outbox_resource` ON `sync_outbox` (`resource`);--> statement-breakpoint
CREATE INDEX `idx_sync_outbox_client_mut_id` ON `sync_outbox` (`client_mut_id`);