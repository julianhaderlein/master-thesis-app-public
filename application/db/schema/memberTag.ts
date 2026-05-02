import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { tags } from './tag';

/**
 * Tracks which external peers have active shared transactions referencing each tag.
 * This is the single source of truth for deletion gating:
 * tags with no memberTags entries can be freely (hard) deleted.
 */
export const memberTags = sqliteTable(
  'member_tags',
  {
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    originPeerId: text('origin_peer_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tagId, table.originPeerId] }),
  ]
);

export type MemberTag = typeof memberTags.$inferSelect;
export type NewMemberTag = typeof memberTags.$inferInsert;
