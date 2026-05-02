ALTER TABLE `accounts` DROP COLUMN `is_deleted`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `is_deleted`;--> statement-breakpoint
ALTER TABLE `categories` DROP COLUMN `is_deleted`;--> statement-breakpoint
ALTER TABLE `budgets` DROP COLUMN `is_deleted`;--> statement-breakpoint
ALTER TABLE `goals` DROP COLUMN `is_deleted`;--> statement-breakpoint
ALTER TABLE `spaces` DROP COLUMN `is_deleted`;