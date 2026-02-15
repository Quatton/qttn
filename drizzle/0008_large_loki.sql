PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_word_short_list` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`random` real DEFAULT (RANDOM()) NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `words`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_word_short_list`("id", "created_at", "random") SELECT "id", "created_at", "random" FROM `word_short_list`;--> statement-breakpoint
DROP TABLE `word_short_list`;--> statement-breakpoint
ALTER TABLE `__new_word_short_list` RENAME TO `word_short_list`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `random_index` ON `word_short_list` (`random`);