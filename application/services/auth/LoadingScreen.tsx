import React from 'react';
import { Colors } from '@/constants/theme';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function LoadingScreen({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundMuted,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textMuted,
    fontSize: 14,
  },
});
