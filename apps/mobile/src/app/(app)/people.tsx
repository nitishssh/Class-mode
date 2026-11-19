import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, ContractError, OfflineError } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/notifications';
import {
  claimParentChild,
  currentMonthRange,
  fetchParentChildAttendance,
  fetchParentChildFees,
  fetchParentChildren,
  recentHistoryRange,
} from '@/lib/parent';
import { useSessionUser } from '@/lib/session';
import type {
  AttendanceStatus,
  ParentAttendanceHistoryRow,
  ParentChild,
  ParentChildFeeSummary,
} from '@/shared/mobile-api';

type ChildCard = {
  child: ParentChild;
  fees: ParentChildFeeSummary | null;
  history: ParentAttendanceHistoryRow[] | null;
};

const PARENT_ROLES = new Set(['parent', 'admin']);

export default function PeopleScreen() {
  const theme = useTheme();
  const { user, offline } = useSessionUser();
  const [cards, setCards] = useState<ChildCard[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const canReadParentView = PARENT_ROLES.has(user.role);

  const load = useCallback(async () => {
    if (!canReadParentView) return;
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetchParentChildren();
      const historyWindow = recentHistoryRange(30);
      const details = await Promise.all(
        res.children.map(async (child) => {
          const [fees, history] = await Promise.all([
            fetchParentChildFees(child.id).catch(() => null),
            fetchParentChildAttendance(child.id, historyWindow)
              .then((r) => r.attendance)
              .catch(() => null),
          ]);
          return { child, fees, history };
        })
      );
      setDate(res.date);
      setCards(details);
    } catch (err) {
      if (err instanceof OfflineError) {
        setError("You're offline — reconnect to load your children.");
      } else if (err instanceof ContractError) {
        setError('The app is out of date with the server. Please update the app.');
      } else {
        setError('Could not load children — tap to retry.');
      }
    } finally {
      setRefreshing(false);
    }
  }, [canReadParentView]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const submitClaim = useCallback(async () => {
    if (!claimCode.trim() || !claimPhone.trim() || claiming) return;
    setClaimError(null);
    setClaimMessage(null);
    setClaiming(true);
    try {
      await claimParentChild(claimCode.trim(), claimPhone.trim());
      setClaimCode('');
      setClaimPhone('');
      setClaimMessage('Child linked. Loading attendance and fees...');
      await load();
    } catch (err) {
      if (err instanceof OfflineError) {
        setClaimError("You're offline — reconnect and submit the code again.");
      } else if (err instanceof ApiError) {
        setClaimError(err.serverMessage ?? 'Could not link this child.');
      } else if (err instanceof ContractError) {
        setClaimError('The app is out of date with the server. Please update the app.');
      } else {
        setClaimError('Could not link this child.');
      }
    } finally {
      setClaiming(false);
    }
  }, [claimCode, claimPhone, claiming, load]);

  const enablePushAlerts = useCallback(async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushStatus(null);
    try {
      const result = await registerForPushNotifications();
      if (result.status === 'registered') {
        setPushStatus('Absence alerts are enabled on this device.');
      } else if (result.status === 'denied') {
        setPushStatus('Notifications are blocked in system settings.');
      } else {
        setPushStatus(result.reason);
      }
    } catch (err) {
      if (err instanceof OfflineError) {
        setPushStatus("You're offline — reconnect before enabling alerts.");
      } else if (err instanceof ContractError) {
        setPushStatus('The app is out of date with the server. Please update the app.');
      } else {
        setPushStatus('Could not enable alerts on this device.');
      }
    } finally {
      setPushBusy(false);
    }
  }, [pushBusy]);

  if (!canReadParentView) {
    return (
      <ScreenShell>
        <PlaceholderPanel
          eyebrow="People"
          title="No parent view for this role"
          body="Students, attendance, and fees appear on the screens for your account type."
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Children</ThemedText>
        <ThemedText themeColor="textSecondary">
          {date ? `Today, ${date}` : 'Attendance and dues for your linked children.'}
        </ThemedText>
        {offline ? (
          <ThemedText type="small" style={{ color: theme.warning }}>
            Offline session — reconnect for the latest status.
          </ThemedText>
        ) : null}
      </ThemedView>

      {error ? (
        <Pressable accessibilityRole="button" onPress={() => void load()}>
          <ThemedView type="backgroundElement" style={styles.banner}>
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ) : null}

      {cards === null && !error ? (
        <ThemedView type="backgroundElement" style={styles.banner}>
          <ThemedText type="small" themeColor="textSecondary">
            Loading children...
          </ThemedText>
        </ThemedView>
      ) : null}

      {cards?.length === 0 ? (
        <ClaimChildPanel
          code={claimCode}
          phone={claimPhone}
          error={claimError}
          message={claimMessage}
          submitting={claiming}
          onCodeChange={setClaimCode}
          onPhoneChange={setClaimPhone}
          onSubmit={submitClaim}
        />
      ) : null}

      {cards && cards.length > 0 ? (
          <ThemedView style={styles.list}>
            <ThemedView style={styles.listHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {cards.length} {cards.length === 1 ? 'child' : 'children'}
            </ThemedText>
            <Pressable accessibilityRole="button" disabled={refreshing} onPress={() => void load()}>
              <ThemedText type="link" themeColor="textSecondary">
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </ThemedText>
            </Pressable>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.alertPanel}>
              <ThemedView type="backgroundElement" style={styles.alertText}>
                <ThemedText type="smallBold">Absence alerts</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Get a phone notification when school posts a child update.
                </ThemedText>
                {pushStatus ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {pushStatus}
                  </ThemedText>
                ) : null}
              </ThemedView>
              <Pressable
                accessibilityRole="button"
                disabled={pushBusy}
                onPress={() => void enablePushAlerts()}>
                <ThemedText type="link" themeColor="textSecondary">
                  {pushBusy ? 'Enabling...' : 'Enable'}
                </ThemedText>
              </Pressable>
            </ThemedView>

            {cards.map(({ child, fees, history }) => (
            <ChildStatusCard key={child.id} child={child} fees={fees} history={history} />
          ))}
        </ThemedView>
      ) : null}
    </ScreenShell>
  );
}

