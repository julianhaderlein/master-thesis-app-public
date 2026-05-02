/**
 * P2PProvider
 *
 * Consolidates all P2P space and sharing operations into a single React context.
 * Replaces the module-level singleton pattern from space-manager.ts,
 * space-sharing.ts, and p2p-sync-handlers.ts.
 *
 * Depends on: RPCProvider (useRPC), DatabaseProvider (useDatabase),
 *             UsernameProvider (useUsername).
 */

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import * as schema from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import type HRPC from '@/generated/spec/hrpc';
import type { DrizzleDB } from '@/db/index';
import { useUsername } from '@/services/username-provider';
import { formatSlug, colorForSlug, deleteTagIfOrphaned } from '@/services/tag-utils';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface P2PContextType {
  isReady: boolean;
  // Space management
  createSpace: (name: string, description?: string) => Promise<string>;
  openSpace: (spaceId: string) => Promise<void>;
  closeSpace: (spaceId: string) => Promise<void>;
  joinSpace: (spaceId: string, inviteCode: string) => Promise<string>;
  // Transaction sharing
  shareTransactionToSpace: (transactionId: string, spaceId: string) => Promise<void>;
  unshareTransactionFromSpace: (transactionId: string, spaceId: string) => Promise<void>;
  updateTransactionInSpaces: (
    transactionId: string,
    updates: {
      amount?: number;
      type?: string;
      categoryId?: string;
      description?: string;
      date?: Date;
      notes?: string;
      tagIds?: string[];
    },
    spaceIds: string[]
  ) => Promise<void>;
  removeTransactionFromAllSpaces: (transactionId: string, spaceIds: string[]) => Promise<void>;
  createSpaceInvite: (spaceId: string) => Promise<string>;
}

const P2PContext = createContext<P2PContextType | null>(null);

