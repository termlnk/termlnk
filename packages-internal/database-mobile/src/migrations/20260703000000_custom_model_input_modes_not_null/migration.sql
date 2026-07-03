CREATE TABLE `__new_ai_custom_model` (
	`id` text PRIMARY KEY,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`name` text NOT NULL,
	`api` text,
	`base_url` text,
	`reasoning` integer DEFAULT false NOT NULL,
	`input_modes` text DEFAULT '["text"]' NOT NULL,
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
INSERT INTO `__new_ai_custom_model` (`id`, `provider_id`, `model_id`, `name`, `api`, `base_url`, `reasoning`, `input_modes`, `cost`, `context_window`, `max_tokens`, `headers`, `compat`, `sort`, `created_at`, `updated_at`)
SELECT `id`, `provider_id`, `model_id`, `name`, `api`, `base_url`, `reasoning`, coalesce(`input_modes`, '["text"]'), `cost`, `context_window`, `max_tokens`, `headers`, `compat`, `sort`, `created_at`, `updated_at` FROM `ai_custom_model`;
--> statement-breakpoint
DROP TABLE `ai_custom_model`;
--> statement-breakpoint
ALTER TABLE `__new_ai_custom_model` RENAME TO `ai_custom_model`;
--> statement-breakpoint
CREATE INDEX `idx_custom_model_provider_id` ON `ai_custom_model` (`provider_id`);
