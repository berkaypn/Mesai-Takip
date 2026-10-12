CREATE TABLE `deliveries` (
	`device` text NOT NULL,
	`tag` text NOT NULL,
	`status` text NOT NULL,
	`lease_until` integer NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`device`, `tag`)
);
--> statement-breakpoint
CREATE INDEX `deliveries_lease` ON `deliveries` (`lease_until`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`seq` integer NOT NULL,
	`subscription` text,
	`prefs` text NOT NULL,
	`snapshot` text NOT NULL,
	`updated_at` integer NOT NULL,
	`last_test` integer DEFAULT 0 NOT NULL
);
