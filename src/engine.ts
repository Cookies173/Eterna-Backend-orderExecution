import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { fetchQuotes } from './dex';
import { saveOrderToHistory } from './db';
import dotenv from 'dotenv';

dotenv.config();

export const ORDER_QUEUE_NAME = 'order-execution-queue';

const redisConfig = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {})
};

const connection = new IORedis(redisConfig);

export const setupWorker = (broadcastStatus: (orderId: string, status: any) => void) => {
  
  const worker = new Worker(ORDER_QUEUE_NAME, async (job: Job) => {
    const { orderId, inputToken, outputToken, amount } = job.data;
    const shortId = orderId.slice(0, 8); 
    
    const updateStatus = async (status: string, details: any = {}) => {
      const payload = { orderId, status, ...details };
      await job.updateProgress(payload);
      broadcastStatus(orderId, payload);
      
      if (status !== 'routing') {
        console.log(`[${shortId}] ${status.toUpperCase()}`);
      }
    };

    try {
      // 1. PENDING
      if (job.attemptsMade === 0) {
        await updateStatus('pending');
      }

      // 2. ROUTING
      await updateStatus('routing', { message: 'Scanning DEXs...' });
      console.log(`[${shortId}] ROUTING: Fetching quotes for ${amount} ${inputToken}...`);
      
      const quotes = await fetchQuotes(inputToken, outputToken, amount);
      const raydiumQuote = quotes.find(q => q.dex === 'Raydium');
      const meteoraQuote = quotes.find(q => q.dex === 'Meteora');
      
      console.log(`   > Raydium: ${raydiumQuote?.outputAmount.toFixed(2)} ${outputToken}`);
      console.log(`   > Meteora: ${meteoraQuote?.outputAmount.toFixed(2)} ${outputToken}`);

      const bestRoute = quotes.reduce((prev, curr) => 
        (prev.outputAmount > curr.outputAmount) ? prev : curr
      );
      
      console.log(`[${shortId}] SELECTED: ${bestRoute.dex} (Best Price:${bestRoute.price})`);

      await updateStatus('routing', { 
        bestRoute: bestRoute.dex, 
        rate: bestRoute.price.toFixed(2)
      });

      await updateStatus('building', { message: `Constructing transaction for ${bestRoute.dex}...` });
      await new Promise(r => setTimeout(r, 2000)); 

      await updateStatus('submitted', { message: 'Sent to Solana network' });
      await new Promise(r => setTimeout(r, 2000)); 

      const txHash = '5x' + Math.random().toString(36).substring(7) + '...sol';
      const finalPayload = { 
        txHash, 
        finalAmount: bestRoute.outputAmount.toFixed(4),
        dex: bestRoute.dex
      };

      // 5. CONFIRMED
      await updateStatus('confirmed', finalPayload);
      console.log(`[${shortId}] CONFIRMED: ${txHash}`);
      await saveOrderToHistory(orderId, 'confirmed', finalPayload);

      return { status: 'completed', ...finalPayload };

    } catch (error: any) {
      const attempts = job.opts.attempts || 3;
      const isFinalAttempt = job.attemptsMade >= (attempts - 1);

      if (isFinalAttempt) {
        const failPayload = { error: error.message };
        await updateStatus('failed', failPayload);
        await saveOrderToHistory(orderId, 'failed', failPayload);
        console.log(`[${shortId}] FAILED: ${error.message}`);
      } else {
        console.log(`[${shortId}] RETRYING: Attempt ${job.attemptsMade + 1} failed.`);
        broadcastStatus(orderId, { 
          status: 'retrying', 
          message: `Attempt ${job.attemptsMade + 1} failed. Retrying...` 
        });
      }
      throw error;
    }
  }, { 
    connection,
    concurrency: 10, 
    limiter: { max: 100, duration: 60000 }
  });

  return worker;
};