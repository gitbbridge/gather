CREATE TABLE `nonprofits` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`headline` text NOT NULL,
	`mission` text NOT NULL,
	`accent` text DEFAULT '#175b47' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nonprofits_slug_unique` ON `nonprofits` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_nonprofits_owner` ON `nonprofits` (`owner`);--> statement-breakpoint
CREATE TABLE `registrations` (
	`nonprofit_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`nonprofit_id`, `user_id`),
	FOREIGN KEY (`nonprofit_id`) REFERENCES `nonprofits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `auctions` ADD `nonprofit_id` text REFERENCES nonprofits(id);--> statement-breakpoint
CREATE INDEX `idx_auctions_nonprofit` ON `auctions` (`nonprofit_id`);