CREATE TABLE `ai_provider` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`builtin` integer DEFAULT false NOT NULL,
	`api_type` text NOT NULL,
	`base_url` text,
	`headers` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_chat_session` (
	`id` text PRIMARY KEY,
	`title` text DEFAULT 'New Chat' NOT NULL,
	`provider_id` text,
	`model_id` text,
	`message_count` integer DEFAULT 0 NOT NULL,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_chat_message` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`parts` text NOT NULL,
	`usage` text,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_ai_chat_message_session_id_ai_chat_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `ai_chat_session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_ai_chat_message_session` ON `ai_chat_message` (`session_id`,`sort_order`);