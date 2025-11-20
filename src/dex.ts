import { DexQuote } from './types';

const latencyy = 100; 

const getRandomPrice = (basePrice: number) => {
  const variance = basePrice * 0.02; 
  return basePrice + (Math.random() * variance * 2 - variance);
};

export const fetchQuotes = async (
  inputToken: string,
  outputToken: string,
  amount: number
): Promise<DexQuote[]> => {
  await new Promise((resolve) => setTimeout(resolve, latencyy));
  const baseRate = 150; 
  const rPrice = getRandomPrice(baseRate);
  const mPrice = getRandomPrice(baseRate);
  return [
    {
      dex: 'Raydium',
      price: rPrice,
      outputAmount: amount * rPrice, 
      fee: 0.003
    },
    {
      dex: 'Meteora',
      price: mPrice,
      outputAmount: amount * mPrice, 
      fee: 0.002
    }
  ];
};