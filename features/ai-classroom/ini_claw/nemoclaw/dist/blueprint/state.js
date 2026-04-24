"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadState = loadState;
exports.saveState = saveState;
exports.clearState = clearState;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const STATE_DIR = (0, node_path_1.join)(process.env.HOME ?? "/tmp", ".nemoclaw", "state");
let stateDirCreated = false;
function ensureStateDir() {
    if (stateDirCreated)
        return;
    if (!(0, node_fs_1.existsSync)(STATE_DIR)) {
        (0, node_fs_1.mkdirSync)(STATE_DIR, { recursive: true });
    }
    stateDirCreated = true;
}
function statePath() {
    return (0, node_path_1.join)(STATE_DIR, "nemoclaw.json");
}
function blankState() {
    return {
        lastRunId: null,
        lastAction: null,
        blueprintVersion: null,
        sandboxName: null,
        migrationSnapshot: null,
        hostBackupPath: null,
        createdAt: null,
        updatedAt: new Date().toISOString(),
    };
}
function loadState() {
    ensureStateDir();
    const path = statePath();
    if (!(0, node_fs_1.existsSync)(path)) {
        return blankState();
    }
    return JSON.parse((0, node_fs_1.readFileSync)(path, "utf-8"));
}
function saveState(state) {
    ensureStateDir();
    state.updatedAt = new Date().toISOString();
    if (!state.createdAt)
        state.createdAt = state.updatedAt;
    (0, node_fs_1.writeFileSync)(statePath(), JSON.stringify(state, null, 2));
}
function clearState() {
    ensureStateDir();
    const path = statePath();
    if ((0, node_fs_1.existsSync)(path)) {
        (0, node_fs_1.writeFileSync)(path, JSON.stringify(blankState(), null, 2));
    }
}
//# sourceMappingURL=state.js.map