"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchBlueprint = fetchBlueprint;
exports.resolveLatestVersion = resolveLatestVersion;
exports.downloadAndCache = downloadAndCache;
const resolve_js_1 = require("./resolve.js");
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
function fetchBlueprint(registry, version) {
    return Promise.reject(new Error(`Blueprint fetch not yet implemented. ` +
        `Registry: ${registry}, Version: ${version}. ` +
        `Place blueprint files in ${(0, resolve_js_1.getCacheDir)()}/<version>/ for local development.`));
}
/**
 * Resolve a "latest" version tag to a concrete version string by querying
 * the registry's tag list or release API.
 */
async function resolveLatestVersion(registry) {
    // Future: query OCI tag list or GitHub releases API
    void registry;
    throw new Error("Latest version resolution not yet implemented.");
}
/**
 * Download and extract a blueprint tarball into the local cache directory.
 * Returns the local path where the blueprint was extracted.
 */
async function downloadAndCache(registry, version) {
    // Future: HTTP fetch + tar extract + manifest parse
    void registry;
    const localPath = (0, resolve_js_1.getCachedBlueprintPath)(version);
    const manifest = (0, resolve_js_1.readCachedManifest)(version);
    if (!manifest) {
        throw new Error(`Failed to read manifest after download for version ${version}`);
    }
    return { localPath, manifest };
}
//# sourceMappingURL=fetch.js.map