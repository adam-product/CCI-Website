import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
export const content = sqliteTable("content", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  draft: text("draft").notNull(),
  published: text("published"),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});
export const staff = sqliteTable("staff", {
  email: text("email").primaryKey(),
  role: text("role").notNull(),
  active: integer("active").notNull().default(1),
});
export const staffCredentials = sqliteTable("staff_credentials", {
  email: text("email")
    .primaryKey()
    .references(() => staff.email, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  setupExpiresAt: integer("setup_expires_at"),
  sessionHash: text("session_hash"),
  sessionUserId: text("session_user_id"),
  sessionExpiresAt: integer("session_expires_at"),
  resetTokenHash: text("reset_token_hash"),
  resetExpiresAt: integer("reset_expires_at"),
  emailStatus: text("email_status").notNull().default("manual"),
}, (table) => [uniqueIndex("staff_reset_token_hash").on(table.resetTokenHash)]);
export const enquiries = sqliteTable("enquiries", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  enquiryType: text("enquiry_type"),
  organisation: text("organisation"),
  location: text("location"),
  message: text("message").notNull(),
  status: text("status").notNull().default("New"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  alt: text("alt").notNull(),
  createdAt: text("created_at").notNull(),
});
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  createdAt: text("created_at").notNull(),
});
export const limits = sqliteTable("limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expires: integer("expires").notNull(),
});
