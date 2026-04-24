import type { BlueprintManifest } from "./resolve.js";
export interface VerificationResult {
    valid: boolean;
    expectedDigest: string;
    actualDigest: string;
    errors: string[];
}
export declare function verifyBlueprintDigest(blueprintPath: string, manifest: BlueprintManifest): VerificationResult;
export declare function checkCompatibility(manifest: BlueprintManifest, openshellVersion: string, openclawVersion: string): string[];
//# sourceMappingURL=verify.d.ts.map