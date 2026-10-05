import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  url: text("url").notNull(),
  backendUrl: text("backend_url").notNull().default(""),
  description: text("description").notNull().default(""),
  category: varchar("category", { length: 100 }).notNull().default(""),
  owner: varchar("owner", { length: 120 }).notNull().default(""),
  status: varchar("status", { length: 24 }).notNull().default("in-development"),
  techStack: varchar("tech_stack", { length: 400 }).notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const siteLinks = pgTable("site_links", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 24 }).notNull().default("other"),
  label: varchar("label", { length: 100 }).notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const adminSessions = pgTable("admin_sessions", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const siteImages = pgTable("site_images", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 180 }).notNull(),
  mimeType: varchar("mime_type", { length: 40 }).notNull(),
  altText: varchar("alt_text", { length: 180 }).notNull().default(""),
  data: text("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().default(1),
  logoData: text("logo_data"),
  badgeText: varchar("badge_text", { length: 80 }).notNull().default("YOUR DIGITAL HOME"),
  heroHeading: varchar("hero_heading", { length: 120 }).notNull().default("GOOD THINGS,"),
  heroHighlight: varchar("hero_highlight", { length: 120 }).notNull().default("ALL IN ONE PLACE."),
  heroDescription: text("hero_description").notNull().default("Your calm corner of the internet. The sites your collective loves, ready whenever you need them."),
  collectionHeading: varchar("collection_heading", { length: 120 }).notNull().default("PROJECT DIRECTORY"),
  collectionDescription: varchar("collection_description", { length: 300 }).notNull().default("Open the right environment, repository, or deployment for each project."),
  aboutText: varchar("about_text", { length: 300 }).notNull().default("Made for a little more focus, and a little less searching."),
  footerOrganization: varchar("footer_organization", { length: 120 }).notNull().default("Palawan Collective"),
  footerTagline: varchar("footer_tagline", { length: 300 }).notNull().default("A shared developer directory for our project environments, repositories, and deployments."),
  footerEmail: varchar("footer_email", { length: 180 }).notNull().default(""),
  footerPhone: varchar("footer_phone", { length: 60 }).notNull().default(""),
  footerLocation: varchar("footer_location", { length: 180 }).notNull().default("Manila × Texas"),
  footerLegal: varchar("footer_legal", { length: 200 }).notNull().default("All rights reserved."),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const footerLinks = pgTable("footer_links", {
  id: serial("id").primaryKey(),
  platform: varchar("platform", { length: 24 }).notNull().default("link"),
  label: varchar("label", { length: 80 }).notNull(),
  url: text("url").notNull(),
  group: varchar("group_name", { length: 24 }).notNull().default("social"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const siteMedia = pgTable("site_media", {
  id: serial("id").primaryKey(),
  filename: varchar("filename", { length: 180 }).notNull(),
  mimeType: varchar("mime_type", { length: 40 }).notNull(),
  altText: varchar("alt_text", { length: 180 }).notNull().default(""),
  data: text("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SiteRecord = typeof sites.$inferSelect;
export type SiteLinkRecord = typeof siteLinks.$inferSelect;
export type SiteImageRecord = typeof siteImages.$inferSelect;
export type SiteImageSummary = Pick<SiteImageRecord, "id" | "siteId" | "filename" | "mimeType" | "altText" | "createdAt">;
export type SiteDirectoryEntry = SiteRecord & {
  links: SiteLinkRecord[];
  images: SiteImageSummary[];
};
export type SiteSettingsRecord = typeof siteSettings.$inferSelect;
export type FooterLinkRecord = typeof footerLinks.$inferSelect;
export type SiteMediaRecord = typeof siteMedia.$inferSelect;
export type SiteMediaSummary = Pick<SiteMediaRecord, "id" | "filename" | "mimeType" | "altText" | "createdAt">;
