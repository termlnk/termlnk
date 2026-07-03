CREATE TABLE `mcp_server` (
	`id` text PRIMARY KEY,
	`registry_id` text,
	`name` text NOT NULL,
	`description` text,
	`transport` text NOT NULL,
	`config` text NOT NULL,
	`capabilities` text,
	`tool_count` integer DEFAULT 0 NOT NULL,
	`resource_count` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skill` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`source` text NOT NULL,
	`registry_id` text,
	`version` text,
	`enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`checksum` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_mcp_server_name` ON `mcp_server` (`name`);
--> statement-breakpoint
CREATE INDEX `idx_skill_name` ON `skill` (`name`);
--> statement-breakpoint
CREATE INDEX `idx_source` ON `skill` (`source`);
