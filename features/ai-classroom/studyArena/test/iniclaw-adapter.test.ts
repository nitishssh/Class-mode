import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  getFridayLearningGatewayConfig,
  checkFridayLearningGatewayHealth,
  withFridayLearningGatewayOrFallback,
} from '../lib/friday-learning-gateway-adapter';

// Mock global fetch for testing
const globalFetch = global.fetch;

test('Adapter config reading', async () => {
  process.env.INICLAW_GATEWAY_URL = 'http://test-gw:7070';
  process.env.BRIDGE_SECRET = 'test-secret';
  process.env.USE_INICLAW = 'true';

  const config = getFridayLearningGatewayConfig();
  assert.equal(config.gatewayUrl, 'http://test-gw:7070');
  assert.equal(config.bridgeSecret, 'test-secret');
  assert.equal(config.useFridayLearningGateway, true);
});

test('Adapter health check - success', async () => {
  global.fetch = async () => ({ ok: true }) as any;
  const healthy = await checkFridayLearningGatewayHealth();
  assert.equal(healthy, true);
});

test('Adapter health check - failure', async () => {
  global.fetch = async () => ({ ok: false }) as any;
  const healthy = await checkFridayLearningGatewayHealth();
  assert.equal(healthy, false);
});

test('Adapter fallback logic', async () => {
  process.env.USE_INICLAW = 'false';
  let fallbackCalled = false;
  const result = await withFridayLearningGatewayOrFallback('test', 'sid', async () => {
    fallbackCalled = true;
    return 'fallback-result';
  });
  assert.equal(result, 'fallback-result');
  assert.equal(fallbackCalled, true);
});

// Restore fetch
global.fetch = globalFetch;
