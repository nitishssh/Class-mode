#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const { ROOT, SCRIPTS, run, runCapture } = require("./lib/runner");
const { ensureApiKey } = require("./lib/credentials");
const registry = require("./lib/registry");
const nim = require("./lib/nim");
const policies = require("./lib/policies");

// ── Global commands ──────────────────────────────────────────────

const GLOBAL_COMMANDS = new Set([
  "onboard",
  "list",
  "start",
  "stop",
  "status",
  "help",
  "--help",
  "-h",
]);

// ── Commands ─────────────────────────────────────────────────────

async function onboard() {
  const { onboard: runOnboard } = require("./lib/onboard");
  await runOnboard();
}


async function start() {
  await ensureApiKey();
  run(`bash "${SCRIPTS}/start-services.sh"`);
}

function stop() {
  run(`bash "${SCRIPTS}/start-services.sh" --stop`);
}

function showStatus() {
  // Show sandbox registry
  const { sandboxes, defaultSandbox } = registry.listSandboxes();
  if (sandboxes.length > 0) {
    console.log("");
    console.log("  Sandboxes:");
    for (const sb of sandboxes) {
      const def = sb.name === defaultSandbox ? " *" : "";
      const model = sb.model ? ` (${sb.model})` : "";
      console.log(`    ${sb.name}${def}${model}`);
    }
    console.log("");
  }

  // Show service status
  run(`bash "${SCRIPTS}/start-services.sh" --status`);
}

function listSandboxes() {
  const { sandboxes, defaultSandbox } = registry.listSandboxes();
  if (sandboxes.length === 0) {
    console.log("");
    console.log("  No sandboxes registered. Run `nemoclaw onboard` to get started.");
    console.log("");
    return;
  }

  console.log("");
  console.log("  Sandboxes:");
  for (const sb of sandboxes) {
    const def = sb.name === defaultSandbox ? " *" : "";
    const model = sb.model || "unknown";
    const provider = sb.provider || "unknown";
    const gpu = sb.gpuEnabled ? "GPU" : "CPU";
    const presets = sb.policies && sb.policies.length > 0 ? sb.policies.join(", ") : "none";
    console.log(`    ${sb.name}${def}`);
    console.log(`      model: ${model}  provider: ${provider}  ${gpu}  policies: ${presets}`);
  }
  console.log("");
  console.log("  * = default sandbox");
  console.log("");
}

// ── Sandbox-scoped actions ───────────────────────────────────────

function sandboxConnect(sandboxName) {
  // Ensure port forward is alive before connecting
  run(`openshell forward start --background 18789 ${sandboxName} 2>/dev/null || true`, {
    ignoreError: true,
  });
  run(`openshell sandbox connect ${sandboxName}`);
}

function sandboxStatus(sandboxName) {
  const sb = registry.getSandbox(sandboxName);
  if (sb) {
    console.log("");
    console.log(`  Sandbox: ${sb.name}`);
    console.log(`    Model:    ${sb.model || "unknown"}`);
    console.log(`    Provider: ${sb.provider || "unknown"}`);
    console.log(`    GPU:      ${sb.gpuEnabled ? "yes" : "no"}`);
    console.log(`    Policies: ${(sb.policies || []).join(", ") || "none"}`);
  }

  // openshell info
  run(`openshell sandbox get ${sandboxName} 2>/dev/null || true`, { ignoreError: true });

  // NIM health
  const nimStat = nim.nimStatus(sandboxName);
  console.log(
    `    NIM:      ${nimStat.running ? `running (${nimStat.container})` : "not running"}`
  );
  if (nimStat.running) {
    console.log(`    Healthy:  ${nimStat.healthy ? "yes" : "no"}`);
  }
  console.log("");
}

function sandboxLogs(sandboxName, follow) {
  const followFlag = follow ? " --follow" : "";
  run(`openshell sandbox logs ${sandboxName}${followFlag}`);
}

