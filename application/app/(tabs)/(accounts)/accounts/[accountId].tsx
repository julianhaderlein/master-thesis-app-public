import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { useDatabase } from '@/db/db-provider';
import * as schema from '@/db/schema';
import { formatCategoryLabel, getContrastColor } from '@/services/category-utils';
import { Ionicons } from '@expo/vector-icons';
import { useLiveRelationalQuery } from '@/drizzleLiveQueryExtension/liveRelationQueryHook';
import { Colors } from '@/constants/theme';

export default function AccountDetailScreen() {
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const router = useRouter();
  const { db } = useDatabase();

  const { data: accounts } = useLiveRelationalQuery(
    db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId))
  );
  const account = accounts?.[0];

  // Fetch transactions with their spaces and category in a single query
  const { data: transactionsWithSpaces } = useLiveRelationalQuery(
    db.query.transactions.findMany({
      where: eq(schema.transactions.accountId, accountId),
      with: {
        category: true,
        transactionSpaces: {
          with: {
            space: true,
          }
        }
      },
    })
  , [schema.spaces, schema.categories]);

  const transactions = transactionsWithSpaces || [];


  if (!account) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.errorState}>
            <Text style={styles.errorText}>Account not found</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const renderTransactionItem = ({ item }: { item: typeof transactions[number] }) => {
    const itemSpaces = item.transactionSpaces?.map(ts => ts.space) || [];
    const visibleSpaces = itemSpaces.slice(0, 2);
    const remainingCount = itemSpaces.length - visibleSpaces.length;
    const catColor = item.category?.color ?? Colors.textLight;
    const catFg = getContrastColor(catColor);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.transactionCard,
          pressed && styles.transactionCardPressed,
        ]}
        onPress={() => {
          router.push({
            pathname: '/transactions/[transactionId]',
            params: { transactionId: item.id },
          });
        }}
      >
        <View style={styles.txRow}>
          <View style={[styles.txIconCircle, { backgroundColor: catColor }]}>
            <Ionicons
              name={(item.category?.icon as any) ?? 'ellipsis-horizontal-outline'}
              size={18}
              color={catFg}
            />
          </View>
          <View style={styles.txMiddle}>
            <Text style={styles.txDescription} numberOfLines={1}>
              {item.description || '—'}
            </Text>
            <Text style={styles.txDate}>{item.date.toLocaleDateString()}</Text>
          </View>
          <Text style={[styles.txAmount, item.type === 'income' ? styles.incomeAmount : styles.expenseAmount]}>
            {item.type === 'income' ? '+' : '−'}{account.currency} {item.amount.toFixed(2)}
          </Text>
        </View>

        {(item.category || itemSpaces.length > 0) && (
          <View style={styles.txFooter}>
            {item.category && (
              <View style={[styles.categoryBadge, { backgroundColor: catColor }]}>
                <Text style={[styles.categoryBadgeText, { color: catFg }]}>
                  {formatCategoryLabel(item.category.id)}
                </Text>
              </View>
            )}
            {visibleSpaces.map(space => (
              <View key={space.id} style={styles.spaceBadge}>
                <Text style={styles.spaceBadgeText}>{space.name}</Text>
              </View>
            ))}
            {remainingCount > 0 && (
              <View style={styles.spaceBadge}>
                <Text style={styles.spaceBadgeText}>+{remainingCount} more</Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerTitle: account.name }}/>
        <View style={styles.content}>
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{account.name}</Text>
            <Text style={styles.accountType}>{account.type}</Text>
            <Text style={styles.accountBalance}>
              {account.currency} {account.balance.toFixed(2)}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Transactions</Text>

          <FlatList
            data={transactions || []}
            keyExtractor={(item) => item.id}
            renderItem={renderTransactionItem}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No transactions yet</Text>
              </View>
            }
            contentContainerStyle={[transactions?.length === 0 ? styles.emptyContainer : undefined, styles.listContent]}
          />

          <Pressable
            style={styles.fab}
            onPress={() => router.push({ pathname: '/accounts/add-transaction', params: { accountId: accountId } })}
          >
            <Text style={styles.fabText}>+</Text>
          </Pressable>
        </View>
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
  accountInfo: {
    backgroundColor: Colors.backgroundMuted,
    padding: 20,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  accountName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  accountType: {
    fontSize: 16,
    color: Colors.textMuted,
    textTransform: 'capitalize',
    marginBottom: 12,
  },
  accountBalance: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  transactionCard: {
    backgroundColor: Colors.backgroundSubtle,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dividerLight,
  },
  transactionCardPressed: {
    backgroundColor: Colors.dividerLight,
    opacity: 0.8,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  txIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  txMiddle: {
    flex: 1,
    gap: 2,
  },
  txDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textDark,
  },
  txDate: {
    fontSize: 12,
    color: Colors.textPlaceholder,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 0,
  },
  incomeAmount: {
    color: Colors.income,
  },
  expenseAmount: {
    color: Colors.expense,
  },
  txFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingLeft: 52,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  spaceBadge: {
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  spaceBadgeText: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 88,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textPlaceholder,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: Colors.textPlaceholder,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 32,
    color: Colors.white,
    fontWeight: '300',
  },
});
