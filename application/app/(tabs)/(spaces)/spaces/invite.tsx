import { Text, View, StyleSheet, Pressable, TextInput, Alert, Share, ActivityIndicator, ScrollView } from 'react-native';
import { Colors } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import * as Clipboard from 'expo-clipboard';
import { useP2P } from '@/services/p2p-provider';
import { useDatabase } from '@/db/db-provider';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import QRCode from 'react-native-qrcode-svg';

export default function InviteScreen() {
  const router = useRouter();
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const { createSpaceInvite} = useP2P();
  const { db } = useDatabase();
  
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [spaceName, setSpaceName] = useState('');

  useEffect(() => {
    // Generate invite code when screen loads
    const generateInviteCode = async () => {
      try {
        setLoading(true);
        setError('');

        // Verify Space exists
        const spaces = await db.select().from(schema.spaces).where(eq(schema.spaces.id, spaceId));
        if (spaces.length === 0) {
          setError('Space not found');
          return;
        }

        setSpaceName(spaces[0].name);

        // Backend extracts autobaseKey from Space using getUserData
        const inviteCode = await createSpaceInvite(spaceId);
        
        setInviteCode(inviteCode);
      } catch (err: any) {
        console.error('[Invite] Failed to generate invite:', err);
        setError(err.message || 'Failed to generate invite code');
      } finally {
        setLoading(false);
      }
    };
    
    if (spaceId) {
      generateInviteCode();
    }
  }, [spaceId]);

  const deepLinkUrl = `p2p.finance.app://spaces/join?invite=${inviteCode}`;

  const handleCopyToClipboard = async () => {
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert('Success', 'Invite code copied to clipboard!');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my Space "${spaceName}"! Open this link to join: p2p.finance.app://spaces/join?invite=${inviteCode}\n\nOr enter the invite code manually: ${inviteCode}`,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share invite code');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Invite Member',
          presentation: 'modal',
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Share Invite Code</Text>
        <Text style={styles.subtitle}>
          Share this code with someone to invite them to your Space
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Generating invite code...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>❌ {error}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryButtonText}>Go Back</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.qrContainer}>
              <Text style={styles.label}>Scan QR Code</Text>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={deepLinkUrl}
                  size={240}
                  color="#1a1a1a"
                  backgroundColor="#ffffff"
                />
              </View>
              <Text style={styles.qrHint}>Scan with any QR reader or the in-app scanner</Text>
            </View>

            <View style={styles.codeContainer}>
              <Text style={styles.label}>Invite Code</Text>
              <TextInput
                style={styles.codeInput}
                value={inviteCode}
                editable={false}
                selectTextOnFocus
                multiline
              />
            </View>

            <View style={styles.buttonContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleCopyToClipboard}
              >
                <Text style={styles.primaryButtonText}>Copy Code</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleShare}
              >
                <Text style={styles.secondaryButtonText}>Share Link</Text>
              </Pressable>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ℹ️ This invite uses blind-pairing for secure P2P connection. The recipient scans the QR code or enters the invite code to join.
              </Text>
            </View>
          </>
        )}
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
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: Colors.textSecondary,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.danger,
    textAlign: 'center',
  },
  qrContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginVertical: 12,
  },
  qrHint: {
    fontSize: 13,
    color: Colors.textFaint,
    textAlign: 'center',
  },
  codeContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.textSecondary,
  },
  codeInput: {
    backgroundColor: Colors.backgroundMuted,
    padding: 16,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'monospace',
    color: Colors.textSecondary,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    padding: 12,
    backgroundColor: Colors.primarySubtle,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