async function sandboxPolicyAdd(sandboxName) {
  const allPresets = policies.listPresets();
  const applied = policies.getAppliedPresets(sandboxName);

  console.log("");
  console.log("  Available presets:");
  allPresets.forEach((p) => {
    const marker = applied.includes(p.name) ? "●" : "○";
    console.log(`    ${marker} ${p.name} — ${p.description}`);
  });
  console.log("");

  const { prompt: askPrompt } = require("./lib/credentials");
  const answer = await askPrompt("  Preset to apply: ");
  if (!answer) return;

  const confirm = await askPrompt(`  Apply '${answer}' to sandbox '${sandboxName}'? [Y/n]: `);
  if (confirm.toLowerCase() === "n") return;

  policies.applyPreset(sandboxName, answer);
}

function sandboxPolicyList(sandboxName) {
  const allPresets = policies.listPresets();
  const applied = policies.getAppliedPresets(sandboxName);

  console.log("");
  console.log(`  Policy presets for sandbox '${sandboxName}':`);
  allPresets.forEach((p) => {
    const marker = applied.includes(p.name) ? "●" : "○";
    console.log(`    ${marker} ${p.name} — ${p.description}`);
  });
  console.log("");
}

function sandboxDestroy(sandboxName) {
  console.log(`  Stopping NIM for '${sandboxName}'...`);
  nim.stopNimContainer(sandboxName);

  console.log(`  Deleting sandbox '${sandboxName}'...`);
  run(`openshell sandbox delete ${sandboxName} 2>/dev/null || true`, { ignoreError: true });

  registry.removeSandbox(sandboxName);
  console.log(`  ✓ Sandbox '${sandboxName}' destroyed`);
}

// ── Help ─────────────────────────────────────────────────────────

function help() {
  console.log(`
  nemoclaw — IniClaw gateway CLI for Study Arena

  Getting Started:
    nemoclaw onboard                 Interactive setup wizard

  Gateway:
    nemoclaw start                   Start the IniClaw gateway (port 7070)
    nemoclaw stop                    Stop the gateway
    nemoclaw status                  Show sandbox list and gateway status

  Sandbox Management:
    nemoclaw list                    List all sandboxes
    nemoclaw <name> connect          Connect to a sandbox (debug)
    nemoclaw <name> status           Show sandbox status and health
    nemoclaw <name> logs [--follow]  View sandbox logs
    nemoclaw <name> destroy          Stop NIM + delete sandbox

  Policy Presets:
    nemoclaw <name> policy-add       Add a policy preset to a sandbox
    nemoclaw <name> policy-list      List presets (● = applied)

  Credentials are prompted on first use, then saved securely
  in ~/.nemoclaw/credentials.json (mode 600).
`);
}

// ── Dispatch ─────────────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2);

(async () => {
  // No command → help
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    help();
    return;
  }

  // Global commands
  if (GLOBAL_COMMANDS.has(cmd)) {
    switch (cmd) {
      case "onboard":
        await onboard();
        break;
      case "start":
        await start();
        break;
      case "stop":
        stop();
        break;
      case "status":
        showStatus();
        break;
      case "list":
        listSandboxes();
        break;
      default:
        help();
        break;
    }
    return;
  }

  // Sandbox-scoped commands: nemoclaw <name> <action>
  const sandbox = registry.getSandbox(cmd);
  if (sandbox) {
    const action = args[0] || "connect";
    const actionArgs = args.slice(1);

    switch (action) {
      case "connect":
        sandboxConnect(cmd);
        break;
      case "status":
        sandboxStatus(cmd);
        break;
      case "logs":
        sandboxLogs(cmd, actionArgs.includes("--follow"));
        break;
      case "policy-add":
        await sandboxPolicyAdd(cmd);
        break;
      case "policy-list":
        sandboxPolicyList(cmd);
        break;
      case "destroy":
        sandboxDestroy(cmd);
        break;
      default:
        console.error(`  Unknown action: ${action}`);
        console.error(`  Valid actions: connect, status, logs, policy-add, policy-list, destroy`);
        process.exit(1);
    }
    return;
  }

  // Unknown command — suggest
  console.error(`  Unknown command: ${cmd}`);
  console.error("");

  // Check if it looks like a sandbox name with missing action
  const allNames = registry.listSandboxes().sandboxes.map((s) => s.name);
  if (allNames.length > 0) {
    console.error(`  Registered sandboxes: ${allNames.join(", ")}`);
    console.error(`  Try: nemoclaw <sandbox-name> connect`);
    console.error("");
  }

  console.error(`  Run 'nemoclaw help' for usage.`);
  process.exit(1);
})();
