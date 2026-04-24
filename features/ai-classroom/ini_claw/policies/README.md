# IniClaw Policies

This directory contains security policies for the IniClaw sandbox.

- `study-arena.yaml`: The default policy for Study Arena agents. It allows network access to necessary LLM providers and Study Arena services, and grants read/write access to the `.classroom-cache` directory.

To apply a policy, use:
`nemoclaw <sandbox-name> policy-add study-arena`
