import type { PluginLogger, NemoClawConfig } from "../index.js";
export { detectHostOpenClaw, type HostOpenClawState } from "./migration-state.js";
export interface MigrateOptions {
    dryRun: boolean;
    profile: string;
    skipBackup: boolean;
    logger: PluginLogger;
    pluginConfig: NemoClawConfig;
}
export declare function cliMigrate(opts: MigrateOptions): Promise<void>;
//# sourceMappingURL=migrate.d.ts.map