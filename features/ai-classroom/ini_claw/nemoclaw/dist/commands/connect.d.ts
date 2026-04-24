import type { PluginLogger } from "../index.js";
export interface ConnectOptions {
    sandbox: string;
    logger: PluginLogger;
}
export declare function cliConnect(opts: ConnectOptions): Promise<void>;
//# sourceMappingURL=connect.d.ts.map