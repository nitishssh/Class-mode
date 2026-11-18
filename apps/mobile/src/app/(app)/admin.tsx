import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ContractError, OfflineError } from '@/lib/api';
import { createFee, fetchFeeSummary, fetchFees, markFeePaid, remindFee } from '@/lib/fees';
import { useSessionUser } from '@/lib/session';
import type { StaffFee, StaffFeeSummary } from '@/shared/mobile-api';

const FEE_ADMIN_ROLES = new Set(['school_admin', 'principal', 'admin']);

type AdminState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; fees: StaffFee[]; summary: StaffFeeSummary };

type DraftFee = {
  studentId: string;
  description: string;
  amount: string;
  dueDate: string;
};

const emptyDraft: DraftFee = {
  studentId: '',
  description: '',
  amount: '',
  dueDate: '',
};

export default function AdminScreen() {
  const theme = useTheme();
  const { user, offline } = useSessionUser();
  const [state, setState] = useState<AdminState>({ kind: 'loading' });
  const [draft, setDraft] = useState<DraftFee>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const canManageFees = FEE_ADMIN_ROLES.has(user.role);
  const hasScope = Boolean(user.schoolCode) || user.role === 'admin';

  const load = useCallback(async () => {
    if (!canManageFees || !hasScope) return;
    setState({ kind: 'loading' });
    try {
      const [fees, summary] = await Promise.all([fetchFees(), fetchFeeSummary()]);
      setState({ kind: 'ready', fees, summary });
    } catch (err) {
      if (err instanceof OfflineError) {
        setState({ kind: 'error', message: "You're offline - reconnect to manage fees." });
      } else if (err instanceof ContractError) {
        setState({ kind: 'error', message: 'The app is out of date with the server. Please update.' });
      } else {
        setState({ kind: 'error', message: 'Could not load fees - tap to retry.' });
      }
    }
  }, [canManageFees, hasScope]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const submitFee = useCallback(async () => {
    const studentId = Number.parseInt(draft.studentId, 10);
    const amount = Number.parseFloat(draft.amount);
    const description = draft.description.trim();
    const dueDate = draft.dueDate.trim();

    if (!Number.isInteger(studentId) || studentId <= 0) {
      setFormError('Enter a valid student ID.');
      return;
    }
    if (!description) {
      setFormError('Enter a fee description.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError('Enter a valid amount.');
      return;
    }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setFormError('Due date must be YYYY-MM-DD.');
      return;
    }

    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      await createFee({
        studentId,
        description,
        amountCents: Math.round(amount * 100),
        currency: 'INR',
        dueDate: dueDate || undefined,
      });
      setDraft(emptyDraft);
      setNotice('Fee created.');
      await load();
    } catch {
      setFormError('Could not create fee. Check the student ID and try again.');
    } finally {
      setBusy(false);
    }
  }, [draft, load]);

  const settle = useCallback(
    async (fee: StaffFee) => {
      setBusy(true);
      setNotice(null);
      try {
        await markFeePaid(fee.id);
        setNotice(`${fee.studentName}'s fee marked paid.`);
        await load();
      } catch {
        setNotice('Could not mark fee paid.');
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const remind = useCallback(
    async (fee: StaffFee) => {
      const phone = fee.parentPhone?.trim();
      if (!phone) {
        setNotice('No parent phone on this fee.');
        return;
      }
      setBusy(true);
      setNotice(null);
      try {
        const res = await remindFee(fee.id, phone);
        setNotice(res.simulated ? 'Reminder simulated.' : 'Reminder sent.');
      } catch {
        setNotice('Could not send reminder.');
      } finally {
        setBusy(false);
      }
    },
    []
  );

  if (!canManageFees) {
    return (
      <ScreenShell>
        <PlaceholderPanel
          eyebrow="Admin"
          title="No admin tools for this role"
          body="Fee operations are available to school admins and principals."
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
          body="Fee operations need a school scope. Ask your admin to fix your account, then sign in again."
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ThemedView style={styles.header}>
        <ThemedView style={styles.headerRow}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {user.schoolCode ?? 'All schools'}
          </ThemedText>
          <Pressable accessibilityRole="button" onPress={() => void load()} disabled={busy}>
            <ThemedText type="link" themeColor="textSecondary">
              Refresh
            </ThemedText>
          </Pressable>
        </ThemedView>
        <ThemedText type="title">Fees</ThemedText>
        {offline ? (
          <ThemedText type="small" style={{ color: theme.warning }}>
            Offline - reconnect before creating fees or sending reminders.
          </ThemedText>
        ) : null}
      </ThemedView>

      {state.kind === 'loading' ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            Loading fees...
          </ThemedText>
        </ThemedView>
      ) : null}

      {state.kind === 'error' ? (
        <Pressable accessibilityRole="button" onPress={() => void load()}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" style={{ color: theme.danger }}>
              {state.message}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ) : null}

      {state.kind === 'ready' ? (
        <>
          <Summary summary={state.summary} />
          <CreateFeeCard
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            error={formError}
            onSubmit={submitFee}
          />
          {notice ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" style={{ color: theme.pending }}>
                {notice}
              </ThemedText>
            </ThemedView>
          ) : null}
          <FeeList fees={state.fees} busy={busy} onPaid={settle} onRemind={remind} />
        </>
      ) : null}
    </ScreenShell>
  );
}

function Summary({ summary }: { summary: StaffFeeSummary }) {
  return (
    <ThemedView style={styles.summaryGrid}>
      <SummaryTile label="Pending" value={formatMoney(summary.pendingCents, 'INR')} />
      <SummaryTile label="Paid" value={formatMoney(summary.paidCents, 'INR')} />
      <SummaryTile label="Open fees" value={String(summary.pendingCount)} />
    </ThemedView>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.summaryTile}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </ThemedView>
  );
}

function CreateFeeCard({
  draft,
  setDraft,
  busy,
  error,
  onSubmit,
}: {
  draft: DraftFee;
  setDraft: (next: DraftFee) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Create fee</ThemedText>
      <FeeInput
        label="Student ID"
        value={draft.studentId}
        onChangeText={(studentId) => setDraft({ ...draft, studentId })}
        keyboardType="number-pad"
      />
      <FeeInput
        label="Description"
        value={draft.description}
        onChangeText={(description) => setDraft({ ...draft, description })}
      />
      <FeeInput
        label="Amount INR"
        value={draft.amount}
        onChangeText={(amount) => setDraft({ ...draft, amount })}
        keyboardType="decimal-pad"
      />
      <FeeInput
        label="Due date"
        value={draft.dueDate}
        onChangeText={(dueDate) => setDraft({ ...draft, dueDate })}
        placeholder="YYYY-MM-DD"
      />
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onSubmit}
        disabled={busy}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: theme.accent },
          (pressed || busy) && styles.pressed,
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
          {busy ? 'Saving...' : 'Create fee'}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function FeeInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundSelected,
          },
        ]}
      />
    </ThemedView>
  );
}

