CREATE TABLE `auctions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_auctions_owner` ON `auctions` (`owner`);