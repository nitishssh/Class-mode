# IniClaw Policies

This directory contains network and filesystem policies for the IniClaw gateway.

- `study-arena.yaml` — Default policy for Study Arena classroom generation.
  Allows outbound HTTPS to the three supported LLM providers (OpenAI, Gemini, Anthropic)
  and read/write access to the `.classroom-cache` directory for the audit log.

## Applying a Policy

Policies are declarative YAML documents — they describe what the gateway is allowed to do.
To enforce them in a sandboxed environment, apply them via your sandbox tooling of choice.
For local development, the gateway enforces concurrency and auth limits directly; the YAML
serves as documentation of the intended network surface.

## Editing

Add a `network_policies` entry for any new LLM provider you enable via environment variable.