function FeeList({
  fees,
  busy,
  onPaid,
  onRemind,
}: {
  fees: StaffFee[];
  busy: boolean;
  onPaid: (fee: StaffFee) => void;
  onRemind: (fee: StaffFee) => void;
}) {
  if (fees.length === 0) {
    return (
      <PlaceholderPanel
        eyebrow="Fees"
        title="No fee entries yet"
        body="Create the first fee once students are loaded for this school."
      />
    );
  }

  return (
    <ThemedView style={styles.list}>
      {fees.map((fee) => (
        <FeeRow key={fee.id} fee={fee} busy={busy} onPaid={onPaid} onRemind={onRemind} />
      ))}
    </ThemedView>
  );
}

function FeeRow({
  fee,
  busy,
  onPaid,
  onRemind,
}: {
  fee: StaffFee;
  busy: boolean;
  onPaid: (fee: StaffFee) => void;
  onRemind: (fee: StaffFee) => void;
}) {
  const theme = useTheme();
  const pending = fee.status === 'pending';
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedView style={styles.rowHeader}>
        <ThemedView style={styles.flex}>
          <ThemedText type="smallBold">{fee.studentName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {fee.description}
            {fee.dueDate ? ` - due ${String(fee.dueDate).slice(0, 10)}` : ''}
          </ThemedText>
        </ThemedView>
        <ThemedText type="smallBold" style={{ color: pending ? theme.warning : theme.success }}>
          {fee.status}
        </ThemedText>
      </ThemedView>
      <ThemedText type="subtitle" style={styles.amount}>
        {formatMoney(fee.amountCents, fee.currency)}
      </ThemedText>
      {pending ? (
        <ThemedView style={styles.actionRow}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => onPaid(fee)}>
            <ThemedText type="link">Mark paid</ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => onRemind(fee)}>
            <ThemedText type="link" themeColor="textSecondary">
              Remind
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}
    </ThemedView>
  );
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  summaryTile: {
    flex: 1,
    minHeight: 76,
    justifyContent: 'space-between',
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
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
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  amount: {
    fontSize: 28,
    lineHeight: 34,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.four,
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.75,
  },
});
