import { relations } from 'drizzle-orm';
import { transactions } from './transaction';
import { tags } from './tag';
import { memberTags } from './memberTag';
import { spaces } from './space';
import { transactionTags } from './transactionTag';
import { transactionSpaces } from './transactionSpace';
import { accounts } from './account';
import { categories } from './category';
import { spaceMembers } from './spaceMember';

// Define relations for Transaction
export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  transactionTags: many(transactionTags),
  transactionSpaces: many(transactionSpaces),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],}),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

// Define relations for Tag
export const tagsRelations = relations(tags, ({ many }) => ({
  transactionTags: many(transactionTags),
  memberTags: many(memberTags),
}));

export const memberTagsRelations = relations(memberTags, ({ one }) => ({
  tag: one(tags, {
    fields: [memberTags.tagId],
    references: [tags.id],
  }),
}));

// Define relations for Space
export const spacesRelations = relations(spaces, ({ many }) => ({
  transactionSpaces: many(transactionSpaces),
  spaceMembers: many(spaceMembers),
}));

// Define relations for join tables
export const transactionTagsRelations = relations(transactionTags, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionTags.transactionId],
    references: [transactions.id],
  }),
  tag: one(tags, {
    fields: [transactionTags.tagId],
    references: [tags.id],
  }),
}));

export const transactionSpacesRelations = relations(transactionSpaces, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionSpaces.transactionId],
    references: [transactions.id],
  }),
  space: one(spaces, {
    fields: [transactionSpaces.spaceId],
    references: [spaces.id],
  }),
}));

export const spaceMembersRelations = relations(spaceMembers, ({ one }) => ({
  space: one(spaces, {
    fields: [spaceMembers.spaceId],
    references: [spaces.id],
  }),
}));
