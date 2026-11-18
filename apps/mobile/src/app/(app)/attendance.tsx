import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ContractError, OfflineError } from '@/lib/api';
import {
  fetchClasses,
  fetchMarks,
  fetchRoster,
  isWithinBackfillWindow,
  MAX_BACKFILL_DAYS,
  shiftDateString,
  todayDateString,
} from '@/lib/attendance';
import { enqueueMarks, flushQueue } from '@/lib/attendance-queue';
import { useSessionUser } from '@/lib/session';
import type { AttendanceStatus, MarkAttendanceResponse, RosterStudent } from '@/shared/mobile-api';

const MARKING_ROLES = new Set(['teacher', 'principal', 'school_admin', 'admin']);

// Tap cycles the fast path (present ↔ absent); long-press cycles the long
// tail (late → excused → present) — D-2: one-tap stays the primary gesture.
function nextOnTap(status: AttendanceStatus): AttendanceStatus {
  return status === 'present' ? 'absent' : 'present';
}
function nextOnLongPress(status: AttendanceStatus): AttendanceStatus {
  if (status === 'late') return 'excused';
  if (status === 'excused') return 'present';
  return 'late';
}

function tick() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync().catch(() => undefined);
  }
}

type SaveBanner =
  | { kind: 'saved'; text: string; canUndo: boolean }
  | { kind: 'queued'; text: string }
  | { kind: 'failed'; text: string }
  | null;

function savedBannerText(response: MarkAttendanceResponse, absent: number): string {
  // WhatsApp-honesty invariant: never claim "sent". `alerts` arrives with
  // W-2; until then (or when disabled) the copy stays delivery-neutral.
  if (response.alerts?.enabled) {
    return `Attendance saved — queued alerts for ${response.alerts.attempted} ${
      response.alerts.attempted === 1 ? 'parent' : 'parents'
    }.`;
  }
  return `Attendance saved — ${absent} absent.`;
}

