---
name: friday-learning-gateway
description: Explain the FridayLearning Gateway integration and how it sandboxes agent calls.
---

# FridayLearning Gateway Integration

Friday Learning integrates with **FridayLearning Gateway** (NVIDIA FridayLearning Gateway) to provide a secure, sandboxed environment for AI agents.

## How it works

1. **Sandboxing**: Every LLM call made by Friday Learning agents is routed through the FridayLearning Gateway gateway.
2. **Policy Enforcement**: The sandbox enforces network, filesystem, and process policies defined in `ini_claw/policies/friday-learning.yaml`.
3. **Audit Logging**: All interactions are logged for auditing and security monitoring.
4. **Fallback**: If the FridayLearning Gateway gateway is unreachable, Friday Learning falls back to direct LLM calls and logs a warning.

## Configuration

The integration is controlled via environment variables in Friday Learning:

- `USE_INICLAW`: Set to `true` to enable the integration.
- `INICLAW_GATEWAY_URL`: The URL of the FridayLearning Gateway gateway (default: `http://localhost:7070`).
- `BRIDGE_SECRET`: Shared secret for authentication between Friday Learning and FridayLearning Gateway.

## Health Monitoring

You can check the connection status at:
`GET /api/friday-learning-gateway-health`
