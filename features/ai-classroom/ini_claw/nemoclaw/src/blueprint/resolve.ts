// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { NemoClawConfig } from "../index.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchBlueprint } from "./fetch.js";

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

const CACHE_DIR = join(process.env.HOME ?? "/tmp", ".nemoclaw", "blueprints");

export function getCacheDir(): string {
  return CACHE_DIR;
}

export function getCachedBlueprintPath(version: string): string {
  return join(CACHE_DIR, version);
}

export function isCached(version: string): boolean {
  const manifestPath = join(getCachedBlueprintPath(version), "blueprint.yaml");
  return existsSync(manifestPath);
}

export function readCachedManifest(version: string): BlueprintManifest | null {
  const manifestPath = join(getCachedBlueprintPath(version), "blueprint.yaml");
  if (!existsSync(manifestPath)) return null;
  const raw = readFileSync(manifestPath, "utf-8");
  // Minimal YAML parsing for the manifest header
  return parseManifestHeader(raw);
}

function parseManifestHeader(raw: string): BlueprintManifest {
  const get = (key: string): string => {
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

export async function resolveBlueprint(config: NemoClawConfig): Promise<ResolvedBlueprint> {
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
  return fetchBlueprint(config.blueprintRegistry, version);
}

// fetchBlueprint is imported from ./fetch.ts
