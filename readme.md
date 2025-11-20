# **Distributed Order Execution Engine**

A high-throughput backend system for executing market orders on Solana. It features a mock DEX router (Raydium/Meteora), a persistent job queue with exponential backoff, and real-time WebSocket status streaming.

## 🚀 **Public Demo**

- *Live API URL*: https://eterna-backend-orderexecution.onrender.com/api/orders/execute

- *Video Demo*: http:yt/

## 🏗 **Architecture**

**High-Level Flow**

1. API (Producer): Fastify Server accepts HTTP POST -> Validates -> Pushes to Redis Queue.

2. Queue (Broker): BullMQ manages concurrency (10 concurrent jobs), rate limiting (100/min), and retries (exponential backoff).

3. Engine (Consumer): Worker pulls jobs -> Routes via DEX -> "Executes" -> Updates Redis & Postgres.

4. Stream: Real-time status updates are pushed to the client via WebSockets.


Tech Stack
- Runtime: Node.js + TypeScript

- Queue: BullMQ + Redis (Cloud)

- Database: PostgreSQL (Supabase or Render)

- API: Fastify (WebSocket support)

## 🧠 Design Decisions

**[1]** **Mock vs. Real Execution**

Choice: Mock Implementation.

Reasoning:

- **Reliability**: Solana Devnet liquidity pools are often unstable or empty, leading to flaky integration tests. A mock router allows for deterministic testing of race conditions and queue behavior.

- **Performance**: Allows stress-testing the queue (1000+ orders) without hitting public RPC rate limits.

- **Focus**: Prioritized backend architecture (Concurrency, State Management, Retries) over blockchain SDK specificities.

**[2] Data Persistence**

- **Redis**: Used for short-term job state and queue management (speed).

- **PostgreSQL**: Used for long-term order history and audit trails (reliability).

- **Pattern**: Orders are "Upserted" to handle potential duplicate delivery from the queue.

**[3] Retry Strategy**

- Implemented Exponential Backoff (2s, 4s, 8s) to handle transient network failures gracefully.

- Failed jobs are persisted to Postgres with the error reason for post-mortem analysis.

**🛠 Setup & Installation**

**Prerequisites**

- Node.js v18+

- Redis Cloud Account (Free Tier)

- Supabase or Render Account  (Free Tier)

**1. Install Dependencies**

    npm install


**2. Environment Configuration**


    REDIS_HOST=your-redis-cloud-host
    REDIS_PORT=your-redis-port
    REDIS_PASSWORD=your-redis-password
    REDIS_TLS=false
    DATABASE_URL=your-supabase-connection-string


**3. Run Locally**

    npm run dev


**4. Run Tests**

Runs 12 unit and integration tests covering Routing, Validation, and Architecture.

    npm test


## **📡 API Documentation**

**Submit Order**

- POST /api/orders/execute    

        {
        "inputToken": "SOL",
        "outputToken": "USDC",
        "amount": 50
        }


**WebSocket Stream**

- **URL**: ws://eterna-backend-orderexecution.onrender.com/ws/orders/{orderId}

**Events:**

- *pending*: Order queued.

- *routing*: Router scanning Raydium/Meteora.

- *building*: Constructing transaction.

- *submitted*: Sent to network.

- *confirmed*: Execution successful (includes Hash).

- *failed*: Execution failed (includes Error).



## 📝 **Sample Terminal Output**

When running the engine with concurrent orders, you will see real-time price comparison and state transitions in your console:

    [1a6d88f5] SELECTED: Meteora (Best Price:147.70740692387747)
    [1c111b47] SUBMITTED
    [1a6d88f5] BUILDING
    [1c111b47] CONFIRMED
    [1c111b47] CONFIRMED: 5xannaai...sol
    [DB] Order 1c111b47-e9b3-4d5f-87aa-9013360169a7 saved/updated in Supabase.
    [1a6d88f5] SUBMITTED
    [1a6d88f5] CONFIRMED
    [1a6d88f5] CONFIRMED: 5xhno6i8...sol
    [DB] Order 1a6d88f5-9a35-4315-8de5-7d4b4ca8d305 saved/updated in Supabase.


