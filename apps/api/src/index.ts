import 'dotenv/config'
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config';
import { authRouter } from './routes/auth';
import { paymentRouter } from './routes/payment';
import { credentialRouter } from './routes/credential';
import { streamRouter } from './routes/stream';
import { sessionRouter } from './routes/session';
import { resultsRouter } from './routes/results';
import { errorHandler } from './middleware/errorHandler';
import { ping as redisPing } from './lib/cache';
import { activeConnectionCount } from './lib/sse';

const app = express();

app.use(cors());
app.use(express.json());
app.use(pinoHttp());

app.use('/api/auth', authRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/credential', credentialRouter);
app.use('/api/session', sessionRouter);
app.use('/api/results', resultsRouter);
app.use('/api', streamRouter);

app.get('/health', async (req, res) => {
  const redis = await redisPing();
  const connections = activeConnectionCount();
  res.json({ status: 'ok', redis, connections });
});

app.use(errorHandler);

const server = app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT}`);
});

process.on('SIGTERM', async () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
