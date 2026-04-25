import express from 'express';

const app = express();
const port = Number(process.env.GATEWAY_PORT ?? 4000);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'iniclaw-gateway',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/agents/execute', (_req, res) => {
  res.status(501).json({
    error: 'not_implemented',
    message:
      'IniClaw runtime code is not available in this repository yet. Replace services/iniclaw with your full IniClaw source.',
  });
});

app.listen(port, () => {
  console.log(`iniclaw-gateway listening on port ${port}`);
});
