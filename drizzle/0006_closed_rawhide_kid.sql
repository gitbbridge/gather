CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`auction_id` text,
	`record_type` text NOT NULL,
	`record_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_role` text NOT NULL,
	`previous_state` text,
	`new_state` text,
	`reason` text,
	`authorization_reference` text,
	`source_system` text DEFAULT 'gather_d1' NOT NULL,
	`correlation_id` text NOT NULL,
	`previous_integrity_hash` text,
	`integrity_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_auction_time` ON `audit_events` (`auction_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_organization_time` ON `audit_events` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_record` ON `audit_events` (`record_type`,`record_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_correlation` ON `audit_events` (`correlation_id`);--> statement-breakpoint
CREATE TRIGGER `audit_events_no_update`
BEFORE UPDATE ON `audit_events`
BEGIN
	SELECT RAISE(ABORT, 'Committed audit events cannot be updated');
END;--> statement-breakpoint
CREATE TRIGGER `audit_events_no_delete`
BEFORE DELETE ON `audit_events`
BEGIN
	SELECT RAISE(ABORT, 'Committed audit events cannot be deleted');
END;
