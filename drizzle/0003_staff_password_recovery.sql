ALTER TABLE `staff_credentials` ADD `reset_token_hash` text;--> statement-breakpoint
ALTER TABLE `staff_credentials` ADD `reset_expires_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `staff_reset_token_hash` ON `staff_credentials` (`reset_token_hash`);