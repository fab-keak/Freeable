ALTER TABLE `published_sites` ADD `custom_domain` text;--> statement-breakpoint
ALTER TABLE `published_sites` ADD `domain_status` text DEFAULT 'none' NOT NULL;