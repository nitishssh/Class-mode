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

export async function checkFridayLearningGatewayHealth(): Promise<boolean> {
  const config = getFridayLearningGatewayConfig();
  if (!config.gatewayUrl || !config.bridgeSecret) return false;

  try {
    const res = await fetch(`${config.gatewayUrl}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function withFridayLearningGatewayOrFallback<T>(
  prompt: string,
  sessionId: string | undefined,
  fallbackFunc: () => Promise<T>,
): Promise<T | any> {
  const config = getFridayLearningGatewayConfig();

  if (config.useFridayLearningGateway) {
    const healthy = await checkFridayLearningGatewayHealth();
    if (healthy) {
      console.log(
        `[FridayLearningGateway] Routing request through sandbox (session: ${sessionId || 'none'})`,
      );
      try {
        const res = await fetch(`${config.gatewayUrl}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.bridgeSecret}`,
          },
          body: JSON.stringify({ prompt, sessionId }),
          signal: AbortSignal.timeout(300000), // 5 mins
        });

        if (res.ok) {
          const data = await res.json();
          // Assuming the sandbox returns a structure compatible with Friday Learning's expectation
          // or we just return the raw response if it's a simple string
          return data;
        } else {
          console.warn(`[FridayLearningGateway] Gateway returned ${res.status}, falling back...`);
        }
      } catch (err: any) {
        console.error(`[FridayLearningGateway] Gateway error: ${err.message}, falling back...`);
      }
    } else {
      console.warn('[FridayLearningGateway] Gateway unreachable, falling back...');
    }
  }

  return fallbackFunc();
}
