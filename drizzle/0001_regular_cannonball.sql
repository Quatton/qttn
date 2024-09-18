CREATE TABLE `words_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `sampled_count` integer DEFAULT 0 NOT NULL,
  `rejected_count` integer DEFAULT 0 NOT NULL,
  `rejected_rate` real DEFAULT 0 NOT NULL
)--> statement-breakpoint
INSERT INTO `words_new` (`id`, `name`, `sampled_count`, `rejected_count`, `rejected_rate`)
SELECT `id`, `name`, `sampled_count`, `rejected_count`, `rejected_rate`
FROM `words`--> statement-breakpoint
DROP TABLE `words`--> statement-breakpoint
ALTER TABLE `words_new` RENAME TO `words`
