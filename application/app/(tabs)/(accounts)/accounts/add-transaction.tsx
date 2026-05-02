import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Colors } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { eq } from 'drizzle-orm';
import { useDatabase } from '@/db/db-provider';
import * as schema from '@/db/schema';
import { formatCategoryLabel } from '@/services/category-utils';
import { useLiveRelationalQuery } from '@/drizzleLiveQueryExtension/liveRelationQueryHook';
import { useUsername } from '@/services/username-provider';
import { Ionicons } from '@expo/vector-icons';
import { CategoryPickerModal } from '@/components/CategoryPickerModal';
import { TagPickerModal } from '@/components/TagPickerModal';
import { toTagSlug, colorForSlug } from '@/services/tag-utils';

export default function AddTransactionScreen() {
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const router = useRouter();
  const { db } = useDatabase();
  const { username } = useUsername();

  const { data: accounts } = useLiveRelationalQuery(
    db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId))
  );
  const account = accounts?.[0];

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [notes, setNotes] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [descriptionError, setDescriptionError] = useState('');
  const [amountError, setAmountError] = useState('');

  const { data: categories } = useLiveRelationalQuery(
    db.query.categories.findMany(),
    [schema.categories]
  );
  const selectedCategory = categories?.find(c => c.id === selectedCategoryId) ?? null;

  const { data: allTags } = useLiveRelationalQuery(
    db.query.tags.findMany(),
    [schema.tags]
  );

  const handleCreateTag = async (name: string): Promise<string> => {
    const slug = toTagSlug(name);
    await db
      .insert(schema.tags)
      .values({ id: slug, name: name.trim(), color: colorForSlug(slug) })
      .onConflictDoNothing();
    return slug;
  };

  const handleSubmit = async () => {
    // Reset errors
    setDescriptionError('');
    setAmountError('');

    // Validate description
    if (!description.trim()) {
      setDescriptionError('Description is required');
      return;
    }

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError('Enter a valid positive amount');
      return;
    }

    if (!username) {
      Alert.alert('Error', 'Username not found. Please complete onboarding.');
      return;
    }

    try {
      // Generate a simple ID (in production, use a UUID library)
      const id = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await db.insert(schema.transactions).values({
        id,
        originPeerId: username,
        accountId: accountId!,
        currency: account?.currency,
        categoryId: selectedCategoryId,
        amount: parsedAmount,
        type,
        description: description.trim(),
        date: new Date(),
        notes: notes.trim() || null,
      });

      // Insert transaction_tags for each selected tag
      if (selectedTagIds.length > 0) {
        await db.insert(schema.transactionTags).values(
          selectedTagIds.map(tagId => ({ transactionId: id, tagId }))
        ).onConflictDoNothing();
      }

      // Navigate back to account detail screen
      router.back();
    } catch (error) {
      console.error('Error creating transaction:', error);
      Alert.alert('Error', 'Failed to create transaction. Please try again.');
    }
  };

  if (!account) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.errorText}>Account not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ 
        headerRight: () => (
        <Pressable onPress={handleSubmit} style={{ padding: 8, marginRight: 8 }}>
          <Text style={{ color: Colors.primary, fontSize: 17, fontWeight: '600' }}>Save</Text>
        </Pressable>
      )}}/>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Account</Text>
          <View style={styles.accountDisplay}>
            <Text style={styles.accountName}>{account.name}</Text>
            <Text style={styles.accountType}>{account.type}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, descriptionError ? styles.inputError : null]}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g., Coffee at Starbucks"
            placeholderTextColor="#999"
          />
          {descriptionError ? <Text style={styles.errorMessage}>{descriptionError}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Amount *</Text>
          <TextInput
            style={[styles.input, amountError ? styles.inputError : null]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
          />
          {amountError ? <Text style={styles.errorMessage}>{amountError}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Type *</Text>
          <View style={styles.typeSelector}>
            <Pressable
              style={[styles.typeButton, type === 'expense' ? styles.typeButtonActive : null]}
              onPress={() => setType('expense')}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'expense' ? styles.typeButtonTextActive : null,
                ]}
              >
                Expense
              </Text>
            </Pressable>
            <Pressable
              style={[styles.typeButton, type === 'income' ? styles.typeButtonActive : null]}
              onPress={() => setType('income')}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'income' ? styles.typeButtonTextActive : null,
                ]}
              >
                Income
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <Pressable style={styles.categoryRow} onPress={() => setShowCategoryPicker(true)}>
            {selectedCategory ? (
              <>
                <View style={[styles.categoryColorDot, { backgroundColor: selectedCategory.color ?? Colors.divider }]} />
                <Ionicons
                  name={(selectedCategory.icon as any) ?? 'ellipsis-horizontal-outline'}
                  size={18}
                  color={selectedCategory.color ?? Colors.textMuted}
                  style={styles.categoryIcon}
                />
                <Text style={styles.categoryRowText}>{formatCategoryLabel(selectedCategory.id)}</Text>
              </>
            ) : (
              <Text style={styles.categoryRowPlaceholder}>Select category (optional)</Text>
            )}
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </Pressable>
          <CategoryPickerModal
            visible={showCategoryPicker}
            categories={categories ?? []}
            selectedId={selectedCategoryId}
            onSelect={(id) => setSelectedCategoryId(id)}
            onClose={() => setShowCategoryPicker(false)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Tags</Text>
          <Pressable style={styles.categoryRow} onPress={() => setShowTagPicker(true)}>
            {selectedTagIds.length > 0 ? (
              <View style={styles.chipRow}>
                {selectedTagIds.map(id => {
                  const tag = allTags?.find(t => t.id === id);
                  return (
                    <View key={id} style={[styles.chip, { backgroundColor: tag?.color ?? colorForSlug(id) }]}>
                      <Text style={styles.chipText}>{tag?.name ?? id}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.categoryRowPlaceholder}>Add tags (optional)</Text>
            )}
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </Pressable>
          <TagPickerModal
            visible={showTagPicker}
            tags={allTags ?? []}
            selectedIds={selectedTagIds}
            onSave={(ids) => { setSelectedTagIds(ids); setShowTagPicker(false); }}
            onClose={() => setShowTagPicker(false)}
            onCreateTag={handleCreateTag}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add additional notes (optional)"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Attachments</Text>
          <Pressable style={styles.attachmentButton}>
            <Text style={styles.attachmentButtonText}>📎 Add Attachment</Text>
          </Pressable>
          <Text style={styles.helperText}>Attachment feature coming soon</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.textSecondary,
  },
  accountDisplay: {
    backgroundColor: Colors.backgroundMuted,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  accountType: {
    fontSize: 14,
    color: Colors.textMuted,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  input: {
    backgroundColor: Colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputError: {
    borderColor: Colors.expense,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorMessage: {
    color: Colors.expense,
    fontSize: 14,
    marginTop: 4,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    backgroundColor: Colors.backgroundMuted,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  typeButtonTextActive: {
    color: Colors.white,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  categoryColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryIcon: {
    width: 22,
    textAlign: 'center',
  },
  categoryRowText: {
    flex: 1,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  categoryRowPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPlaceholder,
  },
  chipRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: Colors.textPlaceholder,
    marginTop: 4,
    fontStyle: 'italic',
  },
  attachmentButton: {
    backgroundColor: Colors.backgroundMuted,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
  },
  attachmentButtonText: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  errorText: {
    fontSize: 18,
    color: Colors.textPlaceholder,
    textAlign: 'center',
  },
});
