import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { transactions } from './transaction';
import { spaces } from './space';

export const transactionSpaces = sqliteTable(
  'transaction_spaces',
  {
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    spaceId: text('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.transactionId, table.spaceId] }),
  ]
);

export type TransactionSpace = typeof transactionSpaces.$inferSelect;
export type NewTransactionSpace = typeof transactionSpaces.$inferInsert;
