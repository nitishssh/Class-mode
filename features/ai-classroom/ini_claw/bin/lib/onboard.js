// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Interactive onboarding wizard — 7 steps from zero to running sandbox.

const fs = require("fs");
const path = require("path");
const { ROOT, SCRIPTS, run, runCapture } = require("./runner");
const { prompt, ensureApiKey } = require("./credentials");
const registry = require("./registry");
const nim = require("./nim");
const { checkCgroupConfig } = require("./preflight");

// ── Helpers ──────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

function step(n, msg) {
  console.log("");
  console.log(`  [${n}/${TOTAL_STEPS}] ${msg}`);
  console.log(`  ${"─".repeat(50)}`);
}

function isDockerRunning() {
  try {
    runCapture("docker info", { ignoreError: false });
    return true;
  } catch {
    return false;
  }
}

function isOpenshellInstalled() {
  try {
    runCapture("command -v openshell");
    return true;
  } catch {
    return false;
  }
}

function installOpenshell() {
  console.log("  Installing openshell CLI...");
  run(`bash "${path.join(SCRIPTS, "install.sh")}"`, { ignoreError: true });
  return isOpenshellInstalled();
}

// ── Step 1: Preflight ────────────────────────────────────────────

async function preflight() {
  step(1, "Preflight checks");

  // Docker
  if (!isDockerRunning()) {
    console.error("  Docker is not running. Please start Docker and try again.");
    process.exit(1);
  }
  console.log("  ✓ Docker is running");

  // OpenShell CLI
  if (!isOpenshellInstalled()) {
    console.log("  openshell CLI not found. Attempting to install...");
    if (!installOpenshell()) {
      console.error("  Failed to install openshell CLI.");
      console.error("  Install manually: https://github.com/NVIDIA/OpenShell/releases");
      process.exit(1);
    }
  }
  console.log(
    `  ✓ openshell CLI: ${runCapture("openshell --version 2>/dev/null || echo unknown", { ignoreError: true })}`
  );

  // cgroup v2 + Docker cgroupns
  const cgroup = checkCgroupConfig();
  if (!cgroup.ok) {
    console.error("");
    console.error("  !! cgroup v2 detected but Docker is not configured for cgroupns=host.");
    console.error("     OpenShell's gateway runs k3s inside Docker, which will fail with:");
    console.error("");
    console.error("       openat2 /sys/fs/cgroup/kubepods/pids.max: no such file or directory");
    console.error("");
    console.error("     To fix, run:");
    console.error("");
    console.error("       nemoclaw setup-spark");
    console.error("");
    console.error('     This adds "default-cgroupns-mode": "host" to /etc/docker/daemon.json');
    console.error("     (preserving any existing settings) and restarts Docker.");
    console.error("");
    console.error(`     Detail: ${cgroup.reason}`);
    process.exit(1);
  }
  console.log("  ✓ cgroup configuration OK");

  // GPU
  const gpu = nim.detectGpu();
  if (gpu && gpu.type === "nvidia") {
    console.log(`  ✓ NVIDIA GPU detected: ${gpu.count} GPU(s), ${gpu.totalMemoryMB} MB VRAM`);
  } else if (gpu && gpu.type === "apple") {
    console.log(
      `  ✓ Apple GPU detected: ${gpu.name}${gpu.cores ? ` (${gpu.cores} cores)` : ""}, ${gpu.totalMemoryMB} MB unified memory`
    );
    console.log("  ⓘ NIM requires NVIDIA GPU — will use cloud inference");
  } else {
    console.log("  ⓘ No GPU detected — will use cloud inference");
  }

  return gpu;
}

// ── Step 2: Gateway ──────────────────────────────────────────────

async function startGateway(gpu) {
  step(2, "Starting OpenShell gateway");

  run("openshell gateway destroy -g nemoclaw 2>/dev/null || true", { ignoreError: true });

  const gwArgs = ["--name", "nemoclaw"];
  if (gpu && gpu.nimCapable) gwArgs.push("--gpu");

  run(`openshell gateway start ${gwArgs.join(" ")}`, { ignoreError: false });

  for (let i = 0; i < 5; i++) {
    const status = runCapture("openshell status 2>&1", { ignoreError: true });
    if (status.includes("Connected")) {
      console.log("  ✓ Gateway is healthy");
      break;
    }
    if (i === 4) {
      console.error("  Gateway failed to start. Run: openshell gateway info");
      process.exit(1);
    }
    require("child_process").spawnSync("sleep", ["2"]);
  }

  require("child_process").spawnSync("sleep", ["3"]);
}

