export interface FridayLearningGatewayConfig {
  gatewayUrl: string;
  bridgeSecret: string;
  useFridayLearningGateway: boolean;
}

export function getFridayLearningGatewayConfig(): FridayLearningGatewayConfig {
  return {
    gatewayUrl: process.env.INICLAW_GATEWAY_URL || 'http://localhost:7070',
    bridgeSecret: process.env.BRIDGE_SECRET || '',
    useFridayLearningGateway: process.env.USE_INICLAW === 'true',
  };
}

// Cache the health result for 30 s so a classroom generation (6+ LLM calls)
// only pays the HTTP roundtrip once instead of on every call.
let _healthCache: { ok: boolean; at: number } | null = null;
const HEALTH_TTL_MS = 30_000;

export async function checkFridayLearningGatewayHealth(): Promise<boolean> {
  const now = Date.now();
  if (_healthCache && now - _healthCache.at < HEALTH_TTL_MS) return _healthCache.ok;

  const config = getFridayLearningGatewayConfig();
  if (!config.gatewayUrl || !config.bridgeSecret) {
    _healthCache = { ok: false, at: now };
    return false;
  }

  try {
    const res = await fetch(`${config.gatewayUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    _healthCache = { ok: res.ok, at: now };
    return res.ok;
  } catch {
    _healthCache = { ok: false, at: now };
    return false;
  }
}

async function postToGateway(
  route: string,
  payload: { prompt: string; sessionId?: string; agentName?: string },
  timeoutMs: number,
): Promise<any | null> {
  const config = getFridayLearningGatewayConfig();
  try {
    const res = await fetch(`${config.gatewayUrl}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.bridgeSecret}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.ok) return await res.json();

    console.warn(`[FridayLearningGateway] ${route} returned ${res.status}`);
    return null;
  } catch (err: any) {
    console.error(`[FridayLearningGateway] ${route} error: ${err.message}`);
    return null;
  }
}

// ── Project-specific gateway helpers ─────────────────────────────────────────
//
// Each helper maps to a gateway route with the correct timeout for that use case.
// Falls back to the provided fallback function if the gateway is unavailable.

export async function generateClassroomViaSandbox<T>(
  prompt: string,
  sessionId: string | undefined,
  fallback: () => Promise<T>,
): Promise<T | any> {
  const config = getFridayLearningGatewayConfig();
  if (config.useFridayLearningGateway && (await checkFridayLearningGatewayHealth())) {
    console.log(`[FridayLearningGateway] Routing classroom generation through sandbox (session: ${sessionId ?? 'none'})`);
    const result = await postToGateway('/classroom/generate', { prompt, sessionId }, 300000);
    if (result !== null) return result;
    console.warn('[FridayLearningGateway] Falling back for classroom generation');
  }
  return fallback();
}

export async function generateQuizViaSandbox<T>(
  prompt: string,
  sessionId: string | undefined,
  fallback: () => Promise<T>,
): Promise<T | any> {
  const config = getFridayLearningGatewayConfig();
  if (config.useFridayLearningGateway && (await checkFridayLearningGatewayHealth())) {
    console.log(`[FridayLearningGateway] Routing quiz generation through sandbox (session: ${sessionId ?? 'none'})`);
    const result = await postToGateway('/classroom/quiz', { prompt, sessionId }, 120000);
    if (result !== null) return result;
    console.warn('[FridayLearningGateway] Falling back for quiz generation');
  }
  return fallback();
}

export async function generateSlidesViaSandbox<T>(
  prompt: string,
  sessionId: string | undefined,
  fallback: () => Promise<T>,
): Promise<T | any> {
  const config = getFridayLearningGatewayConfig();
  if (config.useFridayLearningGateway && (await checkFridayLearningGatewayHealth())) {
    console.log(`[FridayLearningGateway] Routing slide generation through sandbox (session: ${sessionId ?? 'none'})`);
    const result = await postToGateway('/classroom/slides', { prompt, sessionId }, 120000);
    if (result !== null) return result;
    console.warn('[FridayLearningGateway] Falling back for slide generation');
  }
  return fallback();
}

export async function chatWithTutorViaSandbox<T>(
  message: string,
  sessionId: string | undefined,
  fallback: () => Promise<T>,
): Promise<T | any> {
  const config = getFridayLearningGatewayConfig();
  if (config.useFridayLearningGateway && (await checkFridayLearningGatewayHealth())) {
    console.log(`[FridayLearningGateway] Routing tutor chat through sandbox (session: ${sessionId ?? 'none'})`);
    const result = await postToGateway('/tutor/chat', { prompt: message, sessionId }, 60000);
    if (result !== null) return result;
    console.warn('[FridayLearningGateway] Falling back for tutor chat');
  }
  return fallback();
}

// ── Legacy generic helper (kept for backward compatibility) ───────────────────

export async function withFridayLearningGatewayOrFallback<T>(
  prompt: string,
  sessionId: string | undefined,
  fallbackFunc: () => Promise<T>,
): Promise<T | any> {
  const config = getFridayLearningGatewayConfig();

  if (config.useFridayLearningGateway && (await checkFridayLearningGatewayHealth())) {
    console.log(`[FridayLearningGateway] Routing request through sandbox (session: ${sessionId ?? 'none'})`);
    const result = await postToGateway('/generate', { prompt, sessionId }, 300000);
    if (result !== null) return result;
    console.warn('[FridayLearningGateway] Gateway returned error, falling back...');
  } else if (config.useFridayLearningGateway) {
    console.warn('[FridayLearningGateway] Gateway unreachable, falling back...');
  }

  return fallbackFunc();
}
