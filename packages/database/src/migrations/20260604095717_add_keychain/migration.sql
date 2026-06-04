CREATE TABLE `identity` (
	`id` text PRIMARY KEY,
	`label` text NOT NULL,
	`username` text NOT NULL,
	`password` text,
	`key_id` text,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `known_host` (
	`id` text PRIMARY KEY,
	`host` text NOT NULL,
	`port` integer DEFAULT 22 NOT NULL,
	`key_type` text NOT NULL,
	`fingerprint` text NOT NULL,
	`public_key` text,
	`last_seen_at` text,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ssh_key` (
	`id` text PRIMARY KEY,
	`label` text NOT NULL,
	`algorithm` text NOT NULL,
	`bits` integer,
	`private_key` text NOT NULL,
	`public_key` text NOT NULL,
	`certificate` text,
	`passphrase` text,
	`save_passphrase` integer DEFAULT false NOT NULL,
	`source` text NOT NULL,
	`public_key_fingerprint` text,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_identity_key_id` ON `identity` (`key_id`);--> statement-breakpoint
CREATE INDEX `idx_known_host_lookup` ON `known_host` (`host`,`port`);