function ClaimChildPanel({
  code,
  phone,
  error,
  message,
  submitting,
  onCodeChange,
  onPhoneChange,
  onSubmit,
}: {
  code: string;
  phone: string;
  error: string | null;
  message: string | null;
  submitting: boolean;
  onCodeChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const theme = useTheme();
  const disabled = submitting || !code.trim() || !phone.trim();

  return (
    <ThemedView type="backgroundElement" style={styles.claimPanel}>
      <ThemedView type="backgroundElement" style={styles.claimHeader}>
        <ThemedText type="subtitle">Link your child</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Enter the code from your school and the parent phone on the school record.
        </ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.fieldGroup}>
        <ThemedText type="smallBold">School code</ThemedText>
        <TextInput
          accessibilityLabel="School claim code"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!submitting}
          placeholder="CM-SCHOOL123-7"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            {
              borderColor: theme.backgroundSelected,
              color: theme.text,
              backgroundColor: theme.backgroundSelected,
            },
          ]}
          value={code}
          onChangeText={onCodeChange}
        />
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.fieldGroup}>
        <ThemedText type="smallBold">Parent phone</ThemedText>
        <TextInput
          accessibilityLabel="Parent phone number"
          editable={!submitting}
          keyboardType="phone-pad"
          placeholder="school phone"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            {
              borderColor: theme.backgroundSelected,
              color: theme.text,
              backgroundColor: theme.backgroundSelected,
            },
          ]}
          value={phone}
          onChangeText={onPhoneChange}
        />
      </ThemedView>

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
      {message ? (
        <ThemedText type="small" style={{ color: theme.success }}>
          {message}
        </ThemedText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => void onSubmit()}>
        <ThemedView
          style={[
            styles.primaryButton,
            { backgroundColor: disabled ? theme.backgroundSelected : theme.accent },
          ]}>
          <ThemedText type="smallBold" style={{ color: disabled ? theme.textSecondary : theme.onAccent }}>
            {submitting ? 'Linking...' : 'Link child'}
          </ThemedText>
        </ThemedView>
      </Pressable>
    </ThemedView>
  );
}

