import * as Haptics from "expo-haptics";
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Animated, Pressable, StyleSheet, TextInput } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchLearningAssignments,
  fetchNextSegment,
  openLearningSession,
  submitAttempt,
  type LearningAssignment,
  type LearningSegment,
} from '@/lib/learning';

export default function LessonsScreen() {
  const theme = useTheme();
  const [assignments, setAssignments] = useState<LearningAssignment[]>([]);
  const [selected, setSelected] = useState<LearningAssignment | null>(null);
  const [segment, setSegment] = useState<LearningSegment | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [shakeAnim] = useState(() => new Animated.Value(0));

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setAssignments((await fetchLearningAssignments()).assignments); }
    catch { setError('Could not load assigned lessons. Check your connection and try again.'); }
    finally { setBusy(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const start = async (assignment: LearningAssignment) => {
    setBusy(true); setError(''); setFeedback(''); setSelected(assignment);
    try {
      const session = await openLearningSession(assignment.id);
      setSegment(await fetchNextSegment(session.sessionId));
    } catch { setError('This lesson could not be opened. It may no longer be available.'); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!selected || !segment || segment.status !== 'ready' || !answer.trim()) return;
    setBusy(true); setError('');
    try {
      const result = await submitAttempt({ assignment: selected, segment, answer: answer.trim() });
      setFeedback(result.feedback);
      if (result.proceed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
        ]).start();
      }
      if (result.proceed) {
        setAnswer('');
        setSegment(await fetchNextSegment(segment.attemptSessionId));
      }
    } catch { setError('Your attempt was not saved. Keep this screen open and try again.'); }
    finally { setBusy(false); }
  };

  if (selected && segment?.status === 'completed') {
    return <ScreenShell><ThemedText type="title">Evidence recorded</ThemedText><ThemedText>Your attempt is complete and visible in your teacher’s learning ledger.</ThemedText><Pressable style={[styles.button, { backgroundColor: theme.accent }]} onPress={() => { setSelected(null); setSegment(null); void load(); }}><ThemedText type="smallBold">Back to lessons</ThemedText></Pressable></ScreenShell>;
  }

  if (selected && segment?.status === 'ready') {
    const gate = segment.scene.actions.find((action) => action.type === 'ask' || action.type === 'assessment');
    return <ScreenShell>
      <ThemedText type="smallBold" themeColor="textSecondary">{selected.subject} · attempt {segment.gateIndex + 1}</ThemedText>
      <ThemedText type="title">{selected.objective}</ThemedText>
      {segment.scene.actions.map((action, index) => action.type === 'showSlide'
        ? <ThemedView key={index} type="backgroundElement" style={styles.card}><ThemedText type="subtitle">{action.title}</ThemedText>{action.bullets.map((bullet) => <ThemedText key={bullet}>• {bullet}</ThemedText>)}</ThemedView>
        : action.type === 'speak' ? <ThemedText key={index}>{action.text}</ThemedText> : null)}
      {gate ? <Animated.View style={[{ transform: [{ translateX: shakeAnim }] }]}><ThemedView style={styles.gate}><ThemedText type="subtitle">Think first</ThemedText><ThemedText>{gate.prompt}</ThemedText><TextInput accessibilityLabel="Your answer" multiline value={answer} onChangeText={setAnswer} placeholder="Write your reasoning…" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.hairline, backgroundColor: theme.backgroundElement }]} />{feedback ? <ThemedText>{feedback}</ThemedText> : null}<Pressable disabled={busy || !answer.trim()} style={[styles.button, { backgroundColor: theme.accent, opacity: busy || !answer.trim() ? 0.5 : 1 }]} onPress={() => void submit()}><ThemedText type="smallBold">Submit attempt</ThemedText></Pressable></ThemedView></Animated.View> : null}
      {error ? <ThemedText style={{ color: theme.danger }}>{error}</ThemedText> : null}
    </ScreenShell>;
  }

  return <ScreenShell><ThemedText type="title">Assigned lessons</ThemedText><ThemedText themeColor="textSecondary">Students think, not watch. Your work becomes evidence your teacher can act on.</ThemedText>{busy ? <ActivityIndicator /> : null}{error ? <Pressable onPress={() => void load()}><ThemedText style={{ color: theme.danger }}>{error}</ThemedText></Pressable> : null}{!busy && assignments.length === 0 ? <ThemedText>No active assignments.</ThemedText> : assignments.map((assignment) => <Pressable key={assignment.id} onPress={() => void start(assignment)}><ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">{assignment.subject} · {assignment.status.replace('_', ' ')}</ThemedText><ThemedText type="subtitle">{assignment.objective}</ThemedText>{assignment.dueAt ? <ThemedText type="small" themeColor="textSecondary">Due {new Date(assignment.dueAt).toLocaleDateString()}</ThemedText> : null}</ThemedView></Pressable>)}</ScreenShell>;
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.one, borderRadius: 4 },
  gate: { gap: Spacing.two, borderLeftWidth: 4, paddingLeft: Spacing.three },
  input: { minHeight: 120, borderWidth: 1, borderRadius: 4, padding: Spacing.three, textAlignVertical: 'top' },
  button: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: 4 },
});
