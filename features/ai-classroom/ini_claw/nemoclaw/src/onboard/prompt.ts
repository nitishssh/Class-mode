// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export interface SelectOption {
  label: string;
  value: string;
  hint?: string;
}

export async function promptInput(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  try {
    const answer = await rl.question(`${question}${suffix}: `);
    const trimmed = answer.trim();
    return trimmed || defaultValue || "";
  } finally {
    rl.close();
  }
}

export async function promptConfirm(question: string, defaultYes = true): Promise<boolean> {
  const rl = createInterface({ input: stdin, output: stdout });
  const hint = defaultYes ? "(Y/n)" : "(y/N)";
  try {
    const answer = await rl.question(`${question} ${hint}: `);
    const trimmed = answer.trim().toLowerCase();
    if (!trimmed) return defaultYes;
    return trimmed === "y" || trimmed === "yes";
  } finally {
    rl.close();
  }
}

export async function promptSelect(
  question: string,
  options: SelectOption[],
  defaultIndex = 0,
): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
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
      const answer = await rl.question(
        `Select [1-${String(options.length)}] (default: ${String(defaultIndex + 1)}): `,
      );
      const trimmed = answer.trim();

      if (!trimmed) return options[defaultIndex].value;

      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= options.length) {
        return options[num - 1].value;
      }

      console.log(`  Invalid choice. Enter a number between 1 and ${String(options.length)}.`);
    }
  } finally {
    rl.close();
  }
}
