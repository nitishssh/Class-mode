import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Locks the signed-in shell behind the device's own unlock (Face ID /
// fingerprint, falling back to the device PIN). Design decision D-14:
// no biometrics enrolled → skip the gate entirely; never build a custom PIN.
type GateState = 'checking' | 'locked' | 'unlocked';

export function BiometricGate({ children }: PropsWithChildren) {
  const [gate, setGate] = useState<GateState>('checking');
  const theme = useTheme();

  const attemptUnlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock ClassMode',
      // Device PIN/passcode is the fallback — expo-local-authentication
      // surfaces it automatically when this stays false.
      disableDeviceFallback: false,
    });
    setGate(result.success ? 'unlocked' : 'locked');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS === 'web') {
        setGate('unlocked');
        return;
      }
      const [hasHardware, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (cancelled) return;
      if (!hasHardware || !enrolled) {
        setGate('unlocked');
        return;
      }
      await attemptUnlock();
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptUnlock]);

  if (gate === 'unlocked') return children;

  return (
    <ScreenShell contentStyle={styles.content}>
      <ThemedView style={styles.panel}>
        <ThemedText type="subtitle">Locked</ThemedText>
        <ThemedText themeColor="textSecondary">
          {gate === 'checking'
            ? 'Checking device security…'
            : 'Unlock with your fingerprint, face, or device PIN to continue.'}
        </ThemedText>
        {gate === 'locked' ? (
          <Pressable
            accessibilityRole="button"
            onPress={attemptUnlock}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.accent },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Unlock
            </ThemedText>
          </Pressable>
        ) : null}
      </ThemedView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  panel: {
    gap: Spacing.three,
  },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.75,
  },
});
