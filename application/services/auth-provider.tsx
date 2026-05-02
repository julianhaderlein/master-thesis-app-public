import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRPC } from '@/backend/rpc-provider';
import {
  BOOTSTRAP_KEY,
  BIOMETRIC_KEY,
  BIOMETRICS_ENABLED_KEY,
  BiometricCancelledError,
  type BootstrapRecord,
  type BiometricRecord,
} from './auth/constants';

export type { BootstrapRecord } from './auth/constants';

export type AuthStatus = 'checking' | 'setup' | 'login' | 'unlocked';

export interface AuthContextType {
  status: AuthStatus;
  biometricsEnabled: boolean;
  // Setup screen callback
  setupPassword: (password: string, withBiometrics: boolean) => Promise<void>;
  // Login screen callback
  unlockWithPassword: (password: string) => Promise<void>;
  unlockWithBiometrics: () => Promise<void>;
  // Available when status === 'unlocked'
  hashedPassword: string;
  enableBiometrics: () => Promise<void>;
  disableBiometrics: () => Promise<void>;
  /** Change password — returns the new hashed password so the caller can rotate the DB key */
  changePassword: (oldPassword: string, newPassword: string) => Promise<string>;
  isBackendReady: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { rpc, isBackendReady } = useRPC();
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [bootstrapRecord, setBootstrapRecord] = useState<BootstrapRecord | null>(null);
  const [hashedPassword, setHashedPassword] = useState('');
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  // Check SecureStore on mount to determine initial state
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const bootstrapRaw = await SecureStore.getItemAsync(BOOTSTRAP_KEY);
        if (cancelled) return;

        if (!bootstrapRaw) {
          setStatus('setup');
          return;
        }

        const record: BootstrapRecord = JSON.parse(bootstrapRaw);
        const biometricsEnabledFlag = await SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY);
        const biometricsEnabled = SecureStore.canUseBiometricAuthentication() && biometricsEnabledFlag === 'true';
        if (cancelled) return;

        setBootstrapRecord(record);

        if (!biometricsEnabled) {
          setStatus('login');
          return;
        }

        setBiometricsEnabled(true);

        try {
          await unlockWithBiometrics();
          return; // Success — stay on unlocked state
        } catch {
          // Biometric auth was cancelled or failed — fall through to password screen
        }

        setStatus('login');
      } catch (err) {
        console.error('[AuthProvider] Failed to check auth state:', err);
        setStatus('setup');
      }
    }

    if (isBackendReady) {
      check();
    }

    return () => { cancelled = true; };
  }, [isBackendReady, rpc]);

  const storeBiometricEntry = async (record: BootstrapRecord, hp: string) => {
    const bioRecord: BiometricRecord = {
      ciphertext: record.ciphertext,
      nonce: record.nonce,
      hashedPassword: hp,
    };
    try {
      await SecureStore.setItemAsync(BIOMETRIC_KEY, JSON.stringify(bioRecord), {
        requireAuthentication: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      if (message.includes('cancel')) throw new BiometricCancelledError();
      throw err;
    }
    await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, 'true');
    setBiometricsEnabled(true);
  };

  const setupPassword = async (password: string, withBiometrics: boolean) => {
    if (!rpc || !isBackendReady) throw new Error('Failed to setup password: RPC not ready!');

    const result = await rpc.setupPassword({ password });

    if (!result.hashedPassword) throw new Error('Password setup failed!');

    const newBootstrapRecord: BootstrapRecord = { ciphertext: result.ciphertext, nonce: result.nonce, salt: result.salt };

    await SecureStore.setItemAsync(BOOTSTRAP_KEY, JSON.stringify(newBootstrapRecord));

    if (withBiometrics) {
      await storeBiometricEntry(newBootstrapRecord, result.hashedPassword);
    }

    setBootstrapRecord(newBootstrapRecord);
    setHashedPassword(result.hashedPassword);
    setStatus('unlocked');
  };

  const unlockWithPassword = async (password: string) => {
    if (!rpc || !isBackendReady || !bootstrapRecord) throw new Error('Unlock failed: RPC not ready or missing bootstrap record!');

    const result = await rpc.unlockWithPassword({
      password,
      salt: bootstrapRecord.salt,
      ciphertext: bootstrapRecord.ciphertext,
      nonce: bootstrapRecord.nonce,
    });

    if (!result.hashedPassword) throw new Error('Unlock failed: Incorrect password!');

    setHashedPassword(result.hashedPassword);
    setStatus('unlocked');
  };

  const unlockWithBiometrics = async () => {
    let biometricRecordRaw = undefined;
    try {
      biometricRecordRaw = await SecureStore.getItemAsync(BIOMETRIC_KEY, {
        requireAuthentication: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      if (message.includes('cancel')) throw new BiometricCancelledError();
      throw err;
    }

    if (biometricRecordRaw && rpc) {
      const bioRecord: BiometricRecord = JSON.parse(biometricRecordRaw);
      await rpc.unlockWithCredentials({
        ciphertext: bioRecord.ciphertext,
        nonce: bioRecord.nonce,
        hashedPassword: bioRecord.hashedPassword,
      });
      setHashedPassword(bioRecord.hashedPassword);
      setStatus('unlocked');
      return;
    }
  };

  const enableBiometrics = async () => {
    if (!bootstrapRecord || !hashedPassword) throw new Error('Cannot enable biometrics: missing bootstrap record or hashed password!');
    await storeBiometricEntry(bootstrapRecord, hashedPassword);
  };

  const disableBiometrics = async () => {
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
    await SecureStore.deleteItemAsync(BIOMETRICS_ENABLED_KEY);
    setBiometricsEnabled(false);
  }

  const changePassword = async (oldPassword: string, newPassword: string): Promise<string> => {
    if (!rpc || !isBackendReady) throw new Error('Change password failed: RPC not ready!');

    const result = await rpc.changePassword({ oldPassword, newPassword });
    if (!result.success) throw new Error('Current password is incorrect.');

    const record: BootstrapRecord = { ciphertext: result.newCiphertext, nonce: result.newNonce, salt: result.newSalt };

    // Update SecureStore and local state before returning so the caller can rotate the DB key
    await SecureStore.setItemAsync(BOOTSTRAP_KEY, JSON.stringify(record));
    setBootstrapRecord(record);
    setHashedPassword(result.newHashedPassword);

    // Invalidate biometric entry — user must re-enable after password change
    await disableBiometrics();

    return result.newHashedPassword;
  };

  const ctxValue: AuthContextType = {
    status,
    biometricsEnabled,
    setupPassword,
    unlockWithPassword,
    unlockWithBiometrics,
    hashedPassword,
    enableBiometrics,
    disableBiometrics,
    changePassword,
    isBackendReady,
  };

  return <AuthContext.Provider value={ctxValue}>{children}</AuthContext.Provider>;
}
