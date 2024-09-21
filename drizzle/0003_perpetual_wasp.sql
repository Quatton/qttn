CREATE TABLE `game_words` (
	`game_id` text NOT NULL,
	`word_id` integer NOT NULL,
	`index` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`matched` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`word_id`, `game_id`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`content` text DEFAULT '' NOT NULL
);
