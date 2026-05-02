import { Text, View, Pressable, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDatabase } from '@/db/db-provider';
import * as schema from '@/db/schema';
import { formatCategoryLabel, getContrastColor } from '@/services/category-utils';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useLiveRelationalQuery } from '@/drizzleLiveQueryExtension/liveRelationQueryHook';
import { Colors } from '@/constants/theme';

export default function SpaceDetailScreen() {
  const { db } = useDatabase();
  const router = useRouter();
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();

  const handleSettingsPress = () => {
    router.push({ pathname: '/spaces/settings', params: { spaceId: spaceId } });
  };

  const { data: spaces } = useLiveRelationalQuery(
    db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId))
  );
  
  const space = spaces?.[0];

  // Fetch transactions shared to this space
  const { data: transactionSpaceJoins } = useLiveRelationalQuery(
    db.query.transactionSpaces.findMany({
      where: eq(schema.transactionSpaces.spaceId, spaceId),
      with: {
        transaction: {
          with: {
            account: true,
            category: true,
          }
        }
      }
    }),
    [schema.transactions, schema.accounts, schema.categories]
  );

  const transactions = transactionSpaceJoins?.map(ts => ts.transaction) || [];

  if (!space) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.errorText}>Space not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderTransactionItem = ({ item }: { item: typeof transactions[number] }) => {
    const catColor = item.category?.color ?? Colors.textLight;
    const catFg = getContrastColor(catColor);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.transactionCard,
          pressed && styles.transactionCardPressed,
        ]}
        onPress={() => {
          router.push({ pathname: '/transactions/[transactionId]', params: { transactionId: item.id } });
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
            <Text style={styles.txDate}>
              {item.date.toLocaleDateString()} · {item.originPeerId}
            </Text>
          </View>
          <Text style={[styles.txAmount, item.type === 'income' ? styles.incomeAmount : styles.expenseAmount]}>
            {item.type === 'income' ? '+' : '−'}{item.account?.currency ?? item.currency} {Math.abs(item.signedAmount).toFixed(2)}
          </Text>
        </View>

        {item.category && (
          <View style={styles.txFooter}>
            <View style={[styles.categoryBadge, { backgroundColor: catColor }]}>
              <Text style={[styles.categoryBadgeText, { color: catFg }]}>
                {formatCategoryLabel(item.category.id)}
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerTitle: space.name,
          headerRight: () => (
            <Pressable onPress={handleSettingsPress} style={styles.settingsButton}>
              <MaterialIcons name="settings" size={24} color="#007AFF" />
            </Pressable>
          ),
        }}
      />
      <View style={styles.content}>
        <View style={styles.spaceInfo}>
          <Text style={styles.spaceName}>{space.name}</Text>
        </View>

        <Text style={styles.sectionTitle}>Shared Transactions</Text>

        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransactionItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No transactions shared yet</Text>
            </View>
          }
          contentContainerStyle={transactions.length === 0 ? styles.emptyContainer : undefined}
        />
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
  spaceInfo: {
    padding: 16,
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 8,
    marginBottom: 16,
  },
  spaceName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  spaceDescription: {
    fontSize: 16,
    color: Colors.textMuted,
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
  errorText: {
    fontSize: 16,
    color: Colors.textPlaceholder,
    textAlign: 'center',
  },
  settingsButton: {
    padding: 8,
    marginRight: 8,
  },
});
