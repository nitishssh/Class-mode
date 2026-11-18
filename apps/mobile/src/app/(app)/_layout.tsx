import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { BiometricGate } from '@/components/biometric-gate';
import { useSession } from '@/lib/session';

// Fail-closed shell: nothing inside (app) renders without a signed-in
// session. Screens additionally guard on schoolCode (null scope = blocked
// state, never an unscoped fetch) — see the tenant-isolation invariant.
export default function AuthedLayout() {
  const { state } = useSession();

  if (state.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state.status === 'signedOut') {
    return <Redirect href="/(public)/login" />;
  }

  return (
    <BiometricGate>
      <AppTabs />
    </BiometricGate>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
