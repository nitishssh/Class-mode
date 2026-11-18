import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ContractError, OfflineError } from '@/lib/api';
import { fetchClasses, fetchMarks, summarizeRows, todayDateString } from '@/lib/attendance';
import { flushQueue, pendingItems, type QueueItem } from '@/lib/attendance-queue';
import { ROLE_HOME_COPY, ROLE_LABELS } from '@/lib/role-navigation';
import { useSession, useSessionUser } from '@/lib/session';
import type { AttendanceStatus } from '@/shared/mobile-api';

type ClassCard = {
  className: string;
  counts: Record<AttendanceStatus, number> | null;
  queued: boolean;
  failed: string | null;
};

type HomeData =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; cards: ClassCard[] };

function classCardOrder(a: ClassCard, b: ClassCard): number {
  // Unmarked classes need action — they float to the top (D-4).
  const aMarked = a.counts !== null || a.queued;
  const bMarked = b.counts !== null || b.queued;
  if (aMarked !== bMarked) return aMarked ? 1 : -1;
  return a.className.localeCompare(b.className);
}

function useTeacherHome(schoolCode: string | null, offline: boolean) {
  const [data, setData] = useState<HomeData>({ kind: 'loading' });

  const load = useCallback(async () => {
    if (schoolCode === null) return; // fail closed — never fetch unscoped
    try {
      // Deliver anything a previous session left queued before reading state.
      const queueOutcome = await flushQueue().catch(() => null);
      const queued = queueOutcome ? [] : await pendingItems();

      const classes = await fetchClasses();
      const today = todayDateString();
      const queuedNow: QueueItem[] = queueOutcome
        ? [...queueOutcome.pending, ...queueOutcome.failed]
        : queued;

      const cards = await Promise.all(
        classes.map(async (className): Promise<ClassCard> => {
          const queuedItem = queuedNow.find(
            (i) => i.className === className && i.date === today
          );
          const rows = await fetchMarks(className, today).catch(() => []);
          return {
            className,
            counts: summarizeRows(rows),
            queued: Boolean(queuedItem && !queuedItem.failedWith),
            failed: queuedItem?.failedWith ?? null,
          };
        })
      );
      setData({ kind: 'ready', cards: cards.sort(classCardOrder) });
    } catch (err) {
      if (err instanceof OfflineError) {
        setData({ kind: 'error', message: "You're offline — pull up this screen again once connected." });
      } else if (err instanceof ContractError) {
        setData({ kind: 'error', message: 'The app is out of date with the server. Please update.' });
      } else {
        setData({ kind: 'error', message: 'Could not load your classes — tap to retry.' });
      }
    }
  }, [schoolCode]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return { data, reload: load, offline };
}

function ReceiptCard({ card }: { card: ClassCard }) {
  const theme = useTheme();
  const marked = card.counts !== null;

  return (
    <Link href={{ pathname: '/(app)/attendance', params: { className: card.className } }} asChild>
      <Pressable accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedView style={styles.cardHeader}>
            <ThemedText type="smallBold">{card.className}</ThemedText>
            {card.queued ? (
              <ThemedText type="small" style={{ color: theme.pending }}>
                Pending sync
              </ThemedText>
            ) : null}
          </ThemedView>

          {card.failed ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              Attendance NOT saved — {card.failed}. Open to re-mark.
            </ThemedText>
          ) : marked && card.counts ? (
            <ThemedText type="small" themeColor="textSecondary">
              <ThemedText type="smallBold" style={{ color: theme.success }}>
                {card.counts.present} present
              </ThemedText>
              {card.counts.absent > 0 ? (
                <ThemedText type="smallBold" style={{ color: theme.danger }}>
                  {'  '}
                  {card.counts.absent} absent
                </ThemedText>
              ) : null}
              {card.counts.late > 0 ? `  ${card.counts.late} late` : ''}
              {card.counts.excused > 0 ? `  ${card.counts.excused} excused` : ''}
              {'  ·  tap to review'}
            </ThemedText>
          ) : card.queued ? (
            <ThemedText type="small" style={{ color: theme.pending }}>
              {"Saved on this phone — will sync when you're back online."}
            </ThemedText>
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.warning }}>
              Not marked yet — tap to mark now
            </ThemedText>
          )}
        </ThemedView>
      </Pressable>
    </Link>
  );
}

function TeacherHome({ schoolCode, offline }: { schoolCode: string; offline: boolean }) {
  const theme = useTheme();
  const { data, reload } = useTeacherHome(schoolCode, offline);

  if (data.kind === 'loading') {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          {"Loading today's classes…"}
        </ThemedText>
      </ThemedView>
    );
  }

  if (data.kind === 'error') {
    return (
      <Pressable accessibilityRole="button" onPress={reload}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" style={{ color: theme.danger }}>
            {data.message}
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  if (data.cards.length === 0) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">No classes yet</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Ask your school admin to add students to a class — it will show up here.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.cardList}>
      {data.cards.map((card) => (
        <ReceiptCard key={card.className} card={card} />
      ))}
    </ThemedView>
  );
}

export default function RoleHomeScreen() {
  const theme = useTheme();
  const { signOut } = useSession();
  const { user, offline } = useSessionUser();
  const copy = ROLE_HOME_COPY[user.role];
  const isPlatformAdmin = user.role === 'admin';

  return (
    <ScreenShell>
      <ThemedView style={styles.header}>
        <ThemedView style={styles.headerRow}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {ROLE_LABELS[user.role]}
            {user.schoolCode ? ` · ${user.schoolCode}` : ''}
          </ThemedText>
          <Pressable accessibilityRole="button" onPress={() => void signOut()}>
            <ThemedText type="link" themeColor="textSecondary">
              Sign out
            </ThemedText>
          </Pressable>
        </ThemedView>
        <ThemedText type="title">{copy.title}</ThemedText>
        {offline ? (
          <ThemedText type="small" style={{ color: theme.pending }}>
            Offline — showing what this phone knows. Marking still works and syncs later.
          </ThemedText>
        ) : null}
      </ThemedView>

      {!user.schoolCode && !isPlatformAdmin ? (
        // Fail closed: no tenant scope, no data. Never fetch unscoped.
        <PlaceholderPanel
          eyebrow="Account issue"
          title="No school linked to this account"
          body="Your account has no school attached, so nothing can load here. Ask your school admin to fix your account, then sign in again."
        />
      ) : user.role === 'teacher' ? (
        <TeacherHome schoolCode={user.schoolCode!} offline={offline} />
      ) : (
        <PlaceholderPanel
          eyebrow="Coming after the pilot"
          title={copy.title}
          body={copy.summary}
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardList: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.75,
  },
});
