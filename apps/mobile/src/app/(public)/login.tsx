import { Redirect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, ContractError, OfflineError, apiRequest } from '@/lib/api';
import { useSession } from '@/lib/session';

// Every failure the login POST can produce maps to named copy (plan §2
// error registry): 401 wrong creds, 403 not-active, 429 rate-limited,
// offline, 5xx, contract drift. No generic "something went wrong".
function loginErrorCopy(err: unknown): string {
  if (err instanceof OfflineError) return "You're offline — check your connection and try again.";
  if (err instanceof ContractError)
    return 'The app is out of date with the server. Please update the app.';
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Wrong email or password.';
    if (err.status === 403) return 'Your account is not active — contact your school.';
    if (err.status === 429) return 'Too many tries — wait a minute, then try again.';
    if (err.status === 410) return 'Password login is disabled on this server.';
    return err.serverMessage ?? 'Server problem — please try again.';
  }
  return 'Something failed on our side — please try again.';
}

export default function LoginScreen() {
  const theme = useTheme();
  const { state, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (busy) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await signIn(trimmed, password);
      // Redirect happens declaratively below once state flips to signedIn.
    } catch (err) {
      setError(loginErrorCopy(err));
    } finally {
      setBusy(false);
    }
  }, [busy, email, password, signIn]);

  const forgotPassword = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Enter your email first, then tap "Forgot password?".');
      return;
    }
    setError(null);
    try {
      await apiRequest('/api/auth/password/forgot', { method: 'POST', body: { email: trimmed } });
      setNotice('If that account exists, a reset email is on its way.');
    } catch (err) {
      setError(loginErrorCopy(err));
    }
  }, [email]);

  if (state.status === 'signedIn') {
    return <Redirect href="/(app)" />;
  }

  return (
    <ScreenShell contentStyle={styles.content}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">ClassMode</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Attendance, alerts, and school operations.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.form}>
        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">Email</ThemedText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            editable={!busy}
            accessibilityLabel="Email"
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.backgroundElement,
              },
            ]}
            placeholder="you@school.example"
            placeholderTextColor={theme.textSecondary}
          />
        </ThemedView>

        <ThemedView style={styles.field}>
          <ThemedText type="smallBold">Password</ThemedText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            editable={!busy}
            accessibilityLabel="Password"
            onSubmitEditing={submit}
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.backgroundElement,
              },
            ]}
            placeholder="••••••••"
            placeholderTextColor={theme.textSecondary}
          />
        </ThemedView>

        {error ? (
          <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
            {error}
          </ThemedText>
        ) : null}
        {notice ? (
          <ThemedText type="small" style={{ color: theme.success }}>
            {notice}
          </ThemedText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.accent },
            (pressed || busy) && styles.pressed,
          ]}>
          {busy ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Sign in
            </ThemedText>
          )}
        </Pressable>

        <Pressable accessibilityRole="button" onPress={forgotPassword} disabled={busy}>
          <ThemedText type="link" themeColor="textSecondary">
            Forgot password?
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  header: {
    gap: Spacing.two,
  },
  subtitle: {
    maxWidth: 420,
  },
  form: {
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 48,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.75,
  },
});
