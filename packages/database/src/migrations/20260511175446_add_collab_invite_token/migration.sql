CREATE TABLE `collab_invite_token` (
	`invite_id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`capability_hash` text NOT NULL,
	`capability_version` integer NOT NULL,
	`capability_nonce` text NOT NULL,
	`eph_pub_b64` text NOT NULL,
	`eph_priv_cipher` text NOT NULL,
	`exp` integer NOT NULL,
	`single_use` integer NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`consumed_at` integer,
	`revoked_at` integer,
	`server_synced_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_collab_invite_token_status` ON `collab_invite_token` (`status`);--> statement-breakpoint
CREATE INDEX `idx_collab_invite_token_exp` ON `collab_invite_token` (`exp`);--> statement-breakpoint
CREATE INDEX `idx_collab_invite_token_session_id` ON `collab_invite_token` (`session_id`);