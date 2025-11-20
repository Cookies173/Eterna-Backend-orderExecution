import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { setupWorker, ORDER_QUEUE_NAME } from './engine';
import dotenv from 'dotenv';

dotenv.config();

const app = Fastify({ logger: true });

const redisConfig = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {})
};

const connection = new IORedis(redisConfig);

const orderQueue = new Queue(ORDER_QUEUE_NAME, { 
  connection,
  defaultJobOptions: {
    attempts: 3, 
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 1000, 
    removeOnFail: 5000 
  }
});

const subscribers = new Map<string, any>();

const broadcastToSubscribers = (orderId: string, data: any) => {
  const socket = subscribers.get(orderId);
  if (socket && socket.readyState === 1) {
    socket.send(JSON.stringify(data));
  }
};

setupWorker(broadcastToSubscribers);

app.register(cors);
app.register(fastifyWebsocket);

app.post('/api/orders/execute', async (req: any, reply) => {
  const { inputToken, outputToken, amount } = req.body;
  
  if (!amount || amount <= 0) return reply.code(400).send({ error: 'Invalid amount' });

  const orderId = uuidv4();

  await orderQueue.add('market-order', { orderId, inputToken, outputToken, amount });

  return { success: true, orderId, wsUrl: `ws://eterna-backend-orderexecution.onrender.com/ws/orders/${orderId}` };
});

app.register(async (fastify) => {
  fastify.get('/ws/orders/:orderId', { websocket: true }, (connection, req: any) => {
    const { orderId } = req.params;
    console.log(`WS Connected: ${orderId}`);
    subscribers.set(orderId, connection.socket);
    
    connection.socket.on('close', () => {
      subscribers.delete(orderId);
    });
  });
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};


if (process.env.NODE_ENV !== 'test') {
  start();
}

export { app };
