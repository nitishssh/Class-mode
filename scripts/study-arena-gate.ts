export interface StudyArenaGateInput {
  pilotStartedAt?: string | null;
  pilotEndsAt?: string | null;
  unassistedStudentsCompleted?: number | null;
  costPerCompletedLessonInr?: number | null;
  costRowsMissing?: number | null;
  teacherReviewed: boolean;
}

export function renderStudyArenaGate(input: StudyArenaGateInput): string {
  const count = input.unassistedStudentsCompleted;
  if (!input.pilotStartedAt || !input.pilotEndsAt || count == null) {
    return "> Study Arena: adoption gate NOT ARMED — set STUDY_ARENA_PILOT_ENABLED_AT to the pilot flag-enable timestamp. No 30-day result will be inferred from weekly snapshots.";
  }
  if (count < 5) {
    return `> Study Arena WATCH: ${count} distinct students completed a full lesson unassisted in the fixed pilot window (${input.pilotStartedAt} → ${input.pilotEndsAt}); gate wants ≥5. Below bar at window close → mothball behind the flag.`;
  }

  const cost = input.costPerCompletedLessonInr;
  const costReady = cost != null && (input.costRowsMissing ?? 0) === 0;
  if (!costReady || cost >= 2) {
    const reason = costReady
      ? `estimated cost/completed lesson is ₹${cost.toFixed(2)} (must be <₹2)`
      : `cost is UNKNOWN because ${input.costRowsMissing ?? 0} usage rows are missing or lack configured estimates`;
    return `> Study Arena: student threshold reached — ${count} distinct students completed unassisted. Final gate is PENDING: ${reason}, and a teacher must review the signal.`;
  }
  if (!input.teacherReviewed) {
    return `> Study Arena: student and cost thresholds reached — ${count} distinct students completed unassisted; estimated cost/completed lesson ₹${cost.toFixed(2)}. Final gate is PENDING until a teacher reviews the signal and STUDY_ARENA_SIGNAL_REVIEWED=true is recorded.`;
  }
  return `> Study Arena adoption gate MET — ${count} distinct students completed unassisted, estimated cost/completed lesson ₹${cost.toFixed(2)}, and teacher review is recorded.`;
}
