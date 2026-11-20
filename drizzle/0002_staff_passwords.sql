CREATE TABLE `staff_credentials` (
	`email` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`setup_expires_at` integer,
	`session_hash` text,
	`session_user_id` text,
	`session_expires_at` integer,
	FOREIGN KEY (`email`) REFERENCES `staff`(`email`) ON UPDATE no action ON DELETE cascade
);
