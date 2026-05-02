import React, { useState } from 'react';
import { Colors } from '@/constants/theme';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRPC } from '@/backend/rpc-provider';
import { useAuth } from '@/services/auth-provider';

export function PasswordSetupScreen() {
    const { isBackendReady, setupPassword } = useAuth();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [biometricsToggle, setBiometricsToggle] = useState(false);

    const handleSubmit = async () => {
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        if (!isBackendReady) {
            setError('App is still initializing. Please wait.');
            return;
        }

        setLoading(true);
        try {
            await setupPassword(password, biometricsToggle);
        } catch (err) {
            console.error('[AuthProvider] Password setup failed:', err);
            setError('Setup failed. Please try again.');
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
                <Text style={styles.title}>Create App Password</Text>
                <Text style={styles.subtitle}>
                    Your password encrypts all local data and P2P connections. It cannot be recovered if forgotten.
                </Text>

                <Text style={styles.label}>Password</Text>
                <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="At least 8 characters"
                    autoCapitalize="none"
                    editable={!loading}
                    returnKeyType="next"
                />

                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                    style={styles.input}
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry
                    placeholder="Repeat password"
                    autoCapitalize="none"
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                />

                {SecureStore.canUseBiometricAuthentication() && (
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Enable Biometric Login</Text>
                        <Switch
                            value={biometricsToggle}
                            onValueChange={setBiometricsToggle}
                            disabled={loading}
                        />
                    </View>
                )}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {loading ? (
                    <ActivityIndicator style={styles.spinner} size="large" color="#007AFF" />
                ) : (
                    <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
                        <Text style={styles.buttonText}>Create Password</Text>
                    </TouchableOpacity>
                )}

                {loading && (
                    <Text style={styles.hint}>Deriving encryption key — this takes a few seconds…</Text>
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
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.backgroundLight,
        marginBottom: 8,
    },
    toggleLabel: {
        fontSize: 15,
        color: Colors.text,
    },
    error: {
        color: Colors.dangerDark,
        fontSize: 13,
        marginBottom: 12,
    },
    spinner: {
        marginTop: 12,
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
    hint: {
        color: Colors.textFaint,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
    },
});
