CREATE TABLE `port_forwarding_rule` (
	`id` text PRIMARY KEY,
	`name` text,
	`type` text NOT NULL,
	`host_id` text NOT NULL,
	`bind_address` text DEFAULT '127.0.0.1' NOT NULL,
	`bind_port` integer NOT NULL,
	`dest_host` text,
	`dest_port` integer,
	`auto_start` integer DEFAULT false NOT NULL,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snippet` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`command` text NOT NULL,
	`description` text,
	`group_id` text,
	`run_mode` text DEFAULT 'insert' NOT NULL,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
