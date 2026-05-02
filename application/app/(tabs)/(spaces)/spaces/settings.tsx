import { Text, View, StyleSheet, Pressable } from 'react-native';
import { Colors } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useDatabase } from '@/db/db-provider';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { useLiveRelationalQuery } from '@/drizzleLiveQueryExtension/liveRelationQueryHook';
import { useUsername } from '@/services/username-provider';

export default function SpaceSettingsScreen() {
  const { db } = useDatabase();
  const router = useRouter();
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const { username } = useUsername();

  const { data: spaces } = useLiveRelationalQuery(
    db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId))
  );

  const { data: members } = useLiveRelationalQuery(
    db.select().from(schema.spaceMembers).where(eq(schema.spaceMembers.spaceId, spaceId)),
    [schema.spaceMembers]
  );

  const space = spaces?.[0];

  const handleInviteMember = () => {
    router.push({ pathname: '/spaces/invite', params: { spaceId } });
  };

  if (!space) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Settings' }} />
        <View style={styles.content}>
          <Text style={styles.errorText}>Space not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          <View style={styles.card}>
            {members && members.length > 0 ? (
              members.map((member, index) => {
                const isYou = member.peerId === username;
                const joinedDate =
                  member.joinedAt instanceof Date
                    ? member.joinedAt
                    : new Date(member.joinedAt);
                return (
                  <View key={member.peerId}>
                    <View style={styles.memberRow}>
                      <View style={styles.memberLeft}>
                        <Text style={styles.memberName}>
                          {member.peerId}
                          {isYou ? <Text style={styles.youBadge}> (You)</Text> : null}
                        </Text>
                        <Text style={styles.memberDate}>{joinedDate.toLocaleDateString()}</Text>
                      </View>
                      <View style={[styles.roleBadge, member.role === 'owner' ? styles.roleOwner : styles.roleMember]}>
                        <Text style={[styles.roleBadgeText, member.role === 'owner' ? styles.roleOwnerText : styles.roleMemberText]}>
                          {member.role}
                        </Text>
                      </View>
                    </View>
                    {index < members.length - 1 && <View style={styles.divider} />}
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>No members yet</Text>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleInviteMember}
          >
            <Text style={styles.buttonText}>Invite Member</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Space Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{space.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Joined:</Text>
            <Text style={styles.value}>{space.createdAt.toLocaleDateString()}</Text>
          </View>
        </View>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: Colors.textSecondary,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    color: Colors.textMuted,
  },
  value: {
    fontSize: 16,
    color: Colors.textSecondary,
    flex: 1,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textPlaceholder,
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 8,
    backgroundColor: Colors.backgroundFaint,
    marginBottom: 12,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  memberLeft: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  youBadge: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.primary,
  },
  memberDate: {
    fontSize: 12,
    color: Colors.textPlaceholder,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
  },
  roleOwner: {
    backgroundColor: Colors.warningBg,
  },
  roleMember: {
    backgroundColor: Colors.primarySubtle,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  roleOwnerText: {
    color: Colors.warningText,
  },
  roleMemberText: {
    color: Colors.primaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: 12,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textDisabled,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
