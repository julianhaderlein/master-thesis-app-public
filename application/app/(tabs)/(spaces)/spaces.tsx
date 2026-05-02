import { Text, View, FlatList, Pressable, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDatabase } from '@/db/db-provider';
import * as schema from '@/db/schema';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useLiveRelationalQuery } from '@/drizzleLiveQueryExtension/liveRelationQueryHook';
import { useUsername } from '@/services/username-provider';
import type { Space } from '@/db/schema/space';
import type { SpaceMember } from '@/db/schema/spaceMember';

export default function SpacesScreen() {
  const { db } = useDatabase();
  const router = useRouter();
  const { username } = useUsername();

  // Query all spaces with their members, then filter to only spaces the current user belongs to
  const { data: allSpaces } = useLiveRelationalQuery(
    db.query.spaces.findMany({
      with: {
        spaceMembers: true,
      },
    }),
    [schema.spaces, schema.spaceMembers]
  );

  type SpaceWithMembers = Space & { spaceMembers: SpaceMember[] };

  const spaces = (allSpaces as SpaceWithMembers[] | undefined)?.filter(
    (space) => space.spaceMembers.some((m) => m.peerId === (username || ''))
  );

  const renderSpaceItem = ({ item }: { item: SpaceWithMembers }) => {
    const memberCount = item.spaceMembers.length;
    
    return (
      <Pressable
        style={[
          styles.spaceCard,
          item.color ? { backgroundColor: item.color + '20' } : undefined,
        ]}
        onPress={() => router.push({ pathname: '/spaces/[spaceId]', params: { spaceId: item.id } })}
      >
        <View style={styles.spaceHeader}>
          <Text style={styles.spaceName}>{item.name}</Text>
          <Text style={styles.memberCount}>{memberCount} members</Text>
        </View>
        {item.description ? (
          <Text style={styles.spaceDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Spaces',
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/spaces/join')}
              style={{ padding: 8, marginRight: 8 }}
            >
              <MaterialIcons name="group-add" size={24} color="#007AFF" />
            </Pressable>
          ),
        }}
      />
      <View style={styles.content}>
        <FlatList
          data={spaces || []}
          keyExtractor={(item) => item.id}
          renderItem={renderSpaceItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No spaces yet</Text>
            </View>
          }
          contentContainerStyle={spaces?.length === 0 ? styles.emptyContainer : undefined}
        />

        <Pressable
          style={styles.fab}
          onPress={() => router.push('/spaces/create')}
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
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  spaceCard: {
    backgroundColor: Colors.backgroundMuted,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  spaceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  spaceName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  memberCount: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  spaceDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
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