export function useP2P(): P2PContextType {
  const ctx = useContext(P2PContext);
  if (!ctx) throw new Error('useP2P must be used within P2PProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function P2PProvider({ rpc, isBackendReady, db, children }: {
  rpc: HRPC | null;
  isBackendReady: boolean;
  db: DrizzleDB;
  children: ReactNode;
}) {
  const { username } = useUsername();
  const initializedRef = useRef(false);
  const isReadyRef = useRef(false);

  // -------------------------------------------------------------------------
  // Incoming sync handlers (Bare → React Native)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!rpc || !isBackendReady || !db || initializedRef.current) return;
    initializedRef.current = true;
    isReadyRef.current = true;

    rpc.onSyncShareTransaction(async (data: {
      spaceId: string; id: string; accountId?: string; amount: number; currency: string; type: string;
      categoryId?: string; description?: string; date: number; notes?: string;
      originPeerId: string; tagIds?: string[];
    }) => {
      console.log('[P2P] Received syncShareTransaction:', data.id);
      try {
        if (data.amount <= 0) throw new Error('Invalid amount');
        if (data.type !== 'income' && data.type !== 'expense') throw new Error('Invalid transaction type');

        if (data.categoryId) {
          await db.insert(schema.categories)
            .values({ id: data.categoryId, originPeerId: 'system' })
            .onConflictDoNothing();
        }

        await db.insert(schema.transactions)
          .values({
            id: data.id,
            originPeerId: data.originPeerId,
            categoryId: data.categoryId || null,
            amount: data.amount,
            currency: data.currency,
            type: data.type,
            description: data.description || null,
            date: new Date(data.date),
            notes: data.notes || null,
          })
          .onConflictDoUpdate({
            target: schema.transactions.id,
            set: {
              amount: data.amount, type: data.type,
              currency: data.currency,
              categoryId: data.categoryId || null,
              description: data.description || null,
              date: new Date(data.date), notes: data.notes || null,
              updatedAt: new Date(),
            },
          });

        // Add to transaction_spaces join table
        await db.insert(schema.transactionSpaces)
          .values({ transactionId: data.id, spaceId: data.spaceId })
          .onConflictDoNothing();

        // Upsert tags + memberTags, then replace transaction_tags unconditionally
        const tagIds = data.tagIds ?? [];
        for (const slug of tagIds) {
          await db.insert(schema.tags)
            .values({ id: slug, name: formatSlug(slug), color: colorForSlug(slug) })
            .onConflictDoNothing();
          await db.insert(schema.memberTags)
            .values({ tagId: slug, originPeerId: data.originPeerId })
            .onConflictDoNothing();
        }
        await db.delete(schema.transactionTags)
          .where(eq(schema.transactionTags.transactionId, data.id));
        if (tagIds.length > 0) {
          await db.insert(schema.transactionTags)
            .values(tagIds.map(tagId => ({ transactionId: data.id, tagId })))
            .onConflictDoNothing();
        }

        return { success: true };
      } catch (error) {
        console.error('[P2P] Failed syncShareTransaction:', error);
        return { success: false };
      }
    });

    rpc.onSyncUnshareTransaction(async (data: {
      spaceId: string; transactionId: string; originPeerId: string;
    }) => {
      console.log('[P2P] Received syncUnshareTransaction:', data.transactionId);
      try {
        const currentUsername = username ?? '';

        // Clean up memberTags before removing transaction, if this is the last space sharing this transaction
        const txTags = await db.query.transactionTags.findMany({
          where: eq(schema.transactionTags.transactionId, data.transactionId),
        });
        const otherSpaces = await db.query.transactionSpaces.findMany({
          where: and(
            eq(schema.transactionSpaces.transactionId, data.transactionId),
            ne(schema.transactionSpaces.spaceId, data.spaceId)
          ),
        });

        if (otherSpaces.length === 0) {
          for (const tt of txTags) {
            // Check if this peer has any OTHER shared transactions referencing this tag
            const others = await db.query.transactionTags.findMany({
              where: and(
                eq(schema.transactionTags.tagId, tt.tagId),
                ne(schema.transactionTags.transactionId, data.transactionId)
              ),
              with: { transaction: { with: { transactionSpaces: true } } },
            });
            const hasOtherShared = others.some(
              (o) =>
                o.transaction?.originPeerId === data.originPeerId &&
                (o.transaction?.transactionSpaces?.length ?? 0) > 0
            );
            if (!hasOtherShared) {
              await db.delete(schema.memberTags)
                .where(and(
                  eq(schema.memberTags.tagId, tt.tagId),
                  eq(schema.memberTags.originPeerId, data.originPeerId)
                ));
              await deleteTagIfOrphaned(db, tt.tagId, data.originPeerId, currentUsername);
            }
          }
        }
    
        // Remove from transaction_spaces join table
        await db.delete(schema.transactionSpaces)
          .where(and(
            eq(schema.transactionSpaces.transactionId, data.transactionId),
            eq(schema.transactionSpaces.spaceId, data.spaceId)
          ));

        // Delete the transaction row if it was a remote peer's transaction and
        // no other spaces still reference it (we have no local ownership of it).
        if (otherSpaces.length === 0 && data.originPeerId !== currentUsername) {
          await db.delete(schema.transactions)
            .where(eq(schema.transactions.id, data.transactionId));
        }

        return { success: true };
      } catch (error) {
        console.error('[P2P] Failed syncUnshareTransaction:', error);
        return { success: false };
      }
    });

    // --- update-transaction ---
    rpc.onSyncUpdateTransaction(async (data: {
      spaceId: string; transactionId: string; amount?: number; type?: string;
      categoryId?: string; description?: string; date?: number; notes?: string;
      originPeerId: string; tagIds?: string[];
    }) => {
      console.log('[P2P] Received syncUpdateTransaction:', data.transactionId);
      try {
        // Only hit the DB when there is something real to update on the transaction row.
        const nonMetaKeys = Object.keys(data).filter(
          k => !['originPeerId', 'transactionId', 'spaceId'].includes(k)
        );
        if (nonMetaKeys.length === 0) return { success: true };

        // Upsert category so foreign key doesn't fail
        if (data.categoryId) {
          await db.insert(schema.categories)
            .values({ id: data.categoryId, originPeerId: 'system' })
            .onConflictDoNothing();
        }

        // Build column-only update object — exclude HRPC metadata keys that
        // are not columns on the transactions table.
        const { spaceId: _spaceId, transactionId: _txId, originPeerId: _peerId, tagIds: _tagIds, ...columnFields } = data;
        const columnUpdates: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(columnFields)) {
          if (v !== undefined) columnUpdates[k] = v;
        }
        if (data.date !== undefined) {
          columnUpdates.date = new Date(data.date);
        }

        if (Object.keys(columnUpdates).length > 0) {
          await db.update(schema.transactions)
            .set({ ...columnUpdates, updatedAt: new Date() })
            .where(eq(schema.transactions.id, data.transactionId));
        }

        // Update tags: upsert tags + memberTags, then replace transaction_tags
        if (data.tagIds) {
          await syncTagsForTransaction(data.transactionId, data.originPeerId, data.tagIds);
        }
        return { success: true };
      } catch (error) {
        console.error('[P2P] Failed syncUpdateTransaction:', error);
        return { success: false };
      }
    });

    // --- member announcement ---
    rpc.onUpdateMemberAnnouncement(async (data: {
      spaceId: string; peerId: string; role: string; joinedAt: number;
    }) => {
      console.log('[P2P] Received updateMemberAnnouncement:', data.spaceId, data.peerId);
      await db.insert(schema.spaceMembers)
        .values({
          spaceId: data.spaceId,
          peerId: data.peerId,
          role: data.role as 'owner' | 'member',
          joinedAt: new Date(Number(data.joinedAt)),
        })
        .onConflictDoUpdate({
          target: [schema.spaceMembers.spaceId, schema.spaceMembers.peerId],
          set: {
            role: data.role as 'owner' | 'member',
            joinedAt: new Date(Number(data.joinedAt)),
          },
        });
      return {};
    });

    // --- space metadata ---
    rpc.onUpdateSpaceMetadata(async (data: {
      spaceId: string; spaceName: string; ownerUsername: string;
    }) => {
      console.log('[P2P] Received updateSpaceMetadata:', data.spaceId);
      await db.update(schema.spaces)
        .set({ name: data.spaceName, originPeerId: data.ownerUsername, updatedAt: new Date() })
        .where(eq(schema.spaces.id, data.spaceId));
      return {};
    });

    // Reopen all Spaces from previous session
    (async () => {
      try {
        const spaces = await db.query.spaces.findMany();
        for (const space of spaces) {
          try {
            await rpc.openSpace({ spaceId: space.id });
          } catch (err) {
            console.error(`[P2P] Failed to reopen Space ${space.id}:`, err);
          }
        }
        console.log(`[P2P] Reopened ${spaces.length} space(s)`);
      } catch (err) {
        console.error('[P2P] Failed to reopen spaces:', err);
      }
    })();

    console.log('[P2P] Provider initialized');
  }, [rpc, isBackendReady, db]);

  // -------------------------------------------------------------------------
  // Helper: sync tags for a transaction (used by syncUpdateTransaction)
  // -------------------------------------------------------------------------

  async function syncTagsForTransaction(
    transactionId: string,
    originPeerId: string,
    newTagIds: string[]
  ) {
    const current = await db.query.transactionTags.findMany({
      where: eq(schema.transactionTags.transactionId, transactionId),
    });
    const currentIds = current.map(tt => tt.tagId);

    for (const addedTag of newTagIds.filter(id => !currentIds.includes(id))) {
      await db.insert(schema.tags)
        .values({ id: addedTag, name: formatSlug(addedTag), color: colorForSlug(addedTag) })
        .onConflictDoNothing();

      await db.insert(schema.memberTags)
        .values({ tagId: addedTag, originPeerId })
        .onConflictDoNothing();
        
      await db.insert(schema.transactionTags)
        .values({ transactionId, tagId: addedTag });
    }

    for (const removedTag of currentIds.filter(id => !newTagIds.includes(id))) {
      await db.delete(schema.transactionTags)
        .where(and(
          eq(schema.transactionTags.transactionId, transactionId),
          eq(schema.transactionTags.tagId, removedTag)
        ));
      await db.delete(schema.memberTags)
        .where(and(
          eq(schema.memberTags.tagId, removedTag),
          eq(schema.memberTags.originPeerId, originPeerId)
        ));
      await deleteTagIfOrphaned(db, removedTag, originPeerId, username ?? '');
    }
  }

  // -------------------------------------------------------------------------
  // Outbound operations (React Native → Bare)
  // -------------------------------------------------------------------------

  async function createSpace(name: string): Promise<string> {
    if (!rpc || !isBackendReady) throw new Error('P2P not ready');
    const currentUsername = username ?? '';

    const { spaceId } = await rpc.createSpace();
    await rpc.appendSpaceMetadata({ spaceId, spaceName: name, ownerUsername: currentUsername });
    await rpc.appendMemberAnnouncement({ spaceId, peerId: currentUsername, role: 'owner' });

    await db.insert(schema.spaces).values({
      id: spaceId, name, originPeerId: currentUsername,
      membershipStatus: 'owner', createdAt: new Date(), updatedAt: new Date(),
    });
    await db.insert(schema.spaceMembers).values({
      spaceId, peerId: currentUsername, role: 'owner', joinedAt: new Date(),
    });

    console.log('[P2P] Created Space:', spaceId);
    return spaceId;
  }

  async function openSpace(spaceId: string): Promise<void> {
    if (!rpc || !isBackendReady) throw new Error('P2P not ready');
    await rpc.openSpace({ spaceId });
  }

  async function closeSpace(spaceId: string): Promise<void> {
    if (!rpc || !isBackendReady) throw new Error('P2P not ready');
    await rpc.closeSpace({ spaceId });
  }

  async function joinSpace(spaceId: string, inviteCode: string): Promise<string> {
    if (!rpc || !isBackendReady) throw new Error('P2P not ready');
    const currentUsername = username ?? '';

    await rpc.joinSpaceViaPairing({ spaceId, invite: inviteCode });

    await db.insert(schema.spaces).values({
      id: spaceId, name: 'Syncing...', originPeerId: 'Unknown',
      membershipStatus: 'member', createdAt: new Date(), updatedAt: new Date(),
    });
    await db.insert(schema.spaceMembers).values({
      spaceId, peerId: currentUsername, role: 'member', joinedAt: new Date(),
    });

    await rpc.finalizeJoin({ spaceId });
    await rpc.appendMemberAnnouncement({ spaceId, peerId: currentUsername, role: 'member' });

    console.log('[P2P] Joined Space:', spaceId);
    return spaceId;
  }

  async function shareTransactionToSpace(transactionId: string, spaceId: string): Promise<void> {
    if (!rpc || !isBackendReady) throw new Error('P2P not ready');
    const currentUsername = username ?? '';

    const transaction = await db.query.transactions.findFirst({
      where: eq(schema.transactions.id, transactionId),
      with: { transactionTags: { with: { tag: true } } },
    });
    if (!transaction) throw new Error(`Transaction not found: ${transactionId}`);

    const tagIds = (transaction.transactionTags ?? []).map(
      (tt: { tag: { id: string } }) => tt.tag.id
    );

    await rpc.appendShareTransaction({
      spaceId, id: transaction.id, accountId: transaction.accountId || '',
      amount: transaction.amount, 
      currency: transaction.currency,
      type: transaction.type,
      categoryId: transaction.categoryId || '',
      description: transaction.description || '',
      date: transaction.date.getTime(), notes: transaction.notes || '',
      originPeerId: currentUsername, tagIds,
    });

    await db.insert(schema.transactionSpaces)
      .values({ transactionId, spaceId })
      .onConflictDoNothing();

    for (const tagId of tagIds) {
      await db.insert(schema.memberTags)
        .values({ tagId, originPeerId: currentUsername })
        .onConflictDoNothing();
    }
  }

  async function unshareTransactionFromSpace(transactionId: string, spaceId: string): Promise<void> {
    if (!rpc || !isBackendReady) throw new Error('P2P not ready');
    const currentUsername = username ?? '';

    await rpc.appendUnshareTransaction({ spaceId, transactionId, originPeerId: currentUsername });

    const otherSpaces = await db.query.transactionSpaces.findMany({
      where: and(
        eq(schema.transactionSpaces.transactionId, transactionId),
        ne(schema.transactionSpaces.spaceId, spaceId)
      ),
    });

    if (otherSpaces.length === 0) {
      const txTags = await db.query.transactionTags.findMany({
        where: eq(schema.transactionTags.transactionId, transactionId),
      });
      for (const tt of txTags) {
        // Check if another transaction from this peer still shares this tag
        const othersUsingTag = await db.query.transactionTags.findMany({
          where: and(
            eq(schema.transactionTags.tagId, tt.tagId),
            ne(schema.transactionTags.transactionId, transactionId)
          ),
          with: { transaction: { with: { transactionSpaces: true } } },
        });
        const tagStillInUse = othersUsingTag.some(
          (o) =>
            o.transaction?.originPeerId === currentUsername &&
            (o.transaction?.transactionSpaces?.length ?? 0) > 0
        );
        if (!tagStillInUse) {
          await db.delete(schema.memberTags)
            .where(and(
              eq(schema.memberTags.tagId, tt.tagId),
              eq(schema.memberTags.originPeerId, currentUsername)
            ));
          await deleteTagIfOrphaned(db, tt.tagId, currentUsername, currentUsername);
        }
      }
    }

    // Remove from transaction_spaces join table locally
    await db.delete(schema.transactionSpaces)
      .where(and(
        eq(schema.transactionSpaces.transactionId, transactionId),
        eq(schema.transactionSpaces.spaceId, spaceId)
      ));
  }

  async function updateTransactionInSpaces(
    transactionId: string,
    updates: {
      amount?: number; type?: string; categoryId?: string;
      description?: string; date?: Date; notes?: string; tagIds?: string[];
    },
    spaceIds: string[]
  ): Promise<void> {
    if (!rpc || !isBackendReady) throw new Error('P2P not ready');
    const currentUsername = username ?? '';

    for (const spaceId of spaceIds) {
      await rpc.appendUpdateTransaction({
        spaceId, transactionId, originPeerId: currentUsername,
        amount: updates.amount, type: updates.type,
        categoryId: updates.categoryId, description: updates.description,
        date: updates.date?.getTime(), notes: updates.notes, tagIds: updates.tagIds,
      });
    }
  }

  async function removeTransactionFromAllSpaces(transactionId: string, spaceIds: string[]): Promise<void> {
    for (const spaceId of spaceIds) {
      try {
        await unshareTransactionFromSpace(transactionId, spaceId);
      } catch (error) {
        console.error(`[P2P] Failed to unshare ${transactionId} from ${spaceId}:`, error);
      }
    }
  }

  async function createSpaceInvite(spaceId: string): Promise<string> {
    if (!rpc || !isBackendReady) throw new Error('P2P not ready');
    const result = await rpc.createSpaceInvite({ spaceId });
    return result.inviteCode;
  }

  // -------------------------------------------------------------------------

  const value: P2PContextType = {
    isReady: isReadyRef.current,
    createSpace, openSpace, closeSpace, joinSpace,
    shareTransactionToSpace, unshareTransactionFromSpace,
    updateTransactionInSpaces, removeTransactionFromAllSpaces,
    createSpaceInvite,
  };

  return <P2PContext.Provider value={value}>{children}</P2PContext.Provider>;
}
