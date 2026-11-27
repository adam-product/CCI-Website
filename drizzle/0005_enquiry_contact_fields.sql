ALTER TABLE `enquiries` ADD `enquiry_type` text;--> statement-breakpoint
ALTER TABLE `enquiries` ADD `organisation` text;--> statement-breakpoint
ALTER TABLE `enquiries` ADD `location` text;--> statement-breakpoint
UPDATE content
SET draft = replace(draft, 'The contact form asks for your name, email address, subject, and message.',
    'The contact form asks for your name, email address, inquiry type, and message. You can also provide your organisation or institution and your country or location.'),
  published = replace(published, 'The contact form asks for your name, email address, subject, and message.',
    'The contact form asks for your name, email address, inquiry type, and message. You can also provide your organisation or institution and your country or location.'),
  version = version + 1
WHERE id = 'privacy' AND (
  instr(draft, 'The contact form asks for your name, email address, subject, and message.') > 0
  OR instr(published, 'The contact form asks for your name, email address, subject, and message.') > 0
);
