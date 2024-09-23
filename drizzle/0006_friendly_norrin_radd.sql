CREATE TABLE `word_short_list` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`random` real DEFAULT (RANDOM()) NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `words`(`id`) ON UPDATE cascade ON DELETE cascade
);
