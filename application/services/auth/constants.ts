// ── SecureStore keys ────────────────────────────────────────────────────────

export class BiometricCancelledError extends Error {
  constructor() {
    super('Biometric authentication was cancelled.');
    this.name = 'BiometricCancelledError';
  }
}

export const BOOTSTRAP_KEY = 'auth.bootstrapRecord';
export const BIOMETRIC_KEY = 'auth.biometricCredentials';
export const BIOMETRICS_ENABLED_KEY = 'auth.biometricsEnabled';

// ── Shared types ─────────────────────────────────────────────────────────────

export interface BootstrapRecord {
  ciphertext: string;
  nonce: string;
  salt: string;
}

export interface BiometricRecord {
  ciphertext: string;
  nonce: string;
  hashedPassword: string;
}
