import type { PluginLogger } from "../index.js";
export type BlueprintAction = "plan" | "apply" | "status" | "rollback";
export interface BlueprintRunOptions {
    blueprintPath: string;
    action: BlueprintAction;
    profile: string;
    planPath?: string;
    runId?: string;
    jsonOutput?: boolean;
    dryRun?: boolean;
    endpointUrl?: string;
}
export interface BlueprintRunResult {
    success: boolean;
    runId: string;
    action: BlueprintAction;
    output: string;
    exitCode: number;
}
export declare function execBlueprint(options: BlueprintRunOptions, logger: PluginLogger): Promise<BlueprintRunResult>;
//# sourceMappingURL=exec.d.ts.map