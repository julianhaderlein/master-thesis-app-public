import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { accounts } from './account';
import { categories } from './category';

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  originPeerId: text('origin_peer_id').notNull(),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  type: text('type').notNull(), // 'income' or 'expense'
  description: text('description'),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  signedAmount: real('signed_amount').notNull().generatedAlwaysAs(
    sql`(amount * iif(type = 'income', 1, -1))`,
    { mode: 'stored' }
  ),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
