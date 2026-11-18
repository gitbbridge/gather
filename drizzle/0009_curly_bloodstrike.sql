CREATE TABLE `planner_code_links` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`link_type` text NOT NULL,
	`label` text NOT NULL,
	`reference` text NOT NULL,
	`url` text NOT NULL,
	`source` text DEFAULT 'administrator' NOT NULL,
	`review_state` text DEFAULT 'Confirmed' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`module_id`) REFERENCES `planner_modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_planner_code_links_module` ON `planner_code_links` (`module_id`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `planner_code_link_unique` ON `planner_code_links` (`module_id`,`link_type`,`reference`);--> statement-breakpoint
CREATE TABLE `planner_github_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`event_type` text NOT NULL,
	`external_id` text NOT NULL,
	`sha` text,
	`title` text NOT NULL,
	`author` text DEFAULT 'Unknown' NOT NULL,
	`url` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`changed_files` text DEFAULT '[]' NOT NULL,
	`pull_request_number` integer,
	`matched_module_id` text,
	`match_method` text,
	`review_state` text DEFAULT 'Unreviewed' NOT NULL,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `planner_github_connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_module_id`) REFERENCES `planner_modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `planner_github_activity_external_unique` ON `planner_github_activities` (`connection_id`,`event_type`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_planner_github_activity_module` ON `planner_github_activities` (`matched_module_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_planner_github_activity_time` ON `planner_github_activities` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `planner_github_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`repository` text NOT NULL,
	`repository_url` text NOT NULL,
	`tracked_branch` text DEFAULT 'main' NOT NULL,
	`auth_mode` text DEFAULT 'public_read_only' NOT NULL,
	`status` text DEFAULT 'Not synchronized' NOT NULL,
	`latest_sha` text,
	`latest_message` text,
	`latest_author` text,
	`latest_commit_at` integer,
	`open_pull_requests` integer DEFAULT 0 NOT NULL,
	`last_synced_at` integer,
	`last_error` text,
	`rate_limit_remaining` integer,
	`sync_started_at` integer,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `planner_github_repository_unique` ON `planner_github_connections` (`owner`,`repository`);--> statement-breakpoint
ALTER TABLE `planner_progress_snapshots` ADD `module_scores` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `planner_progress_snapshots` ADD `readiness_summary` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `planner_progress_snapshots` ADD `blockers` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `planner_progress_snapshots` ADD `github_changes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `planner_progress_snapshots` ADD `assessment_findings` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `planner_progress_snapshots` ADD `configuration_snapshot` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `planner_project_goals` ADD `overall_completion` integer;--> statement-breakpoint
ALTER TABLE `planner_project_goals` ADD `last_assessment_at` integer;--> statement-breakpoint
ALTER TABLE `planner_tasks` ADD `baseline_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `planner_tasks` ADD `baseline_included` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `planner_tasks` ADD `weight_approved` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `planner_tasks` ADD `weight_approved_at` integer;--> statement-breakpoint
ALTER TABLE `planner_tasks` ADD `weight_approved_by` text;