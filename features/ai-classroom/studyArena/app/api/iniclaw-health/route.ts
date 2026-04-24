import { NextResponse } from 'next/server';
import {
  checkFridayLearningGatewayHealth,
  getFridayLearningGatewayConfig,
} from '@/lib/friday-learning-gateway-adapter';

export async function GET() {
  const healthy = await checkFridayLearningGatewayHealth();
  const config = getFridayLearningGatewayConfig();

  return NextResponse.json({
    status: healthy ? 'connected' : 'disconnected',
    gatewayUrl: config.gatewayUrl,
    useFridayLearningGateway: config.useFridayLearningGateway,
  });
}
