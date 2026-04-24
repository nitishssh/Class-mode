import type { PluginLogger } from "../index.js";
export type MigrationRootKind = "workspace" | "agentDir" | "skillsExtraDir";
export interface MigrationRootBinding {
    configPath: string;
}
export interface MigrationExternalRoot {
    id: string;
    kind: MigrationRootKind;
    label: string;
    sourcePath: string;
    snapshotRelativePath: string;
    sandboxPath: string;
    symlinkPaths: string[];
    bindings: MigrationRootBinding[];
}
export interface HostOpenClawState {
    exists: boolean;
    homeDir: string | null;
    stateDir: string | null;
    configDir: string | null;
    configPath: string | null;
    workspaceDir: string | null;
    extensionsDir: string | null;
    skillsDir: string | null;
    hooksDir: string | null;
    externalRoots: MigrationExternalRoot[];
    warnings: string[];
    errors: string[];
    hasExternalConfig: boolean;
}
export interface SnapshotManifest {
    version: number;
    createdAt: string;
    homeDir: string;
    stateDir: string;
    configPath: string | null;
    hasExternalConfig: boolean;
    externalRoots: MigrationExternalRoot[];
    warnings: string[];
}
export interface SnapshotBundle {
    snapshotDir: string;
    snapshotPath: string;
    preparedStateDir: string;
    archivesDir: string;
    manifest: SnapshotManifest;
    temporary: boolean;
}
export declare function detectHostOpenClaw(env?: NodeJS.ProcessEnv): HostOpenClawState;
export declare function createSnapshotBundle(hostState: HostOpenClawState, logger: PluginLogger, options: {
    persist: boolean;
}): SnapshotBundle | null;
export declare function cleanupSnapshotBundle(bundle: SnapshotBundle): void;
export declare function createArchiveFromDirectory(sourceDir: string, archivePath: string): Promise<void>;
export declare function loadSnapshotManifest(snapshotDir: string): SnapshotManifest;
export declare function restoreSnapshotToHost(snapshotDir: string, logger: PluginLogger): boolean;
//# sourceMappingURL=migration-state.d.ts.map