"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheDir = getCacheDir;
exports.getCachedBlueprintPath = getCachedBlueprintPath;
exports.isCached = isCached;
exports.readCachedManifest = readCachedManifest;
exports.resolveBlueprint = resolveBlueprint;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const fetch_js_1 = require("./fetch.js");
const CACHE_DIR = (0, node_path_1.join)(process.env.HOME ?? "/tmp", ".nemoclaw", "blueprints");
function getCacheDir() {
    return CACHE_DIR;
}
function getCachedBlueprintPath(version) {
    return (0, node_path_1.join)(CACHE_DIR, version);
}
function isCached(version) {
    const manifestPath = (0, node_path_1.join)(getCachedBlueprintPath(version), "blueprint.yaml");
    return (0, node_fs_1.existsSync)(manifestPath);
}
function readCachedManifest(version) {
    const manifestPath = (0, node_path_1.join)(getCachedBlueprintPath(version), "blueprint.yaml");
    if (!(0, node_fs_1.existsSync)(manifestPath))
        return null;
    const raw = (0, node_fs_1.readFileSync)(manifestPath, "utf-8");
    // Minimal YAML parsing for the manifest header
    return parseManifestHeader(raw);
}
function parseManifestHeader(raw) {
    const get = (key) => {
        const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
        return match?.[1]?.trim() ?? "";
    };
    const profiles = get("profiles");
    return {
        version: get("version"),
        minOpenShellVersion: get("min_openshell_version"),
        minOpenClawVersion: get("min_openclaw_version"),
        profiles: profiles ? profiles.split(",").map((p) => p.trim()) : ["default"],
        digest: get("digest"),
    };
}
async function resolveBlueprint(config) {
    const version = config.blueprintVersion;
    // Check local cache first
    if (version !== "latest" && isCached(version)) {
        const manifest = readCachedManifest(version);
        if (manifest) {
            return {
                version,
                localPath: getCachedBlueprintPath(version),
                manifest,
                cached: true,
            };
        }
    }
    // Fetch from registry
    return (0, fetch_js_1.fetchBlueprint)(config.blueprintRegistry, version);
}
// fetchBlueprint is imported from ./fetch.ts
//# sourceMappingURL=resolve.js.map