CREATE TABLE `chat_message` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`thinking` text,
	`tool_calls` text,
	`error` text,
	`usage` text,
	`compact_metadata` text,
	`hidden_in_ui` integer,
	`sort_order` integer NOT NULL,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_chat_message_session_id_chat_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `chat_session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `chat_session` (
	`id` text PRIMARY KEY,
	`title` text DEFAULT 'New Chat' NOT NULL,
	`model_provider` text,
	`model_id` text,
	`system_prompt` text,
	`thinking_level` text,
	`selected_skill_ids` text,
	`selected_tool_ids` text,
	`message_count` integer DEFAULT 0 NOT NULL,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `config` (
	`key` text PRIMARY KEY,
	`value` text,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `host` (
	`id` text PRIMARY KEY,
	`label` text NOT NULL,
	`type` text NOT NULL,
	`pid` text DEFAULT 'root' NOT NULL,
	`tree` text DEFAULT '' NOT NULL,
	`addr` text,
	`port` integer,
	`credential` text,
	`proxy` text,
	`settings` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`expanded` integer DEFAULT false NOT NULL,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mcp_oauth_token` (
	`id` text PRIMARY KEY,
	`server_id` text NOT NULL,
	`authorization_server_url` text,
	`resource_url` text,
	`client_id` text,
	`client_secret` text,
	`access_token` text,
	`refresh_token` text,
	`token_type` text,
	`expires_at` integer,
	`scope` text,
	`code_verifier` text,
	`last_refresh_at` text,
	`last_error` text,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_mcp_oauth_token_server_id_mcp_server_id_fk` FOREIGN KEY (`server_id`) REFERENCES `mcp_server`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
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
	`accessed_at` text NOT NULL,
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
	`input_modes` text DEFAULT '["text"]' NOT NULL,
	`cost` text,
	`context_window` integer DEFAULT 128000 NOT NULL,
	`max_tokens` integer DEFAULT 16384 NOT NULL,
	`headers` text,
	`compat` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
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
	`accessed_at` text NOT NULL,
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
	`accessed_at` text NOT NULL,
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
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `terminal_session_backup` (
	`id` text PRIMARY KEY,
	`data` text NOT NULL,
	`accessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_session_id` ON `chat_message` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_message_sort` ON `chat_message` (`session_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_pid` ON `host` (`pid`);--> statement-breakpoint
CREATE INDEX `idx_type` ON `host` (`type`);--> statement-breakpoint
CREATE INDEX `idx_server_id` ON `mcp_oauth_token` (`server_id`);--> statement-breakpoint
CREATE INDEX `idx_mcp_server_name` ON `mcp_server` (`name`);--> statement-breakpoint
CREATE INDEX `idx_custom_model_provider_id` ON `ai_custom_model` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_provider_model_provider_id` ON `ai_provider_model` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_skill_name` ON `skill` (`name`);--> statement-breakpoint
CREATE INDEX `idx_source` ON `skill` (`source`);