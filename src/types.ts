export interface OrderRequest {
  inputToken: string;
  outputToken: string;
  amount: number;
}

export interface DexQuote {
  dex: 'Raydium' | 'Meteora';
  price: number;
  outputAmount: number;
  fee: number;
}