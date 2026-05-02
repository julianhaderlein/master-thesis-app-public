import React, { useState } from 'react';
import { Colors } from '@/constants/theme';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '@/services/auth-provider';

export function PasswordLoginScreen() {
  const { isBackendReady, biometricsEnabled, unlockWithPassword, unlockWithBiometrics } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordSubmit = async () => {
    setError('');
    if (!password) {
      setError('Enter your password.');
      return;
    }
    if (!isBackendReady) {
      setError('App is still initializing. Please wait.');
      return;
    }

    setLoading(true);
    try {
       await unlockWithPassword(password);
    } catch {
      setError('Incorrect password.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    if (!isBackendReady) return;
    setLoading(true);
    try {
        await unlockWithBiometrics();
    } catch {
      // User cancelled biometrics — do nothing
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Unlock App</Text>
        <Text style={styles.subtitle}>Enter your password to decrypt your data.</Text>

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Your app password"
          autoCapitalize="none"
          editable={!loading}
          returnKeyType="done"
          onSubmitEditing={handlePasswordSubmit}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator style={styles.spinner} size="large" color="#007AFF" />
        ) : (
          <>
            <TouchableOpacity style={styles.button} onPress={handlePasswordSubmit}>
              <Text style={styles.buttonText}>Unlock</Text>
            </TouchableOpacity>

            {biometricsEnabled && (
              <TouchableOpacity style={styles.secondaryButton} onPress={handleBiometric}>
                <Text style={styles.secondaryButtonText}>Use Biometrics</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundMuted,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 24,
    shadowColor: Colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginBottom: 6,
  },
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
  error: {
    color: Colors.dangerDark,
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontWeight: '500',
    fontSize: 15,
  },
  spinner: {
    marginTop: 12,
  },
});
