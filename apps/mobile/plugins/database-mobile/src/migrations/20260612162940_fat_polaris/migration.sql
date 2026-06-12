CREATE TABLE `port_forwarding_rule` (
	`id` text PRIMARY KEY,
	`label` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`host_id` text NOT NULL,
	`bind_address` text DEFAULT '127.0.0.1' NOT NULL,
	`bind_port` integer NOT NULL,
	`destination_address` text,
	`destination_port` integer,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_port_forwarding_rule_host_id` ON `port_forwarding_rule` (`host_id`);