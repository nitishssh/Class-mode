/**
 * Blueprint artifact fetching — download versioned blueprint archives from
 * an OCI registry or GitHub release, extract to local cache.
 */
import type { BlueprintManifest, ResolvedBlueprint } from "./resolve.js";
/**
 * Fetch a blueprint artifact from a remote registry and cache it locally.
 *
 * Intended flow:
 *   1. Resolve "latest" to a concrete version tag via registry API
 *   2. Download the blueprint tarball from the OCI registry or GitHub release
 *   3. Verify digest (SHA-256) against the registry manifest
 *   4. Check compatibility metadata (min OpenShell/OpenClaw versions)
 *   5. Extract to local cache dir
 *   6. Return resolved blueprint
 *
 * For now, blueprints must be placed manually in the cache directory.
 */
export declare function fetchBlueprint(registry: string, version: string): Promise<ResolvedBlueprint>;
/**
 * Resolve a "latest" version tag to a concrete version string by querying
 * the registry's tag list or release API.
 */
export declare function resolveLatestVersion(registry: string): Promise<string>;
/**
 * Download and extract a blueprint tarball into the local cache directory.
 * Returns the local path where the blueprint was extracted.
 */
export declare function downloadAndCache(registry: string, version: string): Promise<{
    localPath: string;
    manifest: BlueprintManifest;
}>;
//# sourceMappingURL=fetch.d.ts.map