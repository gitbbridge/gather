CREATE TABLE `nonprofit_payment_accounts` (
	`nonprofit_id` text PRIMARY KEY NOT NULL,
	`stripe_account_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`card_payments_status` text DEFAULT 'pending' NOT NULL,
	`payouts_status` text DEFAULT 'pending' NOT NULL,
	`livemode` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`nonprofit_id`) REFERENCES `nonprofits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nonprofit_payment_accounts_stripe_account_id_unique` ON `nonprofit_payment_accounts` (`stripe_account_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_accounts_status` ON `nonprofit_payment_accounts` (`status`);