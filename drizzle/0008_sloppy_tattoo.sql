CREATE TABLE `planner_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`feature_id` text,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`previous_value` text,
	`new_value` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `planner_modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`feature_id`) REFERENCES `planner_features`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_planner_audit_module` ON `planner_audit_events` (`module_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_planner_audit_action` ON `planner_audit_events` (`action`,`created_at`);--> statement-breakpoint
CREATE TABLE `planner_change_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`feature_id` text,
	`proposal_type` text NOT NULL,
	`field_name` text,
	`previous_value` text,
	`proposed_value` text,
	`reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`created_by` text NOT NULL,
	`created_by_name` text NOT NULL,
	`reviewed_by` text,
	`reviewed_by_name` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `planner_modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`feature_id`) REFERENCES `planner_features`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_planner_proposals_module` ON `planner_change_proposals` (`module_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_planner_proposals_status` ON `planner_change_proposals` (`status`);--> statement-breakpoint
CREATE TABLE `planner_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`edited_at` integer,
	`removed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `planner_modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_planner_comments_module` ON `planner_comments` (`module_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `planner_dependencies` (
	`module_id` text NOT NULL,
	`depends_on_module_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`module_id`, `depends_on_module_id`),
	FOREIGN KEY (`module_id`) REFERENCES `planner_modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`depends_on_module_id`) REFERENCES `planner_modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_planner_dependencies_target` ON `planner_dependencies` (`depends_on_module_id`);--> statement-breakpoint
CREATE TABLE `planner_features` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`functional_specification` text DEFAULT '' NOT NULL,
	`acceptance_criteria` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Planned' NOT NULL,
	`approval_state` text DEFAULT 'Draft' NOT NULL,
	`archived_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `planner_modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_planner_features_module` ON `planner_features` (`module_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_planner_features_approval` ON `planner_features` (`approval_state`);--> statement-breakpoint
CREATE TABLE `planner_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`module_code` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`functional_requirements` text DEFAULT '' NOT NULL,
	`acceptance_criteria` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Planned' NOT NULL,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`owner_id` text,
	`owner_name` text DEFAULT 'Unassigned' NOT NULL,
	`target_release` text,
	`risk_level` text DEFAULT 'Medium' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`approval_state` text DEFAULT 'Draft' NOT NULL,
	`approved_snapshot` text,
	`archived_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `planner_modules_code_unique` ON `planner_modules` (`module_code`);--> statement-breakpoint
CREATE INDEX `idx_planner_modules_status` ON `planner_modules` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_planner_modules_approval` ON `planner_modules` (`approval_state`);--> statement-breakpoint
CREATE TABLE `planner_progress_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`previous_percentage` integer NOT NULL,
	`new_percentage` integer NOT NULL,
	`total_points` integer NOT NULL,
	`verified_points` integer NOT NULL,
	`evidence_reviewed` text DEFAULT '[]' NOT NULL,
	`tasks_changed` text DEFAULT '[]' NOT NULL,
	`scoring_version` text NOT NULL,
	`baseline_version` integer NOT NULL,
	`initiated_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `planner_project_goals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_planner_snapshots_goal` ON `planner_progress_snapshots` (`goal_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `planner_project_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`approved_scope` text DEFAULT '[]' NOT NULL,
	`completion_criteria` text DEFAULT '[]' NOT NULL,
	`target_milestones` text DEFAULT '[]' NOT NULL,
	`baseline_version` integer DEFAULT 1 NOT NULL,
	`approval_state` text DEFAULT 'Draft' NOT NULL,
	`approved_at` integer,
	`scoring_version` text DEFAULT 'gather-evidence-v1' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `planner_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`module_id` text NOT NULL,
	`name` text NOT NULL,
	`weight` integer NOT NULL,
	`stage` text DEFAULT 'Not started' NOT NULL,
	`requirements_evidence` text,
	`implementation_evidence` text,
	`tests_evidence` text,
	`sandbox_evidence` text,
	`production_evidence` text,
	`blocker` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `planner_project_goals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`module_id`) REFERENCES `planner_modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_planner_tasks_goal` ON `planner_tasks` (`goal_id`);--> statement-breakpoint
CREATE INDEX `idx_planner_tasks_module` ON `planner_tasks` (`module_id`);--> statement-breakpoint
CREATE TRIGGER `planner_audit_events_no_update`
BEFORE UPDATE ON `planner_audit_events`
BEGIN
	SELECT RAISE(ABORT, 'Planner audit events are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `planner_audit_events_no_delete`
BEFORE DELETE ON `planner_audit_events`
BEGIN
	SELECT RAISE(ABORT, 'Planner audit events are append-only');
END;
