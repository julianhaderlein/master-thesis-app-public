import React, { useState } from 'react';
import { Colors } from '@/constants/theme';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { eq } from 'drizzle-orm';
import { useDatabase } from '@/db/db-provider';
import * as schema from '@/db/schema';
import { useLiveRelationalQuery } from '@/drizzleLiveQueryExtension/liveRelationQueryHook';
import { toTagSlug, colorForSlug, TAG_PALETTE } from '@/services/tag-utils';
import { useUsername } from '@/services/username-provider';
import { useP2P } from '@/services/p2p-provider';
import { Ionicons } from '@expo/vector-icons';

type TagWithMemberTags = schema.Tag & {
  memberTags: schema.MemberTag[];
};

export default function TagsScreen() {
  const { db } = useDatabase();
  const { username } = useUsername();
  const { updateTransactionInSpaces } = useP2P();

  const { data: tags } = useLiveRelationalQuery(
    db.query.tags.findMany({
      with: { memberTags: true },
    }),
    [schema.tags, schema.memberTags]
  );

  // --- New tag form ---
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreateTag = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const slug = toTagSlug(trimmed);
    if (!slug) { Alert.alert('Invalid name', 'Tag name produced an empty slug.'); return; }
    try {
      await db
        .insert(schema.tags)
        .values({ id: slug, name: trimmed, color: colorForSlug(slug) })
        .onConflictDoNothing();
      await db.insert(schema.memberTags).values({ tagId: slug, originPeerId: username ?? '' });
      setNewName('');
      setShowNewForm(false);
    } catch (e) {
      console.error('[Tags] create error', e);
      Alert.alert('Error', 'Failed to create tag.');
    }
  };

  // --- Edit state keyed by tag id ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const startEdit = (tag: TagWithMemberTags) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color ?? colorForSlug(tag.id));
  };

  const cancelEdit = () => { setEditingId(null); setEditName(''); setEditColor(''); };

  const handleSaveEdit = async (tag: TagWithMemberTags) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      await db
        .update(schema.tags)
        .set({ name: trimmed, color: editColor, updatedAt: new Date() })
        .where(eq(schema.tags.id, tag.id));
      cancelEdit();
    } catch (e) {
      console.error('[Tags] edit error', e);
      Alert.alert('Error', 'Failed to update tag.');
    }
  };

  const handleDelete = (tag: TagWithMemberTags) => {
    Alert.alert(
      'Delete Tag',
      `Delete "${tag.name}"? It will be removed from all transactions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Find all transactions referencing this tag, with their spaces and full tag lists
              const txTagRows = await db.query.transactionTags.findMany({
                where: eq(schema.transactionTags.tagId, tag.id),
                with: {
                  transaction: {
                    with: {
                      transactionSpaces: true,
                      transactionTags: true,
                    },
                  },
                },
              });

              // Propagate removal to peers for each shared transaction
              for (const row of txTagRows) {
                if (!row.transaction) continue;
                const spaceIds = row.transaction.transactionSpaces.map(ts => ts.spaceId);
                if (spaceIds.length > 0) {
                  const updatedTagIds = row.transaction.transactionTags
                    .map(tt => tt.tagId)
                    .filter(id => id !== tag.id);

                    console.log('[Tags] Removing tag from transaction in Spaces:', row.transactionId, spaceIds, updatedTagIds);

                  await updateTransactionInSpaces(
                    row.transactionId,
                    { tagIds: updatedTagIds },
                    spaceIds
                  );
                }
              }

              // Delete transaction_tags, memberTags, then the tag itself
              // (cascade on memberTags FK would handle memberTags, but be explicit)
              await db.delete(schema.transactionTags).where(eq(schema.transactionTags.tagId, tag.id));
              await db.delete(schema.memberTags).where(eq(schema.memberTags.tagId, tag.id));
              await db.delete(schema.tags).where(eq(schema.tags.id, tag.id));
            } catch (e) {
              console.error('[Tags] delete error', e);
              Alert.alert('Error', 'Failed to delete tag.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: TagWithMemberTags }) => {
    // Allow delete if no foreign peer has a memberTags row for this tag
    // (i.e. only the local user references it, or nobody does)

    console.log('[Tags] Rendering tag', item.id, 'memberTags:', item.memberTags, 'canDelete:', item.memberTags.every(mt => mt.originPeerId === username));

    const canDelete = item.memberTags.every(mt => mt.originPeerId === username);
    const isEditing = editingId === item.id;

    if (isEditing) {
      return (
        <View style={styles.row}>
          <View style={[styles.colorDot, { backgroundColor: editColor }]} />
          <TextInput
            style={styles.inlineInput}
            value={editName}
            onChangeText={setEditName}
            autoFocus
            placeholder="Tag name"
            placeholderTextColor="#999"
          />
          {/* Color swatches */}
          <View style={styles.swatchRow}>
            {TAG_PALETTE.map(hex => (
              <Pressable
                key={hex}
                style={[styles.swatch, { backgroundColor: hex }, editColor === hex && styles.swatchSelected]}
                onPress={() => setEditColor(hex)}
              />
            ))}
          </View>
          <View style={styles.rowActions}>
            <Pressable onPress={() => handleSaveEdit(item)} style={styles.actionBtn}>
              <Ionicons name="checkmark" size={20} color="#28a745" />
            </Pressable>
            <Pressable onPress={cancelEdit} style={styles.actionBtn}>
              <Ionicons name="close" size={20} color="#999" />
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.row}>
        <View style={[styles.colorDot, { backgroundColor: item.color ?? colorForSlug(item.id) }]} />
        <Text style={styles.tagName}>{item.name}</Text>
        <View style={styles.rowActions}>
          <Pressable onPress={() => startEdit(item)} style={styles.actionBtn}>
            <Ionicons name="pencil-outline" size={18} color="#007AFF" />
          </Pressable>
          {canDelete && (
            <Pressable onPress={() => handleDelete(item)} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Tags' }} />

      {/* New tag form */}
      {showNewForm ? (
        <View style={styles.newForm}>
          <TextInput
            style={styles.newInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Tag name"
            placeholderTextColor="#999"
            autoFocus
          />
          <Pressable style={styles.saveBtn} onPress={handleCreateTag}>
            <Text style={styles.saveBtnText}>Add</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={() => { setShowNewForm(false); setNewName(''); }}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.addButton} onPress={() => setShowNewForm(true)}>
          <Ionicons name="add" size={20} color="#007AFF" />
          <Text style={styles.addButtonText}>New tag</Text>
        </Pressable>
      )}

      <FlatList
        data={(tags ?? []) as TagWithMemberTags[]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No tags yet</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundMuted,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    margin: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: Colors.white,
    borderRadius: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  addButtonText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
  },
  newForm: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 8,
    gap: 8,
  },
  newInput: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: Colors.textPlaceholder,
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    flexShrink: 0,
  },
  tagName: {
    flex: 1,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },
  inlineInput: {
    flex: 1,
    backgroundColor: Colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 6,
    padding: 6,
    fontSize: 15,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: '100%',
    paddingTop: 6,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: Colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textPlaceholder,
    marginTop: 40,
    fontSize: 15,
  },
});
