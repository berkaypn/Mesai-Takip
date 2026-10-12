import { integer, primaryKey, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  seq: integer("seq").notNull(),
  subscription: text("subscription"),
  prefs: text("prefs").notNull(),
  snapshot: text("snapshot").notNull(),
  updatedAt: integer("updated_at").notNull(),
  lastTest: integer("last_test").notNull().default(0),
  origin: text("origin").notNull().default("https://berkaypn.github.io"),
});

export const deliveries = sqliteTable("deliveries", {
  device: text("device").notNull(),
  tag: text("tag").notNull(),
  status: text("status").notNull(),
  leaseUntil: integer("lease_until").notNull(),
  attempts: integer("attempts").notNull().default(1),
}, table => [primaryKey({columns:[table.device,table.tag]}),index("deliveries_lease").on(table.leaseUntil)]);

export const phoneTests = sqliteTable("phone_tests", {
  device: text("device").notNull(),
  scenario: text("scenario").notNull(),
  due: integer("due").notNull(),
  expires: integer("expires").notNull(),
}, table => [primaryKey({columns:[table.device,table.scenario]})]);
