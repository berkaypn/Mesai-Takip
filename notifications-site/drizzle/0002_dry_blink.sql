PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_phone_tests` (
	`device` text NOT NULL,
	`scenario` text NOT NULL,
	`due` integer NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`device`, `scenario`)
);
--> statement-breakpoint
INSERT INTO `__new_phone_tests`("device", "scenario", "due", "expires") SELECT "device", "scenario", "due", "expires" FROM `phone_tests`;--> statement-breakpoint
DROP TABLE `phone_tests`;--> statement-breakpoint
ALTER TABLE `__new_phone_tests` RENAME TO `phone_tests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;