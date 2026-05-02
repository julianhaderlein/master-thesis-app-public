import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Colors } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { useDatabase } from '@/db/db-provider';
import * as schema from '@/db/schema';
import * as Crypto from 'expo-crypto';
import { useUsername } from '@/services/username-provider';
import { get } from 'react-native/Libraries/TurboModule/TurboModuleRegistry';

const ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'other'] as const;

export default function CreateAccountScreen() {
  const router = useRouter();
  const { db } = useDatabase();
  const { username } = useUsername();

  const [name, setName] = useState('');
  const [type, setType] = useState<typeof ACCOUNT_TYPES[number]>('checking');
  const [currency, setCurrency] = useState('USD');
  const [initialBalance, setInitialBalance] = useState('0');
  const [nameError, setNameError] = useState('');
  const [currencyError, setCurrencyError] = useState('');
  const [balanceError, setBalanceError] = useState('');

  const handleSubmit = async () => {
    // Reset errors
    setNameError('');
    setCurrencyError('');
    setBalanceError('');

    // Validate name
    if (!name.trim()) {
      setNameError('Account name is required');
      return;
    }

    // Validate currency
    if (!currency.trim()) {
      setCurrencyError('Currency is required');
      return;
    }

    // Validate balance
    const balance = parseFloat(initialBalance);
    if (isNaN(balance)) {
      setBalanceError('Enter a valid amount');
      return;
    }

    if (!username) {
      Alert.alert('Error', 'Username not found. Please complete onboarding.');
      return;
    }

    try {
      // Generate a UUID for the account
      const id = Crypto.randomUUID();

      await db.insert(schema.accounts).values({
        id,
        originPeerId: username,
        name: name.trim(),
        type,
        currency: currency.trim().toUpperCase(),
        balance,
        isActive: true,
      } as schema.NewAccount);

      // Navigate back to accounts list
      router.back();
    } catch (error) {
      console.error('Error creating account:', error);
      Alert.alert('Error', 'Failed to create account. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ 
        headerRight: () => (
          <Pressable onPress={handleSubmit} style={{ padding: 8, marginRight: 8 }}>
            <Text style={{ color: Colors.primary, fontSize: 17, fontWeight: '600' }}>Save</Text>
          </Pressable>
        )
      }}/>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Account Name *</Text>
          <TextInput
            style={[styles.input, nameError ? styles.inputError : null]}
            value={name}
            onChangeText={setName}
            placeholder="e.g., My Checking Account"
            placeholderTextColor="#999"
            autoFocus
          />
          {nameError ? <Text style={styles.errorMessage}>{nameError}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Account Type *</Text>
          <View style={styles.typeContainer}>
            {ACCOUNT_TYPES.map((accountType) => (
              <Pressable
                key={accountType}
                style={[
                  styles.typeButton,
                  type === accountType && styles.typeButtonActive
                ]}
                onPress={() => setType(accountType)}
              >
                <Text style={[
                  styles.typeButtonText,
                  type === accountType && styles.typeButtonTextActive
                ]}>
                  {accountType.charAt(0).toUpperCase() + accountType.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Currency *</Text>
          <TextInput
            style={[styles.input, currencyError ? styles.inputError : null]}
            value={currency}
            onChangeText={setCurrency}
            placeholder="e.g., USD, EUR, GBP"
            placeholderTextColor="#999"
            autoCapitalize="characters"
            maxLength={3}
          />
          {currencyError ? <Text style={styles.errorMessage}>{currencyError}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Initial Balance</Text>
          <TextInput
            style={[styles.input, balanceError ? styles.inputError : null]}
            value={initialBalance}
            onChangeText={setInitialBalance}
            placeholder="0.00"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
          {balanceError ? <Text style={styles.errorMessage}>{balanceError}</Text> : null}
          <Text style={styles.helperText}>
            Enter a negative value for accounts with debt (e.g., credit cards)
          </Text>
        </View>
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
  errorMessage: {
    color: Colors.expense,
    fontSize: 14,
    marginTop: 4,
  },
  helperText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: Colors.white,
  },
});
