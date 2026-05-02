/**
 * Tag utility functions
 */

import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Fixed color palette for tags (~10 colors).
 * Colors are assigned deterministically by hashing the tag slug.
 */
export const TAG_PALETTE: string[] = [
  '#EF5350', // red
  '#FF7043', // deep-orange
  '#FFCA28', // amber
  '#66BB6A', // green
  '#26C6DA', // cyan
  '#42A5F5', // blue
  '#7E57C2', // deep-purple
  '#EC407A', // pink
  '#26A69A', // teal
  '#8D6E63', // brown
];

/**
 * Convert a tag name to a stable slug ID.
 * e.g. "Fast Food" → "fast-food"
 */
export function toTagSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Deterministically pick a palette color for a given slug.
 * Same slug → same color across all peers.
 */
export function colorForSlug(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length]!;
}

/**
 * Format a slug back to a human-readable label.
 * e.g. "fast-food" → "Fast food"
 */
export function formatSlug(slug: string): string {
  const spaced = slug.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Delete a tag row if it has become fully orphaned —
 * i.e. no member_tags rows AND no transaction_tags rows reference it.
 *
 * Skipped when `tagOwnerPeerId === currentUsername` (the local user created
 * the tag — they should always be able to keep it even after removing all
 * references).
 *
 * For peer-owned tags (`tagOwnerPeerId !== currentUsername`) the tag is
 * deleted as soon as it is no longer referenced.
 */
export async function deleteTagIfOrphaned(
  db: ExpoSQLiteDatabase<typeof schema>,
  tagId: string,
  tagOwnerPeerId: string,
  currentUsername: string
): Promise<void> {
  if (tagOwnerPeerId === currentUsername) return;
  const [memberTagCount, transactionTagCount] = await Promise.all([
    db.$count(schema.memberTags, eq(schema.memberTags.tagId, tagId)),
    db.$count(schema.transactionTags, eq(schema.transactionTags.tagId, tagId)),
  ]);
  if (memberTagCount === 0 && transactionTagCount === 0) {
    await db.delete(schema.tags).where(eq(schema.tags.id, tagId));
  }
}
