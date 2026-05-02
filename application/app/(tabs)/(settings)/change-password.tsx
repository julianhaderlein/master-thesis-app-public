import React, { useState } from 'react';
import { Colors } from '@/constants/theme';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/services/auth-provider';
import { useDatabase } from '@/db/db-provider';

export default function ChangePasswordScreen() {
  const { changePassword } = useAuth();
  const { rotateDBKey } = useDatabase();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');

    if (!oldPassword) { setError('Enter your current password.'); return; }
    if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    if (newPassword === oldPassword) { setError('New password must differ from current password.'); return; }

    setLoading(true);
    try {
      const newHashedPassword = await changePassword(oldPassword, newPassword);
      // Rotate the DB encryption key; must happen after auth state is updated
      await rotateDBKey(newHashedPassword);

      Alert.alert(
        'Password Changed',
        'Your password has been updated. Biometric login has been disabled and must be re-enabled in Settings.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'Current password is incorrect.') {
        setError(message);
      } else {
        console.error('[ChangePassword] Failed:', err);
        setError('Failed to change password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Change Password</Text>
          <Text style={styles.subtitle}>
            Choose a strong password. All encrypted data will be re-encrypted with the new key.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry
              placeholder="Enter current password"
              autoCapitalize="none"
              editable={!loading}
              returnKeyType="next"
            />

            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="At least 8 characters"
              autoCapitalize="none"
              editable={!loading}
              returnKeyType="next"
            />

            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Repeat new password"
              autoCapitalize="none"
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Re-encrypting — this may take a few seconds…</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                <Text style={styles.buttonText}>Change Password</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMuted },
  flex: { flex: 1 },
  content: { padding: 16 },
  backButton: { marginBottom: 8 },
  backText: { fontSize: 16, color: Colors.primary },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 24, lineHeight: 20 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textTertiary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
    backgroundColor: Colors.backgroundFaint,
    color: Colors.text,
  },
  error: { color: Colors.dangerDark, fontSize: 13, marginBottom: 12 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: Colors.white, fontWeight: '600', fontSize: 16 },
  loadingContainer: { alignItems: 'center', marginTop: 8 },
  loadingText: { color: Colors.textFaint, fontSize: 13, marginTop: 8, textAlign: 'center' },
});
