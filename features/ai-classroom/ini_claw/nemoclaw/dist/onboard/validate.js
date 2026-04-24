"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateApiKey = validateApiKey;
exports.maskApiKey = maskApiKey;
async function validateApiKey(apiKey, endpointUrl) {
    const url = `${endpointUrl.replace(/\/+$/, "")}/models`;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, 10_000);
    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal,
        });
        if (!response.ok) {
            const body = await response.text().catch(() => "");
            return {
                valid: false,
                models: [],
                error: `HTTP ${String(response.status)}: ${body.slice(0, 200)}`,
            };
        }
        const json = (await response.json());
        const models = (json.data ?? []).map((m) => m.id);
        return { valid: true, models, error: null };
    }
    catch (err) {
        const message = err instanceof Error
            ? err.name === "AbortError"
                ? "Request timed out (10s)"
                : err.message
            : String(err);
        return { valid: false, models: [], error: message };
    }
    finally {
        clearTimeout(timeout);
    }
}
function maskApiKey(apiKey) {
    if (apiKey.length <= 8)
        return "****";
    const last4 = apiKey.slice(-4);
    if (apiKey.startsWith("nvapi-")) {
        return `nvapi-****${last4}`;
    }
    return `****${last4}`;
}
//# sourceMappingURL=validate.js.map