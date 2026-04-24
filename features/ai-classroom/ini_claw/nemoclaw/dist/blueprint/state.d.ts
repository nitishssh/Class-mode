export interface NemoClawState {
    lastRunId: string | null;
    lastAction: string | null;
    blueprintVersion: string | null;
    sandboxName: string | null;
    migrationSnapshot: string | null;
    hostBackupPath: string | null;
    createdAt: string | null;
    updatedAt: string;
}
export declare function loadState(): NemoClawState;
export declare function saveState(state: NemoClawState): void;
export declare function clearState(): void;
//# sourceMappingURL=state.d.ts.map