/**
 * Username Context Provider
 * 
 * Provides username access throughout the app via React Context.
 * Loads username once from SecureStore and caches in memory.
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

const USERNAME_KEY = 'user.username';

/**
 * Retrieve username from SecureStore (internal helper)
 */
async function getUsernameFromStore(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(USERNAME_KEY);
  } catch (error) {
    console.error('Failed to retrieve username from SecureStore:', error);
    return null;
  }
}

/**
 * Store username in SecureStore (internal helper)
 */
async function setUsernameInStore(username: string): Promise<void> {
  if (!username || username.trim().length === 0) {
    throw new Error('Username cannot be empty');
  }

  try {
    await SecureStore.setItemAsync(USERNAME_KEY, username.trim());
  } catch (error) {
    console.error('Failed to store username in SecureStore:', error);
    throw error;
  }
}

/**
 * Clear username from SecureStore (internal helper)
 */
async function clearUsernameFromStore(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(USERNAME_KEY);
  } catch (error) {
    console.error('Failed to clear username from SecureStore:', error);
    throw error;
  }
}

/**
 * Username context type
 */
interface UsernameContextType {
  username: string | null;
  isLoading: boolean;
  hasUsername: boolean;
  updateUsername: (newUsername: string) => Promise<void>;
  clearUsername: () => Promise<void>;
}

/**
 * Username context
 */
const UsernameContext = createContext<UsernameContextType | undefined>(undefined);

/**
 * Username Provider Component
 * Loads username once on mount and provides it via context
 */
export function UsernameProvider({ children }: { children: ReactNode }) {
  const [username, setUsernameState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadUsername() {
      try {
        const stored = await getUsernameFromStore();
        if (isMounted) {
          setUsernameState(stored);
        }
      } catch (error) {
        console.error('[UsernameProvider] Failed to load username:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadUsername();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Update username in both SecureStore and context state
   */
  const updateUsername = async (newUsername: string) => {
    await setUsernameInStore(newUsername);
    setUsernameState(newUsername);
  };

  /**
   * Clear username from both SecureStore and context state
   */
  const clearUsernameFromContext = async () => {
    try {
      await clearUsernameFromStore();
      setUsernameState(null);
    } catch (error) {
      console.error('[UsernameProvider] Failed to clear username:', error);
      throw error;
    }
  };

  const value: UsernameContextType = {
    username,
    isLoading,
    hasUsername: username !== null && username.trim().length > 0,
    updateUsername,
    clearUsername: clearUsernameFromContext,
  };

  return (
    <UsernameContext.Provider value={value}>
      {children}
    </UsernameContext.Provider>
  );
}

/**
 * React hook for accessing username from context
 * Must be used within UsernameProvider
 * 
 * @returns Object with username, loading state, and setter function
 */
export function useUsername(): UsernameContextType {
  const context = useContext(UsernameContext);
  if (context === undefined) {
    throw new Error('useUsername must be used within UsernameProvider');
  }
  return context;
}

/**
 * Get current peer ID (username) for P2P operations
 * Use this function in non-React code (services, utilities)
 * For React components, prefer using useUsername() hook
 * 
 * @returns Username to use as originPeerId in operations
 */
export async function getCurrentPeerId(): Promise<string> {
  const username = await getUsernameFromStore();
  if (!username) {
    throw new Error('Username not set. User must complete onboarding first.');
  }
  return username;
}
