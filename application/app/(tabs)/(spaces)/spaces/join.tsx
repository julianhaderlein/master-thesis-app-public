import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Colors } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useP2P } from '@/services/p2p-provider';
import * as Crypto from 'expo-crypto';

export default function JoinSpaceScreen() {
  const router = useRouter();
  const { joinSpace } = useP2P();
  const params = useLocalSearchParams<{ scannedInvite?: string; invite?: string }>();

  // scannedInvite comes from the QR scanner, invite comes from Expo Router deep link routing
  const initialInvite = params.scannedInvite ?? params.invite ?? '';

  const [inviteCode, setInviteCode] = useState(initialInvite);
  const [codeError, setCodeError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Auto-fill when returning from scanner or arriving via deep link
  useEffect(() => {
    const code = params.scannedInvite ?? params.invite;
    if (code) {
      setInviteCode(code);
      setCodeError('');
    }
  }, [params.scannedInvite, params.invite]);

  const handleJoin = async () => {
    // Reset errors
    setCodeError('');

    // Validate invite code
    if (!inviteCode.trim()) {
      setCodeError('Invite code is required');
      return;
    }

    try {
      setIsLoading(true);

      const spaceId = Crypto.randomUUID();
      await joinSpace(spaceId, inviteCode.trim());

      // Dismiss the entire join+scan back stack so pressing back from the
      // space screen lands on the spaces list, not on the scanner or join form.
      router.dismissAll();
      router.navigate({ pathname: '/spaces/[spaceId]', params: { spaceId } });
    } catch (error: any) {
      console.error('Error joining space:', error);
      Alert.alert('Error', error.message || 'Failed to join space. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Join Space',
          headerRight: () => (
            <Pressable
              onPress={handleJoin}
              disabled={isLoading}
              style={{ padding: 8, marginRight: 8 }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={{ color: Colors.primary, fontSize: 17, fontWeight: '600' }}>Join</Text>
              )}
            </Pressable>
          ),
        }}
      />
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Invitation Code *</Text>
          <TextInput
            style={[styles.input, codeError ? styles.inputError : null]}
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="Enter invitation code"
            placeholderTextColor="#999"
            autoFocus={!params.scannedInvite && !params.invite}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
          {codeError ? <Text style={styles.errorMessage}>{codeError}</Text> : null}
        </View>

        <Pressable
          style={({ pressed }) => [styles.scanButton, pressed && styles.buttonPressed]}
          onPress={() => router.push('/spaces/scan')}
          disabled={isLoading}
        >
          <Text style={styles.scanButtonText}>📷  Scan QR Code</Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.helperText}>
            Enter the invitation code shared by a Space owner, or scan their QR code to join their Space and collaborate via P2P.
          </Text>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Pairing with Space via blind-pairing...</Text>
            <Text style={[styles.helperText, { textAlign: 'center', marginTop: 8 }]}>
              This may take a few seconds
            </Text>
          </View>
        )}
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: Colors.expense,
  },
  errorMessage: {
    color: Colors.expense,
    fontSize: 14,
    marginTop: 4,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    padding: 14,
    marginBottom: 24,
  },
  scanButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  helperText: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textMuted,
    marginTop: 16,
  },
});
