import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useSession } from '@/lib/session';

export default function IndexRoute() {
  const { state } = useSession();

  if (state.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return state.status === 'signedIn' ? (
    <Redirect href="/(app)" />
  ) : (
    <Redirect href="/(public)/login" />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
