CREATE TABLE `phone_tests` (
	`device` text PRIMARY KEY NOT NULL,
	`scenario` text NOT NULL,
	`due` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `devices` ADD `origin` text DEFAULT 'https://berkaypn.github.io' NOT NULL;