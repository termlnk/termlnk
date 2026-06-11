CREATE TABLE `snippets` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`command` text NOT NULL,
	`description` text,
	`group_id` text,
	`run_mode` text DEFAULT 'insert' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `port_forwarding_rules` (
	`id` text PRIMARY KEY,
	`name` text,
	`type` text NOT NULL,
	`host_id` text NOT NULL,
	`bind_address` text NOT NULL,
	`bind_port` integer NOT NULL,
	`dest_host` text,
	`dest_port` integer,
	`auto_start` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pfr_host` ON `port_forwarding_rules` (`host_id`);