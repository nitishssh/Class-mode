import type { NemoClawConfig } from "../index.js";
export interface BlueprintManifest {
    version: string;
    minOpenShellVersion: string;
    minOpenClawVersion: string;
    profiles: string[];
    digest: string;
}
export interface ResolvedBlueprint {
    version: string;
    localPath: string;
    manifest: BlueprintManifest;
    cached: boolean;
}
export declare function getCacheDir(): string;
export declare function getCachedBlueprintPath(version: string): string;
export declare function isCached(version: string): boolean;
export declare function readCachedManifest(version: string): BlueprintManifest | null;
export declare function resolveBlueprint(config: NemoClawConfig): Promise<ResolvedBlueprint>;
//# sourceMappingURL=resolve.d.ts.map