function ChildStatusCard({ child, fees, history }: ChildCard) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const status = child.today.status ?? null;
  const monthly = historyMonthlyPercent(child.today.date, child.today.status ?? null, history);
  const statusColor =
    status === 'present'
      ? theme.success
      : status === 'absent'
        ? theme.danger
        : status === 'late' || status === 'excused'
          ? theme.warning
          : theme.pending;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${child.name}, ${statusLabel(status)}. ${expanded ? 'Hide' : 'Show'} details.`}
        onPress={() => setExpanded((value) => !value)}>
        <ThemedView type="backgroundElement" style={styles.cardHeader}>
          <ThemedView type="backgroundElement" style={styles.nameBlock}>
            <ThemedText type="subtitle" style={styles.childName}>
              {child.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {child.className ?? 'Class not set'}
            </ThemedText>
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.statusBlock}>
            <ThemedText type="smallBold" style={{ color: statusColor }}>
              {statusLabel(status)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {expanded ? 'Hide' : 'Details'}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </Pressable>

      <ThemedView type="backgroundSelected" style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          Attendance
        </ThemedText>
        <ThemedText type="smallBold">{attendanceCopy(status, child.today.markedAt ?? null)}</ThemedText>
      </ThemedView>

      <ThemedView type="backgroundSelected" style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          Fees
        </ThemedText>
        <ThemedText type="smallBold">
          {fees ? feeCopy(fees) : 'Could not load dues'}
        </ThemedText>
      </ThemedView>

      <ThemedView type="backgroundSelected" style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          This month
        </ThemedText>
        <ThemedText type="smallBold">
          {monthly === null ? 'Not enough marks yet' : `${monthly}% present`}
        </ThemedText>
      </ThemedView>

      {expanded ? <ChildDetails history={history} fees={fees} /> : null}
    </ThemedView>
  );
}

function ChildDetails({
  history,
  fees,
}: {
  history: ParentAttendanceHistoryRow[] | null;
  fees: ParentChildFeeSummary | null;
}) {
  return (
    <ThemedView style={styles.details}>
      <ThemedText type="smallBold">Recent attendance</ThemedText>
      {history === null ? (
        <ThemedText type="small" themeColor="textSecondary">
          Could not load history.
        </ThemedText>
      ) : history.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No attendance history yet.
        </ThemedText>
      ) : (
        history.slice(0, 6).map((row) => <HistoryRow key={`${row.date}-${row.status}`} row={row} />)
      )}

      <ThemedText type="smallBold">Fee detail</ThemedText>
      {fees === null ? (
        <ThemedText type="small" themeColor="textSecondary">
          Could not load fee detail.
        </ThemedText>
      ) : fees.fees.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No fee entries yet.
        </ThemedText>
      ) : (
        fees.fees.slice(0, 4).map((fee) => (
          <ThemedView type="backgroundSelected" style={styles.detailRow} key={fee.id}>
            <ThemedText type="small">{fee.description}</ThemedText>
            <ThemedText type="smallBold">
              {formatMoney(fee.amountCents, fee.currency)} · {fee.status}
            </ThemedText>
          </ThemedView>
        ))
      )}
    </ThemedView>
  );
}

function HistoryRow({ row }: { row: ParentAttendanceHistoryRow }) {
  const theme = useTheme();
  const color =
    row.status === 'present'
      ? theme.success
      : row.status === 'absent'
        ? theme.danger
        : theme.warning;
  return (
    <ThemedView type="backgroundSelected" style={styles.detailRow}>
      <ThemedText type="small">{row.date}</ThemedText>
      <ThemedText type="smallBold" style={{ color }}>
        {statusLabel(row.status)}
      </ThemedText>
    </ThemedView>
  );
}

function statusLabel(status: AttendanceStatus | null): string {
  if (!status) return 'Not marked';
  return status[0].toUpperCase() + status.slice(1);
}

function attendanceCopy(status: AttendanceStatus | null, markedAt: string | null): string {
  if (!status) return 'School has not marked this child yet';
  if (!markedAt) return statusLabel(status);
  const time = new Date(markedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${statusLabel(status)} at ${time}`;
}

function feeCopy(fees: ParentChildFeeSummary): string {
  if (fees.pendingCount === 0) return 'No pending dues';
  const amount = formatMoney(fees.pendingCents, fees.fees[0]?.currency ?? 'INR');
  return `${amount} pending across ${fees.pendingCount} ${fees.pendingCount === 1 ? 'fee' : 'fees'}`;
}

function historyMonthlyPercent(
  today: string,
  todayStatus: AttendanceStatus | null,
  history: ParentAttendanceHistoryRow[] | null
): number | null {
  if (!history) return null;
  const { from, to } = currentMonthRange(today);
  const byDate = new Map(history.map((row) => [row.date, row.status]));
  if (todayStatus) byDate.set(today, todayStatus);
  const monthRows = [...byDate.entries()].filter(([date]) => date >= from && date <= to);
  if (monthRows.length === 0) return null;
  const presentish = monthRows.filter(([, status]) => status === 'present' || status === 'late').length;
  return Math.round((presentish / monthRows.length) * 100);
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  banner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  claimPanel: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  claimHeader: {
    gap: Spacing.one,
  },
  fieldGroup: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertPanel: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  alertText: {
    flex: 1,
    gap: Spacing.half,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  nameBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  childName: {
    fontSize: 24,
    lineHeight: 30,
  },
  statusBlock: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  details: {
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  detailRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
});
