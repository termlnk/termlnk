DROP TABLE IF EXISTS `ai_provider`;
--> statement-breakpoint
CREATE TABLE `ai_provider` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`builtin` integer DEFAULT false NOT NULL,
	`api` text,
	`api_key` text,
	`base_url` text,
	`headers` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_provider_model` (
	`id` text PRIMARY KEY,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`overrides` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_custom_model` (
	`id` text PRIMARY KEY,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`name` text NOT NULL,
	`api` text,
	`base_url` text,
	`reasoning` integer DEFAULT false NOT NULL,
	`input_modes` text,
	`cost` text,
	`context_window` integer DEFAULT 128000 NOT NULL,
	`max_tokens` integer DEFAULT 16384 NOT NULL,
	`headers` text,
	`compat` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_provider_model_provider_id` ON `ai_provider_model` (`provider_id`);
--> statement-breakpoint
CREATE INDEX `idx_custom_model_provider_id` ON `ai_custom_model` (`provider_id`);
