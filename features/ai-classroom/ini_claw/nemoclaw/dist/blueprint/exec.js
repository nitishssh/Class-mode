"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.execBlueprint = execBlueprint;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function failResult(action, message) {
    return { success: false, runId: "error", action, output: message, exitCode: 1 };
}
async function execBlueprint(options, logger) {
    const runnerPath = (0, node_path_1.join)(options.blueprintPath, "orchestrator", "runner.py");
    if (!(0, node_fs_1.existsSync)(runnerPath)) {
        const msg = `Blueprint runner not found at ${runnerPath}. Is the blueprint installed correctly?`;
        logger.error(msg);
        return failResult(options.action, msg);
    }
    const args = [runnerPath, options.action, "--profile", options.profile];
    if (options.jsonOutput)
        args.push("--json");
    if (options.planPath)
        args.push("--plan", options.planPath);
    if (options.runId)
        args.push("--run-id", options.runId);
    if (options.dryRun)
        args.push("--dry-run");
    if (options.endpointUrl)
        args.push("--endpoint-url", options.endpointUrl);
    logger.info(`Running blueprint: ${options.action} (profile: ${options.profile})`);
    return new Promise((resolve) => {
        const chunks = [];
        const proc = (0, node_child_process_1.spawn)("python3", args, {
            cwd: options.blueprintPath,
            env: {
                ...process.env,
                NEMOCLAW_BLUEPRINT_PATH: options.blueprintPath,
                NEMOCLAW_ACTION: options.action,
            },
            stdio: ["pipe", "pipe", "pipe"],
        });
        proc.stdout.on("data", (data) => {
            const line = data.toString();
            chunks.push(line);
        });
        proc.stderr.on("data", (data) => {
            const line = data.toString().trim();
            if (line)
                logger.warn(line);
        });
        proc.on("close", (code) => {
            const output = chunks.join("");
            const runIdMatch = output.match(/^RUN_ID:(.+)$/m);
            resolve({
                success: code === 0,
                runId: runIdMatch?.[1] ?? "unknown",
                action: options.action,
                output,
                exitCode: code ?? 1,
            });
        });
        proc.on("error", (err) => {
            const msg = err.message.includes("ENOENT")
                ? "python3 not found. The blueprint runner requires Python 3.11+."
                : `Failed to start blueprint runner: ${err.message}`;
            logger.error(msg);
            resolve(failResult(options.action, msg));
        });
    });
}
//# sourceMappingURL=exec.js.map