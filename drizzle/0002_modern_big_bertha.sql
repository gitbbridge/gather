CREATE TABLE `closeout_records` (
	`auction_id` text NOT NULL,
	`user_id` text NOT NULL,
	`pickup_status` text DEFAULT 'pending' NOT NULL,
	`followup_status` text DEFAULT 'not_sent' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`auction_id`, `user_id`),
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_closeout_auction` ON `closeout_records` (`auction_id`);