// ── Step 3: Sandbox ──────────────────────────────────────────────

async function createSandbox(gpu) {
  step(3, "Creating sandbox");

  const nameAnswer = await prompt("  Sandbox name [study-arena]: ");
  const sandboxName = nameAnswer || "study-arena";

  // Check if sandbox already exists in registry
  const existing = registry.getSandbox(sandboxName);
  if (existing) {
    const recreate = await prompt(`  Sandbox '${sandboxName}' already exists. Recreate? [y/N]: `);
    if (recreate.toLowerCase() !== "y") {
      console.log("  Keeping existing sandbox.");
      return sandboxName;
    }
    // Destroy old sandbox
    run(`openshell sandbox delete ${sandboxName} 2>/dev/null || true`, { ignoreError: true });
    registry.removeSandbox(sandboxName);
  }

  // Stage build context
  const { mkdtempSync } = require("fs");
  const os = require("os");
  const buildCtx = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-build-"));
  fs.copyFileSync(path.join(ROOT, "Dockerfile"), path.join(buildCtx, "Dockerfile"));
  run(`cp -r "${path.join(ROOT, "nemoclaw")}" "${buildCtx}/nemoclaw"`);
  run(`cp -r "${path.join(ROOT, "nemoclaw-blueprint")}" "${buildCtx}/nemoclaw-blueprint"`);
  run(`cp -r "${path.join(ROOT, "scripts")}" "${buildCtx}/scripts"`);
  run(`rm -rf "${buildCtx}/nemoclaw/node_modules" "${buildCtx}/nemoclaw/src"`, {
    ignoreError: true,
  });

  // Create sandbox (use -- echo to avoid dropping into interactive shell)
  // Pass the base policy so sandbox starts in proxy mode (required for policy updates later)
  const basePolicyPath = path.join(ROOT, "nemoclaw-blueprint", "policies", "openclaw-sandbox.yaml");
  const createArgs = [
    `--from "${buildCtx}/Dockerfile"`,
    `--name ${sandboxName}`,
    `--policy "${basePolicyPath}"`,
  ];
  if (gpu && gpu.nimCapable) createArgs.push("--gpu");

  console.log(`  Creating sandbox '${sandboxName}' (this takes a few minutes on first run)...`);
  const chatUiUrl = process.env.CHAT_UI_URL || "http://127.0.0.1:18789";
  const envArgs = [`CHAT_UI_URL=${chatUiUrl}`];
  if (process.env.NVIDIA_API_KEY) {
    envArgs.push(`NVIDIA_API_KEY=${process.env.NVIDIA_API_KEY}`);
  }
  run(
    `openshell sandbox create ${createArgs.join(" ")} -- env ${envArgs.join(" ")} nemoclaw-start 2>&1 | awk '/Sandbox allocated/{if(!seen){print;seen=1}next}1'`
  );

  // Clean up build context
  run(`rm -rf "${buildCtx}"`, { ignoreError: true });

  // Register in registry
  registry.registerSandbox({
    name: sandboxName,
    gpuEnabled: !!gpu,
  });

  console.log(`  ✓ Sandbox '${sandboxName}' created`);
  return sandboxName;
}

// ── Step 4: Inference provider ───────────────────────────────────
//
// Study Arena uses cloud LLM APIs — no local GPU inference required.

async function setupNim(sandboxName) {
  step(4, "Configuring inference provider");

  const options = [
    { key: "nvidia", label: "NVIDIA Cloud API  (build.nvidia.com)  — default" },
    { key: "anthropic", label: "Anthropic API  (api.anthropic.com)" },
    { key: "openai", label: "OpenAI API  (api.openai.com)" },
  ];

  console.log("");
  console.log("  Inference provider:");
  options.forEach((o, i) => console.log(`    ${i + 1}) ${o.label}`));
  console.log("");

  const choice = await prompt("  Choose [1]: ");
  const idx = Math.max(0, parseInt(choice || "1", 10) - 1);
  const selected = options[Math.min(idx, options.length - 1)];

  let model, provider;

  if (selected.key === "anthropic") {
    provider = "anthropic";
    model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
    if (!process.env.ANTHROPIC_API_KEY) {
      const key = await prompt("  ANTHROPIC_API_KEY: ");
      if (key) process.env.ANTHROPIC_API_KEY = key.trim();
    }
    console.log(`  ✓ Using Anthropic: ${model}`);
  } else if (selected.key === "openai") {
    provider = "openai";
    model = process.env.OPENAI_MODEL || "gpt-4o";
    if (!process.env.OPENAI_API_KEY) {
      const key = await prompt("  OPENAI_API_KEY: ");
      if (key) process.env.OPENAI_API_KEY = key.trim();
    }
    console.log(`  ✓ Using OpenAI: ${model}`);
  } else {
    provider = "nvidia-nim";
    model = process.env.OPENCLAW_MODEL || "nvidia/nemotron-3-super-120b-a12b";
    await ensureApiKey();
    console.log(`  ✓ Using NVIDIA Cloud API: ${model}`);
  }

  registry.updateSandbox(sandboxName, { model, provider });
  return { model, provider };
}

