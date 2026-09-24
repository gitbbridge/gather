// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const auctions = sqliteTable('auctions', {
  id: text('id').primaryKey(), owner: text('owner').notNull(),
  state: text('state').notNull(), version: integer('version').notNull().default(0),
}, t => [index('idx_auctions_owner').on(t.owner)]);
