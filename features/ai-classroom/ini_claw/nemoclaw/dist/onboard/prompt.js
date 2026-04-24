"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptInput = promptInput;
exports.promptConfirm = promptConfirm;
exports.promptSelect = promptSelect;
const promises_1 = require("node:readline/promises");
const node_process_1 = require("node:process");
async function promptInput(question, defaultValue) {
    const rl = (0, promises_1.createInterface)({ input: node_process_1.stdin, output: node_process_1.stdout });
    const suffix = defaultValue ? ` [${defaultValue}]` : "";
    try {
        const answer = await rl.question(`${question}${suffix}: `);
        const trimmed = answer.trim();
        return trimmed || defaultValue || "";
    }
    finally {
        rl.close();
    }
}
async function promptConfirm(question, defaultYes = true) {
    const rl = (0, promises_1.createInterface)({ input: node_process_1.stdin, output: node_process_1.stdout });
    const hint = defaultYes ? "(Y/n)" : "(y/N)";
    try {
        const answer = await rl.question(`${question} ${hint}: `);
        const trimmed = answer.trim().toLowerCase();
        if (!trimmed)
            return defaultYes;
        return trimmed === "y" || trimmed === "yes";
    }
    finally {
        rl.close();
    }
}
async function promptSelect(question, options, defaultIndex = 0) {
    const rl = (0, promises_1.createInterface)({ input: node_process_1.stdin, output: node_process_1.stdout });
    try {
        console.log(`\n${question}\n`);
        for (let i = 0; i < options.length; i++) {
            const marker = i === defaultIndex ? "*" : " ";
            const optHint = options[i].hint;
            const hint = optHint ? `  ${optHint}` : "";
            console.log(`  ${marker} ${String(i + 1)}. ${options[i].label}${hint}`);
        }
        console.log("");
        for (;;) {
            const answer = await rl.question(`Select [1-${String(options.length)}] (default: ${String(defaultIndex + 1)}): `);
            const trimmed = answer.trim();
            if (!trimmed)
                return options[defaultIndex].value;
            const num = parseInt(trimmed, 10);
            if (!isNaN(num) && num >= 1 && num <= options.length) {
                return options[num - 1].value;
            }
            console.log(`  Invalid choice. Enter a number between 1 and ${String(options.length)}.`);
        }
    }
    finally {
        rl.close();
    }
}
//# sourceMappingURL=prompt.js.map