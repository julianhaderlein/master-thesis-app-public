import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { eq, and, inArray, ne } from 'drizzle-orm';
import { useDatabase } from '@/db/db-provider';
import * as schema from '@/db/schema';
import { formatCategoryLabel } from '@/services/category-utils';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLiveRelationalQuery } from '@/drizzleLiveQueryExtension/liveRelationQueryHook';
import { useUsername } from '@/services/username-provider';
import { useP2P } from '@/services/p2p-provider';
import { CategoryPickerModal } from '@/components/CategoryPickerModal';
import { TagPickerModal } from '@/components/TagPickerModal';
import { toTagSlug, colorForSlug, deleteTagIfOrphaned } from '@/services/tag-utils';
import { Colors } from '@/constants/theme';

export default function TransactionDetailScreen() {
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  const router = useRouter();
  const { db } = useDatabase();

  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [amountError, setAmountError] = useState('');
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
  const { username } = useUsername();
  const { shareTransactionToSpace, unshareTransactionFromSpace, updateTransactionInSpaces, removeTransactionFromAllSpaces } = useP2P();

  const { data: allCategories } = useLiveRelationalQuery(
    db.query.categories.findMany(),
    [schema.categories]
  );

  const { data: allTags } = useLiveRelationalQuery(
    db.query.tags.findMany(),
    [schema.tags]
  );

  // Fetch transaction with all related data using relational query API v2
  const { data: transactionData } = useLiveRelationalQuery(
    db.query.transactions.findFirst({
      where: eq(schema.transactions.id, transactionId),
      with: {
        account: true,
        category: true,
        transactionTags: {
          with: {
            tag: true,
          },
        },
        transactionSpaces: {
          with: {
            space: true,
          },
        },
      },
    }));

  const transaction = transactionData;
  const account = transactionData?.account || null; // May be null for foreign transactions
  const category = transactionData?.category;
  const tags = transactionData?.transactionTags?.map(tt => tt.tag) || [];
  const transactionSpaces = transactionData?.transactionSpaces?.map(ts => ts.space) || [];
  
  // Determine if current user owns this transaction
  const isOwner = transaction?.originPeerId === username;

  // Fetch user's spaces for share modal using relational query API v2
  const { data: userSpaceMembers } = useLiveRelationalQuery(
    db.query.spaceMembers.findMany({
      where: eq(schema.spaceMembers.peerId, username || ''),
      with: {
        space: true
        },
    })
  );
  const userSpaces = userSpaceMembers?.map(sm => sm.space) || [];

  // Initialize form fields when transaction loads
  useEffect(() => {
    if (transaction) {
      setAmount(transaction.amount.toString());
      setType(transaction.type as 'income' | 'expense');
      setDescription(transaction.description || '');
      setNotes(transaction.notes || '');
      setSelectedCategoryId(transaction.categoryId ?? null);
      setEditTagIds(tags.map(t => t.id));
    }
  }, [transaction]);

  const handleSave = async () => {
    // Reset errors
    setAmountError('');

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError('Enter a valid positive amount');
      return;
    }

    try {
      await db
        .update(schema.transactions)
        .set({
          amount: parsedAmount,
          type,
          categoryId: selectedCategoryId,
          description: description.trim() || null,
          notes: notes.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.transactions.id, transactionId));

      // Diff tags: delete removed, insert added
      const oldTagIds = tags.map(t => t.id);
      const added = editTagIds.filter(id => !oldTagIds.includes(id));
      const removed = oldTagIds.filter(id => !editTagIds.includes(id));
      if (removed.length > 0) {
        await db.delete(schema.transactionTags).where(
          and(
            eq(schema.transactionTags.transactionId, transactionId),
            inArray(schema.transactionTags.tagId, removed)
          )
        );
      }
      if (added.length > 0) {
        await db.insert(schema.transactionTags).values(
          added.map(tagId => ({ transactionId, tagId }))
        ).onConflictDoNothing();
      }

      if (transactionSpaces.length > 0) {
        const oldTagIds = tags.map(t => t.id);
        const tagsDiffer =
          editTagIds.length !== oldTagIds.length ||
          [...editTagIds].sort().join(',') !== [...oldTagIds].sort().join(',');

        const partialUpdates: {
          amount?: number; type?: string; categoryId?: string;
          description?: string; notes?: string; tagIds?: string[];
        } = {};
        if (parsedAmount !== transaction!.amount) partialUpdates.amount = parsedAmount;
        if (type !== transaction!.type) partialUpdates.type = type;
        if (selectedCategoryId !== (transaction!.categoryId ?? null))
          partialUpdates.categoryId = selectedCategoryId ?? undefined;
        if (description.trim() !== (transaction!.description ?? ''))
          partialUpdates.description = description.trim() || undefined;
        if (notes.trim() !== (transaction!.notes ?? ''))
          partialUpdates.notes = notes.trim() || undefined;
        if (tagsDiffer) partialUpdates.tagIds = editTagIds;

        if (Object.keys(partialUpdates).length > 0) {
          await updateTransactionInSpaces(
            transactionId,
            partialUpdates,
            transactionSpaces.map(s => s.id)
          );
        }
      }

      setIsEditing(false);
      Alert.alert('Success', 'Transaction updated successfully');
    } catch (error) {
      console.error('Error updating transaction:', error);
      Alert.alert('Error', 'Failed to update transaction. Please try again.');
    }
  };

  const handleCancel = () => {
    // Reset form to current transaction values
    if (transaction) {
      setAmount(transaction.amount.toString());
      setType(transaction.type as 'income' | 'expense');
      setDescription(transaction.description || '');
      setNotes(transaction.notes || '');
      setSelectedCategoryId(transaction.categoryId ?? null);
      setEditTagIds(tags.map(t => t.id));
    }
    setAmountError('');
    setIsEditing(false);
  };

  const handleCreateTag = async (name: string): Promise<string> => {
    const slug = toTagSlug(name);
    await db
      .insert(schema.tags)
      .values({ id: slug, name: name.trim(), color: colorForSlug(slug) })
      .onConflictDoNothing();
    await db
            .insert(schema.memberTags)
            .values({ tagId: slug, originPeerId: username ?? '' })
            .onConflictDoNothing();
    return slug;
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeTransactionFromAllSpaces(transactionId, transactionSpaces.map(s => s.id));
              await db.delete(schema.transactions).where(eq(schema.transactions.id, transactionId));
              router.back();
            } catch (error) {
              console.error('Error deleting transaction:', error);
              Alert.alert('Error', 'Failed to delete transaction. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleOpenShareModal = () => {
    setSelectedSpaces(new Set(transactionSpaces.map(s => s.id)));
    setShowSpaceModal(true);
  };

  const handleToggleSpace = (spaceId: string) => {
    setSelectedSpaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(spaceId)) {
        newSet.delete(spaceId);
      } else {
        newSet.add(spaceId);
      }
      return newSet;
    });
  };

  const handleSaveSpaces = async () => {
    try {
      const currentSpaceIds = new Set(transactionSpaces.map(s => s.id));
      const newSpaceIds = selectedSpaces;

      // Find spaces to add and remove
      const spacesToAdd = Array.from(newSpaceIds).filter(id => !currentSpaceIds.has(id));
      const spacesToRemove = Array.from(currentSpaceIds).filter(id => !newSpaceIds.has(id));

      // Share to new spaces via P2P
      for (const spaceId of spacesToAdd) {
        try {
          await shareTransactionToSpace(transactionId, spaceId);
        } catch (error) {
          console.error(`Failed to share transaction to space ${spaceId}:`, error);
        }
      }

      // Unshare from removed spaces via P2P
      for (const spaceId of spacesToRemove) {
        try {
          await unshareTransactionFromSpace(transactionId, spaceId);
        } catch (error) {
          console.error(`Failed to unshare transaction from space ${spaceId}:`, error);
        }
      }

      setShowSpaceModal(false);
      Alert.alert('Success', 'Spaces updated successfully');
    } catch (error) {
      console.error('Error updating spaces:', error);
      Alert.alert('Error', 'Failed to update spaces. Please try again.');
    }
  };

  if (!transaction) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.errorText}>Transaction not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          headerTitle: 'Transaction Details',
          headerRight: () =>
            isEditing ? null : isOwner ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginRight: 8 }}>
                <Pressable onPress={handleOpenShareModal} style={{ padding: 8 }}>
                  <Ionicons name="share-outline" size={24} color="#007AFF" />
                </Pressable>
                <Pressable onPress={() => setIsEditing(true)} style={{ padding: 8 }}>
                  <Text style={{ color: Colors.primary, fontSize: 17, fontWeight: '600' }}>Edit</Text>
                </Pressable>
              </View>
            ) : null,
        }}
      />
      <ScrollView style={styles.content}>
        {/* Main transaction info card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Amount</Text>
            {isEditing ? (
              <TextInput
                style={[styles.inlineInput, amountError ? styles.inputError : null]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            ) : (
              <Text style={styles.valueText}>
                {account?.currency || 'USD'} {transaction.amount.toFixed(2)}
              </Text>
            )}
          </View>
          {amountError ? <Text style={styles.errorMessage}>{amountError}</Text> : null}

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Type</Text>
            {isEditing ? (
              <View style={styles.typeSelector}>
                <Pressable
                  style={[styles.typeButton, type === 'expense' ? styles.typeButtonActive : null]}
                  onPress={() => setType('expense')}
                >
                  <Text style={[styles.typeButtonText, type === 'expense' ? styles.typeButtonTextActive : null]}>
                    Expense
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.typeButton, type === 'income' ? styles.typeButtonActive : null]}
                  onPress={() => setType('income')}
                >
                  <Text style={[styles.typeButtonText, type === 'income' ? styles.typeButtonTextActive : null]}>
                    Income
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.valueText, styles.typeValue, transaction.type === 'income' ? styles.incomeText : styles.expenseText]}>
                {transaction.type}
              </Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.valueText}>{transaction.date.toLocaleDateString()}</Text>
          </View>

          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Account</Text>
            <Text style={styles.valueText}>{account?.name || 'Unknown Account'}</Text>
          </View>


        </View>

        {/* Description */}
        {(isEditing || transaction.description) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Description</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Brief description of the transaction"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            ) : (
              <Text style={styles.descriptionText}>{transaction.description}</Text>
            )}
          </View>
        )}

        {/* Notes */}
        {(isEditing || transaction.notes) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes (optional)"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            ) : (
              <Text style={styles.descriptionText}>{transaction.notes}</Text>
            )}
          </View>
        )}

        {/* Tags and Spaces */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tags</Text>
          {isEditing ? (
            <Pressable style={styles.categoryPickerRow} onPress={() => setShowTagPicker(true)}>
              {editTagIds.length > 0 ? (
                <View style={styles.tagContainer}>
                  {editTagIds.map(id => {
                    const tag = allTags?.find(t => t.id === id);
                    return (
                      <View key={id} style={[styles.tag, { backgroundColor: tag?.color ?? colorForSlug(id) }]}>
                        <Text style={[styles.tagText, { color: Colors.white }]}>{tag?.name ?? id}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.categoryPickerPlaceholder}>Add tags (optional)</Text>
              )}
              <Ionicons name="chevron-forward" size={16} color="#999" />
            </Pressable>
          ) : tags.length > 0 ? (
            <View style={styles.tagContainer}>
              {tags.map(tag => (
                <View key={tag.id} style={[styles.tag, { backgroundColor: tag.color ?? colorForSlug(tag.id) }]}>
                  <Text style={[styles.tagText, { color: Colors.white }]}>{tag.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No tags</Text>
          )}

          {transactionSpaces.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.cardTitle}>Spaces</Text>
              <View style={styles.tagContainer}>
                {transactionSpaces.map(space => (
                  <View key={space.id} style={styles.tag}>
                    <Text style={styles.tagText}>{space.name}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Category */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Category</Text>
            {isEditing ? (
              <Pressable
                style={styles.categoryPickerRow}
                onPress={() => setShowCategoryPicker(true)}
              >
                {selectedCategoryId ? (
                  <>
                    <View
                      style={[
                        styles.categoryColorDot,
                        { backgroundColor: allCategories?.find(c => c.id === selectedCategoryId)?.color ?? Colors.divider },
                      ]}
                    />
                    <Text style={styles.categoryPickerText}>
                      {formatCategoryLabel(selectedCategoryId)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.categoryPickerPlaceholder}>None</Text>
                )}
                <Ionicons name="chevron-forward" size={16} color="#999" />
              </Pressable>
            ) : (
              <Text style={styles.valueText}>{category ? formatCategoryLabel(category.id) : 'None'}</Text>
            )}
          </View>
        </View>

        {/* Attachments placeholder */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Attachments</Text>
          <Text style={styles.emptyText}>📎 Attachment feature coming soon</Text>
        </View>

        {isEditing ? (
          <View style={styles.editActions}>
            <Pressable style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          </View>
        ) : isOwner ? (
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Transaction</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Category Picker Modal */}
      <CategoryPickerModal
        visible={showCategoryPicker}
        categories={allCategories ?? []}
        selectedId={selectedCategoryId}
        onSelect={(id) => setSelectedCategoryId(id)}
        onClose={() => setShowCategoryPicker(false)}
      />

      {/* Tag Picker Modal */}
      <TagPickerModal
        visible={showTagPicker}
        tags={allTags ?? []}
        selectedIds={editTagIds}
        onSave={(ids) => { setEditTagIds(ids); setShowTagPicker(false); }}
        onClose={() => setShowTagPicker(false)}
        onCreateTag={handleCreateTag}
      />

      {/* Space Selection Modal */}
      <Modal
        visible={showSpaceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSpaceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Share to Spaces</Text>
            
            {userSpaces.length === 0 ? (
              <View style={styles.emptyModalState}>
                <Text style={styles.emptyModalText}>Join or create a Space to share transactions</Text>
                <Pressable 
                  style={styles.spacesLinkButton}
                  onPress={() => {
                    setShowSpaceModal(false);
                    router.push('/spaces');
                  }}
                >
                  <Text style={styles.spacesLinkText}>Go to Spaces</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView style={styles.spaceList}>
                {userSpaces.map((space) => {
                  const isSelected = selectedSpaces.has(space.id);
                  return (
                    <Pressable
                      key={space.id}
                      style={styles.spaceRow}
                      onPress={() => handleToggleSpace(space.id)}
                    >
                      <MaterialIcons
                        name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                        size={24}
                        color={isSelected ? Colors.primary : Colors.textPlaceholder}
                      />
                      <View style={styles.spaceInfo}>
                        <Text style={styles.spaceName}>{space.name}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <Pressable 
                style={styles.modalCancelButton} 
                onPress={() => setShowSpaceModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalSaveButton, userSpaces.length === 0 && styles.modalSaveButtonDisabled]} 
                onPress={handleSaveSpaces}
                disabled={userSpaces.length === 0}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundMuted,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.backgroundLight,
    marginVertical: 4,
  },
  label: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  typeValue: {
    textTransform: 'capitalize',
  },
  incomeText: {
    color: Colors.income,
  },
  expenseText: {
    color: Colors.expense,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  inlineInput: {
    flex: 1,
    marginLeft: 16,
    backgroundColor: Colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    textAlign: 'right',
  },
  input: {
    backgroundColor: Colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  inputError: {
    borderColor: Colors.expense,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorMessage: {
    color: Colors.expense,
    fontSize: 14,
    marginTop: 4,
  },
  categoryPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 16,
    backgroundColor: Colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  categoryColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryPickerText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textSecondary,
  },
  categoryPickerPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPlaceholder,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    marginLeft: 16,
  },
  typeButton: {
    flex: 1,
    backgroundColor: Colors.backgroundMuted,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  typeButtonTextActive: {
    color: Colors.white,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textPlaceholder,
    fontStyle: 'italic',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  deleteButton: {
    backgroundColor: Colors.expense,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  errorText: {
    fontSize: 18,
    color: Colors.textPlaceholder,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  spaceList: {
    maxHeight: 300,
  },
  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  spaceInfo: {
    flex: 1,
  },
  spaceName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  spaceDescriptionSmall: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  emptyModalState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyModalText: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  spacesLinkButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  spacesLinkText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    backgroundColor: Colors.borderMedium,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
