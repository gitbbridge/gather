CREATE TABLE `sandbox_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`user_role` text NOT NULL,
	`workflow_area` text NOT NULL,
	`issue_type` text NOT NULL,
	`priority` text NOT NULL,
	`description` text NOT NULL,
	`expected_behavior` text NOT NULL,
	`actual_behavior` text NOT NULL,
	`page_url` text NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sandbox_issues_fingerprint_unique` ON `sandbox_issues` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_sandbox_issues_status_time` ON `sandbox_issues` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sandbox_issues_role` ON `sandbox_issues` (`user_role`);--> statement-breakpoint
CREATE INDEX `idx_sandbox_issues_priority` ON `sandbox_issues` (`priority`);--> statement-breakpoint
CREATE TABLE `security_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`request_count` integer NOT NULL,
	`reset_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_security_rate_limits_reset` ON `security_rate_limits` (`reset_at`);