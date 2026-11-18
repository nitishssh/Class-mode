import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type PlaceholderPanelProps = {
  eyebrow: string;
  title: string;
  body: string;
};

export function PlaceholderPanel({ eyebrow, title, body }: PlaceholderPanelProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.panel}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.eyebrow}>
        {eyebrow}
      </ThemedText>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText themeColor="textSecondary">{body}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  eyebrow: {
    textTransform: 'uppercase',
  },
});
