import {Pool} from 'pg'
import dotenv from 'dotenv';

dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('Connected to Supabase Postgres');
});
pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

export const saveOrderToHistory = async (orderId: string, status: string, details: any) => {
  try {
    const query = `
      INSERT INTO orders (order_id, status, details, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (order_id) 
      DO UPDATE SET status = $2, details = $3;
    `;
    await pool.query(query, [orderId, status, details]);
    console.log(`[DB] Order ${orderId} saved/updated in Supabase.`);
    return true;
  } catch (error) {
    console.error('[DB] Error saving order:', error);
    return false;
  }
};