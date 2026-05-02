import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useUsername } from '@/services/username-provider';
import { Colors } from '@/constants/theme';

export function UsernameSetupScreen() {
  const [username, setUsernameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateUsername } = useUsername();

  const handleSubmit = async () => {
    const trimmed = username.trim();

    if (trimmed.length === 0) {
      Alert.alert('Invalid Username', 'Please enter a username');
      return;
    }
    if (trimmed.length < 2) {
      Alert.alert('Invalid Username', 'Username must be at least 2 characters');
      return;
    }
    if (trimmed.length > 50) {
      Alert.alert('Invalid Username', 'Username must be less than 50 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUsername(trimmed);
      // UsernameProvider updates hasUsername → AppAuth re-renders automatically
    } catch (error) {
      console.error('Failed to save username:', error);
      Alert.alert('Error', 'Failed to save username. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>
          Choose a username to identify yourself when sharing financial data with others.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsernameInput}
            placeholder="Enter your username"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={50}
            editable={!isSubmitting}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <Text style={styles.hint}>
            Your username will be visible to people you share Spaces with.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Saving...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
    color: Colors.black,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    marginBottom: 40,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.black,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.black,
    backgroundColor: Colors.white,
  },
  hint: {
    fontSize: 13,
    color: Colors.textPlaceholder,
    marginTop: 8,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
