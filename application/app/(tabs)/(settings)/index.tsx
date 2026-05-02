import React, { useState } from 'react';
import { Colors } from '@/constants/theme';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/services/auth-provider';
import { BiometricCancelledError } from '@/services/auth/constants';

export default function SettingsScreen() {
  const { enableBiometrics, disableBiometrics, biometricsEnabled } = useAuth();
  const [enabling, setEnabling] = useState(false);

  const handleBiometricToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        if (!SecureStore.canUseBiometricAuthentication()) {
          Alert.alert(
            'Biometrics Unavailable',
            'This device does not support biometric authentication or none is enrolled.'
          );
          return;
        }
        
        
        setEnabling(true);
        await enableBiometrics();
      } else {
        Alert.alert(
          'Disable Biometric Login?',
          'You will need to enter your password every time you open the app.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Disable',
              style: 'destructive',
              onPress: async () => {
                await disableBiometrics();
              },
            },
          ]
        );
      }
    } catch (err) {
      if (err instanceof BiometricCancelledError) return;
      console.error('[Settings] Biometric toggle failed:', err);
      Alert.alert('Error', 'Failed to update biometric setting.');
    } finally {
      setEnabling(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Settings</Text>

        {/* Security Section */}
        <Text style={styles.sectionHeader}>Security</Text>
        <View style={styles.card}>
          {/* Change Password */}
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/change-password')}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>Change Password</Text>
              <Text style={styles.rowSubtitle}>Update your app encryption password</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Biometric Toggle */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>Biometric Login</Text>
              <Text style={styles.rowSubtitle}>Use fingerprint or face to unlock</Text>
            </View>
            <Switch
              value={enabling || biometricsEnabled}
              onValueChange={handleBiometricToggle}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundMuted,
  },
  content: {
    padding: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  rowLeft: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 13,
    color: Colors.textFaint,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: Colors.borderMedium,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.backgroundLight,
    marginLeft: 16,
  },
});
