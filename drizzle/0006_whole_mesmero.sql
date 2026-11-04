CREATE TABLE `assistant_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`nonprofit_id` text,
	`auction_id` text,
	`item_id` text,
	`user_id` text NOT NULL,
	`user_email` text,
	`audience` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`subject` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`escalated_at` integer,
	`resolved_at` integer,
	FOREIGN KEY (`nonprofit_id`) REFERENCES `nonprofits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_assistant_conversations_nonprofit` ON `assistant_conversations` (`nonprofit_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_assistant_conversations_user` ON `assistant_conversations` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_assistant_conversations_auction` ON `assistant_conversations` (`auction_id`);--> statement-breakpoint
CREATE TABLE `assistant_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`needs_escalation` integer DEFAULT false NOT NULL,
	`model` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`latency_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `assistant_conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_assistant_messages_conversation` ON `assistant_messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_assistant_messages_created` ON `assistant_messages` (`created_at`);