import type { PluginLogger, NemoClawConfig } from "../index.js";
export interface StatusOptions {
    json: boolean;
    logger: PluginLogger;
    pluginConfig: NemoClawConfig;
}
export declare function cliStatus(opts: StatusOptions): Promise<void>;
//# sourceMappingURL=status.d.ts.map