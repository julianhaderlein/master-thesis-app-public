import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Colors } from '@/constants/theme';
import { Stack, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

const Z32_PATTERN = /^[a-z0-9]+$/i;
const DEEP_LINK_SCHEME = 'p2p.finance.app://';

function extractInviteCode(scanned: string): string | null {
  // Handle deep link URL: p2p.finance.app://spaces/join?invite=<code>
  if (scanned.startsWith(DEEP_LINK_SCHEME)) {
    try {
      const queryStart = scanned.indexOf('?');
      if (queryStart !== -1) {
        const queryString = scanned.slice(queryStart + 1);
        const params = new URLSearchParams(queryString);
        const invite = params.get('invite');
        if (invite && Z32_PATTERN.test(invite)) return invite;
      }
    } catch {
      // fall through
    }
    return null;
  }
  // Handle raw z32 invite code
  if (Z32_PATTERN.test(scanned.trim())) {
    return scanned.trim();
  }
  return null;
}

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  const debounceRef = useRef(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (debounceRef.current) return;
    debounceRef.current = true;

    const inviteCode = extractInviteCode(data);
    if (!inviteCode) {
      Alert.alert('Invalid QR Code', 'This QR code does not contain a valid Space invite.', [
        {
          text: 'Try Again',
          onPress: () => {
            debounceRef.current = false;
          },
        },
      ]);
      return;
    }

    setScanned(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Navigate back to join screen with scanned invite
    // router.navigate goes to an existing stack entry and updates its params
    router.navigate({ pathname: '/spaces/join', params: { scannedInvite: inviteCode } });
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Scan QR Code' }} />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            Camera access is needed to scan QR codes for joining Spaces.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.permissionButton, pressed && styles.buttonPressed]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Scan QR Code',
          headerRight: () => (
            <Pressable onPress={() => setTorch((t) => !t)} style={{ padding: 8, marginRight: 8 }}>
              <Text style={{ color: torch ? Colors.warning : Colors.primary, fontSize: 15, fontWeight: '600' }}>
                {torch ? 'Torch On' : 'Torch Off'}
              </Text>
            </Pressable>
          ),
        }}
      />
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Viewfinder overlay */}
      <View style={styles.overlay}>
        <View style={styles.topOverlay} />
        <View style={styles.middleRow}>
          <View style={styles.sideOverlay} />
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay}>
          {scanned ? (
            <Text style={styles.scanSuccess}>✓ Code scanned!</Text>
          ) : (
            <Text style={styles.scanHint}>Point at a Space invite QR code</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const FRAME_SIZE = 260;
const OVERLAY_COLOR = 'rgba(0,0,0,0.55)';
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = Colors.white;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.white,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  permissionButtonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topOverlay: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  middleRow: {
    flexDirection: 'row',
    height: FRAME_SIZE,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CORNER_COLOR,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 4,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    alignItems: 'center',
    paddingTop: 24,
  },
  scanHint: {
    color: Colors.white,
    fontSize: 15,
    opacity: 0.85,
  },
  scanSuccess: {
    color: Colors.incomeLight,
    fontSize: 18,
    fontWeight: '700',
  },
});
