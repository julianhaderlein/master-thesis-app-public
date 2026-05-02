import { Suspense } from 'react';
import { Colors } from '@/constants/theme';
import { Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { DatabaseProvider } from '@/db/db-provider';
import { ErrorBoundary } from 'react-error-boundary';
import { useUsername } from '@/services/username-provider';
import { useAuth } from '@/services/auth-provider';
import { LoadingScreen } from '@/services/auth/LoadingScreen';
import { PasswordSetupScreen } from '@/services/auth/PasswordSetupScreen';
import { PasswordLoginScreen } from '@/services/auth/PasswordLoginScreen';
import { UsernameSetupScreen } from '@/services/auth/UsernameSetupScreen';
import { P2PBridge } from '@/services/P2PBridge';

function LoadingFallback() {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
      <Text>Initializing database...</Text>
    </SafeAreaView>
  );
}

/**
 * Gates rendering based on auth state. Renders the appropriate screen
 * depending on whether the user needs to set up a password, log in, set a
 * username, or has fully completed onboarding.
 *
 * State machine: checking → setup → login → onboarding → unlocked
 */
export function AppAuth() {
  const { status } = useAuth();
  const { hasUsername, isLoading: isUsernameLoading } = useUsername();

  if (status === 'checking' || isUsernameLoading) return <LoadingScreen message="Checking authentication..." />;
  if (status === 'setup') return <PasswordSetupScreen />;
  if (status === 'login') return <PasswordLoginScreen />;

  // status === 'unlocked' — guard username onboarding before rendering the app
  if (!hasUsername) return <UsernameSetupScreen />;

  return (
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
            Database Error
          </Text>
          <Text style={{ color: Colors.textMuted, textAlign: 'center' }}>
            {error instanceof Error ? error.message : String(error)}
          </Text>
        </SafeAreaView>
      )}
    >
      <Suspense fallback={<LoadingFallback />}>
        <DatabaseProvider>
          <P2PBridge>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </P2PBridge>
        </DatabaseProvider>
      </Suspense>
    </ErrorBoundary>
  );
}
