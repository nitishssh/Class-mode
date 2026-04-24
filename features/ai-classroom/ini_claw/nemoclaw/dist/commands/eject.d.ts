import type { PluginLogger, NemoClawConfig } from "../index.js";
export interface EjectOptions {
    runId?: string;
    confirm: boolean;
    logger: PluginLogger;
    pluginConfig: NemoClawConfig;
}
export declare function cliEject(opts: EjectOptions): Promise<void>;
//# sourceMappingURL=eject.d.ts.map