export default function AttendanceScreen() {
  const theme = useTheme();
  const { user } = useSessionUser();
  const params = useLocalSearchParams<{ className?: string }>();

  const [classes, setClasses] = useState<string[] | null>(null);
  const [className, setClassName] = useState<string | null>(params.className ?? null);
  const [date, setDate] = useState<string>(todayDateString());
  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  const [statuses, setStatuses] = useState<Map<number, AttendanceStatus>>(new Map());
  const [baseline, setBaseline] = useState<Map<number, AttendanceStatus> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<SaveBanner>(null);
  const [alertsOff, setAlertsOff] = useState(false);
  const undoSnapshot = useRef<Map<number, AttendanceStatus> | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editable = isWithinBackfillWindow(date);
  const canMark = MARKING_ROLES.has(user.role);

  const loadClassDay = useCallback(async () => {
    if (!user.schoolCode && user.role !== 'admin') return; // fail closed
    setLoadError(null);
    try {
      const classList = classes ?? (await fetchClasses());
      if (classes === null) setClasses(classList);
      const active = className ?? classList[0] ?? null;
      if (className === null && active) setClassName(active);
      if (!active) {
        setRoster([]);
        return;
      }
      const [students, rows] = await Promise.all([
        fetchRoster(active),
        fetchMarks(active, date).catch(() => []),
      ]);
      const existing = new Map(rows.map((r) => [r.studentId, r.status]));
      const next = new Map<number, AttendanceStatus>();
      for (const s of students) next.set(s.id, existing.get(s.id) ?? 'present');
      setRoster(students);
      setStatuses(next);
      setBaseline(existing.size > 0 ? new Map(next) : null);
    } catch (err) {
      if (err instanceof OfflineError) {
        setLoadError("You're offline — the roster couldn't load. Reconnect and try again.");
      } else if (err instanceof ContractError) {
        setLoadError('The app is out of date with the server. Please update the app.');
      } else {
        setLoadError('Could not load this class — tap to retry.');
      }
    }
  }, [classes, className, date, user.role, user.schoolCode]);

  useFocusEffect(
    useCallback(() => {
      void loadClassDay();
    }, [loadClassDay])
  );

  useEffect(() => {
    return () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, []);

  const setStudentStatus = useCallback((studentId: number, status: AttendanceStatus) => {
    tick();
    setStatuses((prev) => new Map(prev).set(studentId, status));
  }, []);

  const markAllPresent = useCallback(() => {
    tick();
    setStatuses((prev) => {
      const next = new Map(prev);
      for (const id of next.keys()) next.set(id, 'present');
      return next;
    });
  }, []);

  const submit = useCallback(
    async (marksOverride?: Map<number, AttendanceStatus>, isUndo = false) => {
      if (busy || !className || !roster || roster.length === 0) return;
      const effective = marksOverride ?? statuses;
      setBusy(true);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      try {
        const marks = roster.map((s) => ({
          studentId: s.id,
          status: effective.get(s.id) ?? ('present' as AttendanceStatus),
        }));
        // The queue IS the submit path: enqueue, then flush immediately.
        // Offline just means the flush reports "pending" instead of "sent".
        undoSnapshot.current = isUndo ? null : (baseline ?? null);
        await enqueueMarks({ className, date, marks });
        const outcome = await flushQueue();

        const sent = outcome.sent.find(
          (s) => s.item.className === className && s.item.date === date
        );
        const failed = outcome.failed.find((f) => f.className === className && f.date === date);

        if (sent) {
          const absent = marks.filter((m) => m.status === 'absent').length;
          setAlertsOff(sent.response.alerts ? !sent.response.alerts.enabled : false);
          setBaseline(new Map(effective));
          setBanner({
            kind: 'saved',
            text: isUndo ? 'Restored previous marking.' : savedBannerText(sent.response, absent),
            canUndo: !isUndo && undoSnapshot.current !== null,
          });
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined
            );
          }
          bannerTimer.current = setTimeout(() => setBanner(null), 5000);
        } else if (failed) {
          setBanner({
            kind: 'failed',
            text: `Attendance NOT saved — ${failedText(failed.failedWith)}.`,
          });
        } else {
          setBanner({
            kind: 'queued',
            text: "Saved on this phone — it will sync when you're back online.",
          });
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, baseline, className, date, roster, statuses]
  );

  const undo = useCallback(() => {
    const snapshot = undoSnapshot.current;
    if (!snapshot) return;
    setStatuses(new Map(snapshot));
    void submit(snapshot, true);
  }, [submit]);

  if (!canMark) {
    return (
      <ScreenShell>
        <PlaceholderPanel
          eyebrow="Attendance"
          title="Nothing to mark here"
          body="Attendance marking is for school staff. Your attendance shows up on your home screen."
        />
      </ScreenShell>
    );
  }

  if (!user.schoolCode && user.role !== 'admin') {
    return (
      <ScreenShell>
        <PlaceholderPanel
          eyebrow="Account issue"
          title="No school linked to this account"
          body="Marking needs a school scope. Ask your school admin to fix your account, then sign in again."
        />
      </ScreenShell>
    );
  }

  const absentCount = [...statuses.values()].filter((s) => s === 'absent').length;
  const isToday = date === todayDateString();

  return (
    <ScreenShell>
      <ThemedView style={styles.header}>
        <ThemedText type="title">{isToday ? 'Today' : date}</ThemedText>

        <ThemedView style={styles.dateRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            onPress={() => setDate((d) => shiftDateString(d, -1))}>
            <ThemedText type="smallBold">‹ Previous</ThemedText>
          </Pressable>
          {!isToday ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next day"
              onPress={() => setDate((d) => shiftDateString(d, 1))}>
              <ThemedText type="smallBold">Next ›</ThemedText>
            </Pressable>
          ) : null}
        </ThemedView>

        {classes && classes.length > 1 ? (
          <ThemedView style={styles.classRow}>
            {classes.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="button"
                onPress={() => {
                  setClassName(c);
                  setRoster(null);
                }}>
                <ThemedView
                  type={c === className ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.classChip}>
                  <ThemedText type="small">{c}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>
        ) : null}

        {alertsOff ? (
          <ThemedText type="small" themeColor="textSecondary">
            Parent alerts: off for this school — no messages are sent.
          </ThemedText>
        ) : null}
        {!editable ? (
          <ThemedText type="small" style={{ color: theme.warning }}>
            Older than {MAX_BACKFILL_DAYS} days — read-only here. Use the web app for older
            corrections.
          </ThemedText>
        ) : null}
      </ThemedView>

      {loadError ? (
        <Pressable accessibilityRole="button" onPress={() => void loadClassDay()}>
          <ThemedView type="backgroundElement" style={styles.banner}>
            <ThemedText type="small" style={{ color: theme.danger }}>
              {loadError}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ) : null}

      {roster === null && !loadError ? (
        <ThemedView type="backgroundElement" style={styles.banner}>
          <ThemedText type="small" themeColor="textSecondary">
            Loading roster…
          </ThemedText>
        </ThemedView>
      ) : null}

      {roster !== null && roster.length === 0 && !loadError ? (
        <PlaceholderPanel
          eyebrow={className ?? 'Class'}
          title="No students in this class"
          body="Students appear here once your school admin assigns them to the class."
        />
      ) : null}

      {roster !== null && roster.length > 0 ? (
        <ThemedView style={styles.rosterList}>
          <ThemedView style={styles.rosterActions}>
            <Pressable
              accessibilityRole="button"
              disabled={!editable || busy}
              onPress={markAllPresent}>
              <ThemedText type="link" themeColor="textSecondary">
                Mark all present
              </ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              {roster.length} students
              {absentCount > 0 ? ` · ${absentCount} absent` : ''}
            </ThemedText>
          </ThemedView>

          {roster.map((student) => {
            const status = statuses.get(student.id) ?? 'present';
            const color =
              status === 'present'
                ? theme.success
                : status === 'absent'
                  ? theme.danger
                  : theme.warning;
            return (
              <Pressable
                key={student.id}
                accessibilityRole="button"
                accessibilityLabel={`${student.name}, ${status}. Tap to mark ${nextOnTap(status)}, long-press for late or excused.`}
                disabled={!editable || busy}
                onPress={() => setStudentStatus(student.id, nextOnTap(status))}
                onLongPress={() => setStudentStatus(student.id, nextOnLongPress(status))}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.studentRow}>
                  <ThemedText>{student.name}</ThemedText>
                  <ThemedText type="smallBold" style={{ color }}>
                    {status}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}

          {editable ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: theme.accent },
                (pressed || busy) && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                {busy ? 'Saving…' : baseline ? 'Save changes' : 'Save attendance'}
              </ThemedText>
            </Pressable>
          ) : null}
        </ThemedView>
      ) : null}

      {banner ? (
        <ThemedView type="backgroundElement" style={styles.banner}>
          <ThemedText
            type="small"
            style={{
              color:
                banner.kind === 'failed'
                  ? theme.danger
                  : banner.kind === 'queued'
                    ? theme.pending
                    : theme.success,
            }}>
            {banner.text}
          </ThemedText>
          {banner.kind === 'saved' && banner.canUndo ? (
            <Pressable accessibilityRole="button" onPress={undo}>
              <ThemedText type="smallBold">Undo</ThemedText>
            </Pressable>
          ) : null}
          {banner.kind === 'failed' ? (
            <Pressable accessibilityRole="button" onPress={() => void submit()}>
              <ThemedText type="smallBold">Retry</ThemedText>
            </Pressable>
          ) : null}
        </ThemedView>
      ) : null}
    </ScreenShell>
  );
}

function failedText(reason: string | undefined): string {
  return reason ?? 'rejected by the server';
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  classRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  classChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  rosterList: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  rosterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentRow: {
    minHeight: 56, // ≥44pt touch target for thumbs-while-walking (a11y)
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  saveButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.three,
  },
  pressed: {
    opacity: 0.75,
  },
});
