import type { PluginLogger, NemoClawConfig } from "../index.js";
export interface LaunchOptions {
    force: boolean;
    profile: string;
    logger: PluginLogger;
    pluginConfig: NemoClawConfig;
}
export declare function cliLaunch(opts: LaunchOptions): Promise<void>;
//# sourceMappingURL=launch.d.ts.map