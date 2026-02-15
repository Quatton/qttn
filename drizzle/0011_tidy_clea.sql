CREATE TABLE `story_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`story_id` text NOT NULL,
	`ip_address` text NOT NULL,
	`utm_source` text DEFAULT 'direct' NOT NULL,
	`view_date` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `story_views_story_id_index` ON `story_views` (`story_id`);--> statement-breakpoint
CREATE INDEX `story_views_created_at_index` ON `story_views` (`created_at`);--> statement-breakpoint
CREATE INDEX `story_views_utm_source_index` ON `story_views` (`utm_source`);--> statement-breakpoint
CREATE UNIQUE INDEX `story_views_daily_unique_ip_index` ON `story_views` (`story_id`,`ip_address`,`utm_source`,`view_date`);