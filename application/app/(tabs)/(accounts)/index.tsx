import { Text, View, FlatList, Pressable, StyleSheet } from 'react-native'
import { Colors } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context'
import { useDatabase } from '@/db/db-provider'
import { useLiveRelationalQuery } from '@/drizzleLiveQueryExtension/liveRelationQueryHook'
import * as schema from '@/db/schema'
import { useRouter, Stack, Link } from 'expo-router'
import type { Account } from '@/db/schema/account'
import { Ionicons } from '@expo/vector-icons'

export default function AccountsScreen() {
  const router = useRouter();
  const { db } = useDatabase();

  const { data: accounts } = useLiveRelationalQuery(db.select().from(schema.accounts));

  const renderAccountItem = ({ item }: { item: Account }) => (
    <Pressable
      style={styles.accountCard}
      onPress={() => router.push({
        pathname: '/accounts/[accountId]',
        params: { accountId: item.id }
      })}
    >
    <View style={styles.accountHeader}>
        <Text style={styles.accountName}>{item.name}</Text>
        <Text style={styles.accountType}>{item.type}</Text>
      </View>
      <View style={styles.accountBalance}>
        <Text style={styles.balanceAmount}>
          {item.currency} {item.balance.toFixed(2)}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ 
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}>
            <Pressable onPress={() => router.push('/tags' as any)} style={{ padding: 8 }}>
              <Ionicons name="pricetags-outline" size={22} color="#007AFF" />
            </Pressable>
            <Pressable onPress={() => router.push('/accounts/create')} style={{ padding: 8 }}>
              <Text style={{ color: Colors.primary, fontSize: 28, fontWeight: '300' }}>+</Text>
            </Pressable>
          </View>
        )
      }}/>
      <View style={styles.content}>
        <FlatList
          data={accounts || []}
          keyExtractor={(item) => item.id}
          renderItem={renderAccountItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No accounts yet</Text>
              <Pressable 
                style={styles.createButton}
                onPress={() => router.push('/accounts/create')}
              >
                <Text style={styles.createButtonText}>Create Account</Text>
              </Pressable>
            </View>
          }
          contentContainerStyle={accounts?.length === 0 ? styles.emptyContainer : undefined}
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
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  accountCard: {
    backgroundColor: Colors.backgroundMuted,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '600',
  },
  accountType: {
    fontSize: 14,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  accountBalance: {
    marginTop: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textSecondary,
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
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  createButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
