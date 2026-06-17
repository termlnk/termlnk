CREATE TABLE `snippet` (
	`id` text PRIMARY KEY,
	`label` text NOT NULL,
	`type` text NOT NULL,
	`pid` text DEFAULT 'root' NOT NULL,
	`tree` text DEFAULT '' NOT NULL,
	`content` text,
	`description` text,
	`target_host_ids` text,
	`favorite` integer DEFAULT false NOT NULL,
	`expanded` integer DEFAULT false NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_snippet_pid` ON `snippet` (`pid`);--> statement-breakpoint
CREATE INDEX `idx_snippet_type` ON `snippet` (`type`);