// ── Step 5: Inference provider + policy ──────────────────────────

async function setupInference(sandboxName, model, provider) {
  step(5, "Setting up inference provider and sandbox policy");

  if (provider === "nvidia-nim") {
    run(
      `openshell provider create --name nvidia-nim --type openai ` +
        `--credential "NVIDIA_API_KEY=${process.env.NVIDIA_API_KEY}" ` +
        `--config "OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1" 2>&1 || true`,
      { ignoreError: true }
    );
    run(
      `openshell inference set --no-verify --provider nvidia-nim --model ${model} 2>/dev/null || true`,
      { ignoreError: true }
    );
  } else if (provider === "anthropic") {
    run(
      `openshell provider create --name anthropic --type anthropic ` +
        `--credential "ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}" 2>&1 || true`,
      { ignoreError: true }
    );
    run(
      `openshell inference set --no-verify --provider anthropic --model ${model} 2>/dev/null || true`,
      { ignoreError: true }
    );
  } else if (provider === "openai") {
    run(
      `openshell provider create --name openai --type openai ` +
        `--credential "OPENAI_API_KEY=${process.env.OPENAI_API_KEY}" 2>&1 || true`,
      { ignoreError: true }
    );
    run(
      `openshell inference set --no-verify --provider openai --model ${model} 2>/dev/null || true`,
      { ignoreError: true }
    );
  }

  registry.updateSandbox(sandboxName, { model, provider });
  console.log(`  ✓ Inference: ${provider} / ${model}`);

  // Always apply the Study Arena network policy so the sandbox can reach the
  // relevant LLM APIs (Anthropic, OpenAI, NVIDIA, Study Arena services).
  const arenaPolicy = path.join(ROOT, "policies", "study-arena.yaml");
  if (fs.existsSync(arenaPolicy)) {
    try {
      run(`openshell policy set --policy "${arenaPolicy}" --wait ${sandboxName} 2>/dev/null || true`, {
        ignoreError: true,
      });
      registry.updateSandbox(sandboxName, { policies: ["study-arena"] });
      console.log("  ✓ Study Arena sandbox policy applied");
    } catch {}
  }
}

// ── Dashboard ────────────────────────────────────────────────────

function printDashboard(sandboxName, model, provider) {
  const providerLabels = {
    "nvidia-nim": "NVIDIA Cloud API",
    anthropic: "Anthropic API",
    openai: "OpenAI API",
  };
  const providerLabel = providerLabels[provider] || provider;

  console.log("");
  console.log(`  ${"─".repeat(50)}`);
  console.log(`  Sandbox      ${sandboxName} (Landlock + seccomp + netns)`);
  console.log(`  Model        ${model} (${providerLabel})`);
  console.log(`  Gateway      http://localhost:${process.env.INICLAW_PORT || 7070}/`);
  console.log(`  ${"─".repeat(50)}`);
  console.log(`  Start:       nemoclaw start`);
  console.log(`  Status:      nemoclaw ${sandboxName} status`);
  console.log(`  Logs:        nemoclaw ${sandboxName} logs --follow`);
  console.log(`  ${"─".repeat(50)}`);
  console.log("");
}

// ── Main ─────────────────────────────────────────────────────────

async function onboard() {
  console.log("");
  console.log("  IniClaw Onboarding — Study Arena");
  console.log("  =================================");

  const gpu = await preflight();
  await startGateway(gpu);
  const sandboxName = await createSandbox(gpu);
  const { model, provider } = await setupNim(sandboxName);
  await setupInference(sandboxName, model, provider);
  printDashboard(sandboxName, model, provider);
}

module.exports = { onboard };
