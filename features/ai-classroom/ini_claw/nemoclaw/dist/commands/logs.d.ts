import type { PluginLogger, NemoClawConfig } from "../index.js";
export interface LogsOptions {
    follow: boolean;
    lines: number;
    runId?: string;
    logger: PluginLogger;
    pluginConfig: NemoClawConfig;
}
export declare function cliLogs(opts: LogsOptions): Promise<void>;
//# sourceMappingURL=logs.d.ts.map