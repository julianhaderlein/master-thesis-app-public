import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { useP2P } from '@/services/p2p-provider';

export default function CreateSpaceScreen() {
  const router = useRouter();
  const { createSpace } = useP2P();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    // Reset errors
    setNameError('');

    // Validate name
    if (!name.trim()) {
      setNameError('Space name is required');
      return;
    }

    try {
      setIsLoading(true);
      const spaceId = await createSpace(
        name.trim(),
        description.trim() || undefined
      );

      // Navigate to the newly created space detail screen
      router.replace({ pathname: '/spaces/[spaceId]', params: { spaceId } });
    } catch (error) {
      console.error('Error creating space:', error);
      Alert.alert('Error', 'Failed to create space. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ 
        headerRight: () => (
          <Pressable onPress={handleSubmit} disabled={isLoading} style={{ padding: 8, marginRight: 8 }}>
            <Text style={{ color: isLoading ? Colors.primaryLight : Colors.primary, fontSize: 17, fontWeight: '600' }}>Save</Text>
          </Pressable>
        )
      }}/>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Space Name *</Text>
          <TextInput
            style={[styles.input, nameError ? styles.inputError : null]}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Family Budget"
            placeholderTextColor="#999"
            autoFocus
            editable={!isLoading}
          />
          {nameError ? <Text style={styles.errorMessage}>{nameError}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description for this space"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isLoading}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.helperText}>
            Spaces allow you to organize and share transactions with others. You can create multiple spaces for different purposes.
          </Text>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Creating space...</Text>
          </View>
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
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  errorMessage: {
    color: Colors.expense,
    fontSize: 14,
    marginTop: 4,
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
