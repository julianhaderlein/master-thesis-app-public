import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const spaces = sqliteTable('spaces', {
  id: text('id').primaryKey(),
  originPeerId: text('origin_peer_id').notNull(),
  name: text('name').notNull(),
  membershipStatus: text('membership_status').notNull().default('owner'), // 'owner' | 'member' | 'pending'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
