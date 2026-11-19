import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ContractError, OfflineError } from '@/lib/api';
import {
  fetchSchoolAttendanceSummary,
  shiftDateString,
  todayDateString,
} from '@/lib/attendance';
import { useSessionUser } from '@/lib/session';
import type {
  SchoolAttendanceClassSummary,
  SchoolAttendanceSummaryResponse,
} from '@/shared/mobile-api';

const DASHBOARD_ROLES = new Set(['principal', 'school_admin', 'admin']);

type DashboardState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; summary: SchoolAttendanceSummaryResponse };

function coverage(marked: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((marked / total) * 100);
}

function useSchoolDashboard(canLoad: boolean, date: string) {
  const [state, setState] = useState<DashboardState>({ kind: 'loading' });

  const load = useCallback(async () => {
    if (!canLoad) return;
    setState({ kind: 'loading' });
    try {
      const summary = await fetchSchoolAttendanceSummary(date);
      setState({ kind: 'ready', summary });
    } catch (err) {
      if (err instanceof OfflineError) {
        setState({ kind: 'error', message: "You're offline — reconnect to refresh the school view." });
      } else if (err instanceof ContractError) {
        setState({ kind: 'error', message: 'The app is out of date with the server. Please update.' });
      } else {
        setState({ kind: 'error', message: 'Could not load school attendance — tap to retry.' });
      }
    }
  }, [canLoad, date]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return { state, reload: load };
}

export default function SchoolScreen() {
  const theme = useTheme();
  const { user, offline } = useSessionUser();
  const [date, setDate] = useState(todayDateString());
  const canUseDashboard = DASHBOARD_ROLES.has(user.role);
  const isPlatformAdmin = user.role === 'admin';
  const hasScope = Boolean(user.schoolCode) || isPlatformAdmin;
  const { state, reload } = useSchoolDashboard(canUseDashboard && hasScope, date);

  if (!canUseDashboard) {
    return (
      <ScreenShell>
        <PlaceholderPanel
          eyebrow="School"
          title="Staff dashboard"
          body="School-wide coverage is available to principals and school admins."
        />
      </ScreenShell>
    );
  }

  if (!hasScope) {
    return (
      <ScreenShell>
        <PlaceholderPanel
          eyebrow="Account issue"
          title="No school linked to this account"
          body="The school dashboard needs a school scope. Ask your admin to fix your account, then sign in again."
        />
      </ScreenShell>
    );
  }

  const isToday = date === todayDateString();

  return (
    <ScreenShell>
      <ThemedView style={styles.header}>
        <ThemedView style={styles.headerRow}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {user.schoolCode ?? 'All schools'}
          </ThemedText>
          <Pressable accessibilityRole="button" onPress={() => void reload()}>
            <ThemedText type="link" themeColor="textSecondary">
              Refresh
            </ThemedText>
          </Pressable>
        </ThemedView>
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
        {offline ? (
          <ThemedText type="small" style={{ color: theme.pending }}>
            Offline — reconnect before trusting live coverage.
          </ThemedText>
        ) : null}
      </ThemedView>

      {state.kind === 'loading' ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            Loading school attendance…
          </ThemedText>
        </ThemedView>
      ) : null}

      {state.kind === 'error' ? (
        <Pressable accessibilityRole="button" onPress={() => void reload()}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" style={{ color: theme.danger }}>
              {state.message}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ) : null}

      {state.kind === 'ready' ? <Dashboard summary={state.summary} /> : null}
    </ScreenShell>
  );
}

function Dashboard({ summary }: { summary: SchoolAttendanceSummaryResponse }) {
  const theme = useTheme();
  const totals = summary.totals;
  const coveragePct = coverage(totals.markedStudents, totals.totalStudents);

  if (summary.classes.length === 0) {
    return (
      <PlaceholderPanel
        eyebrow="No classes"
        title="Nothing to summarize yet"
        body="Add students to classes first. This dashboard stays empty until real school data exists."
      />
    );
  }

  return (
    <ThemedView style={styles.stack}>
      <ThemedView style={styles.kpiGrid}>
        <Metric label="Coverage" value={`${coveragePct}%`} tone={coveragePct === 100 ? 'success' : 'warning'} />
        <Metric label="Absent" value={String(totals.absent)} tone={totals.absent > 0 ? 'danger' : 'success'} />
        <Metric label="Unmarked" value={String(totals.unmarked)} tone={totals.unmarked > 0 ? 'warning' : 'success'} />
      </ThemedView>

      {summary.unmarkedClasses.length > 0 ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold" style={{ color: theme.warning }}>
            Chase {summary.unmarkedClasses.length}{' '}
            {summary.unmarkedClasses.length === 1 ? 'class' : 'classes'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {summary.unmarkedClasses.join(', ')}
          </ThemedText>
        </ThemedView>
      ) : (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold" style={{ color: theme.success }}>
            Every class is marked
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Coverage is complete for this date.
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.classList}>
        {summary.classes.map((row) => (
          <ClassSummaryRow key={row.className} row={row} />
        ))}
      </ThemedView>
    </ThemedView>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'danger';
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.metric}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="subtitle" style={{ color: theme[tone] }}>
        {value}
      </ThemedText>
    </ThemedView>
  );
}

function ClassSummaryRow({ row }: { row: SchoolAttendanceClassSummary }) {
  const theme = useTheme();
  const rowCoverage = coverage(row.markedStudents, row.totalStudents);
  return (
    <ThemedView type="backgroundElement" style={styles.classRow}>
      <ThemedView style={styles.classHeader}>
        <ThemedText type="smallBold">{row.className}</ThemedText>
        <ThemedText type="smallBold" style={{ color: row.unmarked > 0 ? theme.warning : theme.success }}>
          {rowCoverage}%
        </ThemedText>
      </ThemedView>
      <ThemedText type="small" themeColor="textSecondary">
        {row.markedStudents}/{row.totalStudents} marked
        {row.absent > 0 ? ` · ${row.absent} absent` : ''}
        {row.late > 0 ? ` · ${row.late} late` : ''}
        {row.excused > 0 ? ` · ${row.excused} excused` : ''}
      </ThemedText>
      {row.unmarked > 0 ? (
        <ThemedText type="small" style={{ color: theme.warning }}>
          {row.unmarked} still unmarked
        </ThemedText>
      ) : null}
    </ThemedView>
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
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  stack: {
    gap: Spacing.three,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metric: {
    flex: 1,
    minHeight: 96,
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  classList: {
    gap: Spacing.two,
  },
  classRow: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});
