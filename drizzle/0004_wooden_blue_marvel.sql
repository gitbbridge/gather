CREATE TABLE `stripe_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`object_id` text,
	`account_id` text,
	`livemode` integer NOT NULL,
	`status` text DEFAULT 'accepted' NOT NULL,
	`stripe_created_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`processed_at` integer,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `idx_stripe_events_status` ON `stripe_webhook_events` (`status`);--> statement-breakpoint
CREATE INDEX `idx_stripe_events_created` ON `stripe_webhook_events` (`stripe_created_at`);