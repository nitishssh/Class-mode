"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectHostOpenClaw = detectHostOpenClaw;
exports.createSnapshotBundle = createSnapshotBundle;
exports.cleanupSnapshotBundle = cleanupSnapshotBundle;
exports.createArchiveFromDirectory = createArchiveFromDirectory;
exports.loadSnapshotManifest = loadSnapshotManifest;
exports.restoreSnapshotToHost = restoreSnapshotToHost;
const node_fs_1 = require("node:fs");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const tar_1 = require("tar");
const json5_1 = __importDefault(require("json5"));
const SANDBOX_MIGRATION_DIR = "/sandbox/.nemoclaw/migration";
const SNAPSHOT_VERSION = 2;
function resolveHostHome(env = process.env) {
    const fallbackHome = env.HOME?.trim() || env.USERPROFILE?.trim() || node_os_1.default.homedir();
    const explicitHome = env.OPENCLAW_HOME?.trim();
    if (explicitHome) {
        if (explicitHome === "~") {
            return fallbackHome;
        }
        if (explicitHome.startsWith("~/") || explicitHome.startsWith("~\\")) {
            return node_path_1.default.join(fallbackHome, explicitHome.slice(2));
        }
        return node_path_1.default.resolve(explicitHome);
    }
    return fallbackHome;
}
function resolveUserPath(input, env = process.env) {
    if (input === "~") {
        return resolveHostHome(env);
    }
    if (input.startsWith("~/") || input.startsWith("~\\")) {
        return node_path_1.default.join(resolveHostHome(env), input.slice(2));
    }
    return node_path_1.default.resolve(input);
}
function normalizeHostPath(input) {
    const resolved = node_path_1.default.resolve(input);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
function isWithinRoot(candidatePath, rootPath) {
    const candidate = normalizeHostPath(candidatePath);
    const root = normalizeHostPath(rootPath);
    const relative = node_path_1.default.relative(root, candidate);
    return relative === "" || (!relative.startsWith("..") && !node_path_1.default.isAbsolute(relative));
}
function resolveStateDir(env = process.env) {
    const override = env.OPENCLAW_STATE_DIR?.trim();
    if (override) {
        return resolveUserPath(override, env);
    }
    return node_path_1.default.join(resolveHostHome(env), ".openclaw");
}
function resolveConfigPath(stateDir, env = process.env) {
    const override = env.OPENCLAW_CONFIG_PATH?.trim();
    if (override) {
        return resolveUserPath(override, env);
    }
    return node_path_1.default.join(stateDir, "openclaw.json");
}
function loadConfigDocument(configPath) {
    if (!(0, node_fs_1.existsSync)(configPath)) {
        return null;
    }
    const raw = (0, node_fs_1.readFileSync)(configPath, "utf-8");
    const parsed = json5_1.default.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`Config at ${configPath} is not a JSON object.`);
    }
    return parsed;
}
function collectSymlinkPaths(rootPath) {
    const symlinks = [];
    function walk(currentPath, relativePath) {
        const stat = (0, node_fs_1.lstatSync)(currentPath);
        if (stat.isSymbolicLink()) {
            symlinks.push(relativePath || ".");
            return;
        }
        if (!stat.isDirectory()) {
            return;
        }
        for (const entry of (0, node_fs_1.readdirSync)(currentPath)) {
            const nextPath = node_path_1.default.join(currentPath, entry);
            const nextRelative = relativePath ? node_path_1.default.join(relativePath, entry) : entry;
            walk(nextPath, nextRelative);
        }
    }
    walk(rootPath, "");
    return symlinks.sort();
}
function slugify(input) {
    const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug || "root";
}
function registerRoot(rootMap, params) {
    const resolvedPath = resolveUserPath(params.pathValue);
    const normalized = normalizeHostPath(resolvedPath);
    const existing = rootMap.get(normalized);
    if (existing) {
        existing.bindings.push({ configPath: params.bindingPath });
        return;
    }
    const id = `${params.sandboxGroup}-${slugify(params.label)}`;
    rootMap.set(normalized, {
        id,
        kind: params.kind,
        label: params.label,
        sourcePath: resolvedPath,
        sandboxPath: node_path_1.default.posix.join(SANDBOX_MIGRATION_DIR, params.sandboxGroup, id),
        bindings: [{ configPath: params.bindingPath }],
        required: params.required,
    });
}
function defaultWorkspacePath(env = process.env) {
    const home = resolveHostHome(env);
    const profile = env.OPENCLAW_PROFILE?.trim();
    if (profile && profile.toLowerCase() !== "default") {
        return node_path_1.default.join(home, ".openclaw", `workspace-${profile}`);
    }
    return node_path_1.default.join(home, ".openclaw", "workspace");
}
function collectExternalRoots(config, stateDir) {
    const warnings = [];
    const errors = [];
    const rootMap = new Map();
    const agents = config?.["agents"];
    const agentDefaults = agents && typeof agents === "object" && !Array.isArray(agents)
        ? agents["defaults"]
        : undefined;
    const agentList = agents && typeof agents === "object" && !Array.isArray(agents)
        ? agents["list"]
        : undefined;
    const skills = config?.["skills"];
    const skillLoad = skills && typeof skills === "object" && !Array.isArray(skills)
        ? skills["load"]
        : undefined;
    const defaultsWorkspace = agentDefaults && typeof agentDefaults === "object" && !Array.isArray(agentDefaults)
        ? agentDefaults["workspace"]
        : undefined;
    const defaultWorkspace = typeof defaultsWorkspace === "string" && defaultsWorkspace.trim()
        ? defaultsWorkspace.trim()
        : defaultWorkspacePath();
    registerRoot(rootMap, {
        pathValue: defaultWorkspace,
        kind: "workspace",
        label: "default-workspace",
        bindingPath: "agents.defaults.workspace",
        sandboxGroup: "workspaces",
        required: typeof defaultsWorkspace === "string" && defaultsWorkspace.trim().length > 0,
    });
    if (Array.isArray(agentList)) {
        agentList.forEach((entry, index) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
                return;
            }
            const agent = entry;
            const agentId = typeof agent["id"] === "string" && agent["id"].trim()
                ? agent["id"].trim()
                : `agent-${String(index)}`;
            if (typeof agent["workspace"] === "string" && agent["workspace"].trim()) {
                registerRoot(rootMap, {
                    pathValue: agent["workspace"].trim(),
                    kind: "workspace",
                    label: `${agentId}-workspace`,
                    bindingPath: `agents.list[${String(index)}].workspace`,
                    sandboxGroup: "workspaces",
                    required: true,
                });
            }
            if (typeof agent["agentDir"] === "string" && agent["agentDir"].trim()) {
                registerRoot(rootMap, {
                    pathValue: agent["agentDir"].trim(),
                    kind: "agentDir",
                    label: `${agentId}-agent-dir`,
                    bindingPath: `agents.list[${String(index)}].agentDir`,
                    sandboxGroup: "agent-dirs",
                    required: true,
                });
            }
        });
    }
    const extraDirs = skillLoad && typeof skillLoad === "object" && !Array.isArray(skillLoad)
        ? skillLoad["extraDirs"]
        : undefined;
    if (Array.isArray(extraDirs)) {
        extraDirs.forEach((entry, index) => {
            if (typeof entry !== "string" || !entry.trim()) {
                return;
            }
            registerRoot(rootMap, {
                pathValue: entry.trim(),
                kind: "skillsExtraDir",
                label: `skills-extra-${String(index + 1)}`,
                bindingPath: `skills.load.extraDirs[${String(index)}]`,
                sandboxGroup: "skills",
                required: true,
            });
        });
    }
    const roots = [...rootMap.values()]
        .filter((root) => !isWithinRoot(root.sourcePath, stateDir))
        .map((root) => ({
        id: root.id,
        kind: root.kind,
        label: root.label,
        sourcePath: root.sourcePath,
        snapshotRelativePath: node_path_1.default.join("external", root.id),
        sandboxPath: root.sandboxPath,
        symlinkPaths: [],
        bindings: root.bindings,
    }));
    const validRoots = [];
    for (const root of roots) {
        if (!(0, node_fs_1.existsSync)(root.sourcePath)) {
            const message = `${root.kind} path is missing: ${root.sourcePath} (${root.bindings
                .map((binding) => binding.configPath)
                .join(", ")})`;
            if (rootMap.get(normalizeHostPath(root.sourcePath))?.required) {
                errors.push(`Configured ${message}`);
            }
            else {
                warnings.push(`Skipping absent optional ${message}`);
            }
            continue;
        }
        try {
            const stat = (0, node_fs_1.lstatSync)(root.sourcePath);
            if (!stat.isDirectory()) {
                errors.push(`${root.kind} path is not a directory: ${root.sourcePath} (${root.bindings
                    .map((binding) => binding.configPath)
                    .join(", ")})`);
                continue;
            }
            root.symlinkPaths = collectSymlinkPaths(root.sourcePath);
            if (root.symlinkPaths.length > 0) {
                warnings.push(`Preserving ${String(root.symlinkPaths.length)} symlink(s) under ${root.sourcePath} during migration.`);
            }
            validRoots.push(root);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Failed to inspect ${root.sourcePath}: ${msg}`);
        }
    }
    return { roots: validRoots, warnings, errors };
}
function detectHostOpenClaw(env = process.env) {
    const homeDir = resolveHostHome(env);
    const stateDir = resolveStateDir(env);
    const configPath = resolveConfigPath(stateDir, env);
    const stateExists = (0, node_fs_1.existsSync)(stateDir);
    const configExists = (0, node_fs_1.existsSync)(configPath);
    if (!stateExists && !configExists) {
        return {
            exists: false,
            homeDir,
            stateDir: null,
            configDir: null,
            configPath: null,
            workspaceDir: null,
            extensionsDir: null,
            skillsDir: null,
            hooksDir: null,
            externalRoots: [],
            warnings: [],
            errors: [],
            hasExternalConfig: false,
        };
    }
    const errors = [];
    const warnings = [];
    let config = null;
    if (!stateExists) {
        errors.push(`Resolved OpenClaw state directory does not exist: ${stateDir}`);
    }
    try {
        config = loadConfigDocument(configPath);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to parse OpenClaw config at ${configPath}: ${msg}`);
    }
    const rootInfo = collectExternalRoots(config, stateDir);
    warnings.push(...rootInfo.warnings);
    errors.push(...rootInfo.errors);
    const workspaceDir = config &&
        typeof config["agents"] === "object" &&
        config["agents"] &&
        !Array.isArray(config["agents"]) &&
        typeof config["agents"]["defaults"]?.["workspace"] === "string"
        ? resolveUserPath(config["agents"]["defaults"]["workspace"].trim(), env)
        : defaultWorkspacePath(env);
    const extensionsDir = (0, node_fs_1.existsSync)(node_path_1.default.join(stateDir, "extensions"))
        ? node_path_1.default.join(stateDir, "extensions")
        : null;
    const skillsDir = (0, node_fs_1.existsSync)(node_path_1.default.join(stateDir, "skills")) ? node_path_1.default.join(stateDir, "skills") : null;
    const hooksDir = (0, node_fs_1.existsSync)(node_path_1.default.join(stateDir, "hooks")) ? node_path_1.default.join(stateDir, "hooks") : null;
    if ((0, node_fs_1.existsSync)(workspaceDir)) {
        try {
            const symlinkPaths = collectSymlinkPaths(workspaceDir);
            if (symlinkPaths.length > 0) {
                warnings.push(`Primary workspace contains ${String(symlinkPaths.length)} symlink(s): ${workspaceDir}.`);
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            warnings.push(`Failed to inspect workspace symlinks at ${workspaceDir}: ${msg}`);
        }
    }
    return {
        exists: true,
        homeDir,
        stateDir,
        configDir: stateDir,
        configPath: configExists ? configPath : null,
        workspaceDir: (0, node_fs_1.existsSync)(workspaceDir) ? workspaceDir : null,
        extensionsDir,
        skillsDir,
        hooksDir,
        externalRoots: rootInfo.roots,
        warnings,
        errors,
        hasExternalConfig: configExists && !isWithinRoot(configPath, stateDir),
    };
}
function copyDirectory(sourcePath, destinationPath) {
    (0, node_fs_1.cpSync)(sourcePath, destinationPath, {
        recursive: true,
    });
}
function writeSnapshotManifest(snapshotDir, manifest) {
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(snapshotDir, "snapshot.json"), JSON.stringify(manifest, null, 2));
}
function readSnapshotManifest(snapshotDir) {
    return JSON.parse((0, node_fs_1.readFileSync)(node_path_1.default.join(snapshotDir, "snapshot.json"), "utf-8"));
}
function resolveConfigSourcePath(manifest, snapshotDir) {
    if (manifest.hasExternalConfig) {
        return node_path_1.default.join(snapshotDir, "config", "openclaw.json");
    }
    return node_path_1.default.join(snapshotDir, "openclaw", "openclaw.json");
}
function setConfigValue(document, configPath, value) {
    const tokens = configPath.match(/[^.[\]]+/g);
    if (!tokens || tokens.length === 0) {
        throw new Error(`Invalid config path: ${configPath}`);
    }
    let current = document;
    for (let index = 0; index < tokens.length - 1; index += 1) {
        const token = tokens[index];
        const nextToken = tokens[index + 1];
        if (!token || !nextToken) {
            throw new Error(`Invalid config path segment in ${configPath}`);
        }
        const isArrayIndex = /^\d+$/.test(token);
        if (isArrayIndex) {
            const array = current;
            const entry = array[Number.parseInt(token, 10)];
            if (entry == null) {
                array[Number.parseInt(token, 10)] = /^\d+$/.test(nextToken) ? [] : {};
            }
            current = array[Number.parseInt(token, 10)];
            continue;
        }
        const record = current;
        if (!record[token] || typeof record[token] !== "object") {
            record[token] = /^\d+$/.test(nextToken) ? [] : {};
        }
        current = record[token];
    }
    const finalToken = tokens[tokens.length - 1];
    if (!finalToken) {
        throw new Error(`Missing final config path segment in ${configPath}`);
    }
    if (/^\d+$/.test(finalToken)) {
        const array = current;
        array[Number.parseInt(finalToken, 10)] = value;
        return;
    }
    current[finalToken] = value;
}
function prepareSandboxState(snapshotDir, manifest) {
    const preparedStateDir = node_path_1.default.join(snapshotDir, "sandbox-bundle", "openclaw");
    (0, node_fs_1.rmSync)(preparedStateDir, { recursive: true, force: true });
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(preparedStateDir), { recursive: true });
    copyDirectory(node_path_1.default.join(snapshotDir, "openclaw"), preparedStateDir);
    const configSourcePath = resolveConfigSourcePath(manifest, snapshotDir);
    const config = (0, node_fs_1.existsSync)(configSourcePath) ? loadConfigDocument(configSourcePath) ?? {} : {};
    for (const root of manifest.externalRoots) {
        for (const binding of root.bindings) {
            setConfigValue(config, binding.configPath, root.sandboxPath);
        }
    }
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(preparedStateDir, "openclaw.json"), JSON.stringify(config, null, 2));
    return preparedStateDir;
}
function createSnapshotBundle(hostState, logger, options) {
    if (!hostState.stateDir || !hostState.homeDir) {
        logger.error("Cannot snapshot host OpenClaw state: no state directory was resolved.");
        return null;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const parentDir = node_path_1.default.join(hostState.homeDir, ".nemoclaw", options.persist ? "snapshots" : "staging", timestamp);
    try {
        (0, node_fs_1.mkdirSync)(parentDir, { recursive: true });
        const snapshotStateDir = node_path_1.default.join(parentDir, "openclaw");
        copyDirectory(hostState.stateDir, snapshotStateDir);
        if (hostState.configPath && hostState.hasExternalConfig) {
            const configSnapshotDir = node_path_1.default.join(parentDir, "config");
            (0, node_fs_1.mkdirSync)(configSnapshotDir, { recursive: true });
            (0, node_fs_1.copyFileSync)(hostState.configPath, node_path_1.default.join(configSnapshotDir, "openclaw.json"));
        }
        const externalRoots = [];
        for (const root of hostState.externalRoots) {
            const destination = node_path_1.default.join(parentDir, root.snapshotRelativePath);
            (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(destination), { recursive: true });
            copyDirectory(root.sourcePath, destination);
            externalRoots.push({
                ...root,
                symlinkPaths: collectSymlinkPaths(root.sourcePath),
            });
        }
        const manifest = {
            version: SNAPSHOT_VERSION,
            createdAt: new Date().toISOString(),
            homeDir: hostState.homeDir,
            stateDir: hostState.stateDir,
            configPath: hostState.configPath,
            hasExternalConfig: hostState.hasExternalConfig,
            externalRoots,
            warnings: hostState.warnings,
        };
        writeSnapshotManifest(parentDir, manifest);
        return {
            snapshotDir: parentDir,
            snapshotPath: node_path_1.default.join(parentDir, "snapshot.json"),
            preparedStateDir: prepareSandboxState(parentDir, manifest),
            archivesDir: node_path_1.default.join(parentDir, "sandbox-bundle", "archives"),
            manifest,
            temporary: !options.persist,
        };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Snapshot failed: ${msg}`);
        return null;
    }
}
function cleanupSnapshotBundle(bundle) {
    if (bundle.temporary) {
        (0, node_fs_1.rmSync)(bundle.snapshotDir, { recursive: true, force: true });
    }
}
async function createArchiveFromDirectory(sourceDir, archivePath) {
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(archivePath), { recursive: true });
    await (0, tar_1.create)({
        cwd: sourceDir,
        file: archivePath,
        portable: true,
        follow: false,
        noMtime: true,
    }, ["."]);
}
function loadSnapshotManifest(snapshotDir) {
    return readSnapshotManifest(snapshotDir);
}
function restoreSnapshotToHost(snapshotDir, logger) {
    const manifest = readSnapshotManifest(snapshotDir);
    const snapshotStateDir = node_path_1.default.join(snapshotDir, "openclaw");
    if (!(0, node_fs_1.existsSync)(snapshotStateDir)) {
        logger.error(`Snapshot directory not found: ${snapshotStateDir}`);
        return false;
    }
    try {
        if ((0, node_fs_1.existsSync)(manifest.stateDir)) {
            const archiveName = `${manifest.stateDir}.nemoclaw-archived-${String(Date.now())}`;
            (0, node_fs_1.renameSync)(manifest.stateDir, archiveName);
            logger.info(`Archived current state directory to ${archiveName}`);
        }
        (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(manifest.stateDir), { recursive: true });
        copyDirectory(snapshotStateDir, manifest.stateDir);
        if (manifest.hasExternalConfig && manifest.configPath) {
            const configSnapshotPath = node_path_1.default.join(snapshotDir, "config", "openclaw.json");
            (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(manifest.configPath), { recursive: true });
            (0, node_fs_1.copyFileSync)(configSnapshotPath, manifest.configPath);
            logger.info(`Restored external config to ${manifest.configPath}`);
        }
        logger.info("Host OpenClaw state restored.");
        return true;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Restoration failed: ${msg}`);
        return false;
    }
}
//# sourceMappingURL=migration-state.js.map