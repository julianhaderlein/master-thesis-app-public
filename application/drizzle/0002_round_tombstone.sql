CREATE TABLE `member_tags` (
	`tag_id` text NOT NULL,
	`origin_peer_id` text NOT NULL,
	PRIMARY KEY(`tag_id`, `origin_peer_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `tags` DROP COLUMN `origin_peer_id`;--> statement-breakpoint
ALTER TABLE `tags` DROP COLUMN `is_deleted`;