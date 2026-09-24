CREATE TABLE `nonprofit_homepages` (
	`nonprofit_id` text PRIMARY KEY NOT NULL,
	`draft` text NOT NULL,
	`published` text,
	`draft_version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`nonprofit_id`) REFERENCES `nonprofits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_homepages_updated` ON `nonprofit_homepages` (`updated_at`);