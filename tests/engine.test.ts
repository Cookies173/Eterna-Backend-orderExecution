import { fetchQuotes } from '../src/dex';

describe('DEX Routing Logic', () => {
  
  test('Should return quotes from both Raydium and Meteora', async () => {
    const quotes = await fetchQuotes('SOL', 'USDC', 10);
    expect(quotes).toHaveLength(2);
    
    const dexNames = quotes.map(q => q.dex);
    expect(dexNames).toContain('Raydium');
    expect(dexNames).toContain('Meteora');
  });

  test('Should calculate output amount based on price', async () => {
    const amount = 10;
    const quotes = await fetchQuotes('SOL', 'USDC', amount);
    
    quotes.forEach(quote => {
      const expected = quote.price * amount;
      expect(quote.outputAmount).toBeCloseTo(expected, 1);
    });
  });

  test('Should always return positive values', async () => {
    const quotes = await fetchQuotes('SOL', 'USDC', 10);
    quotes.forEach(quote => {
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.outputAmount).toBeGreaterThan(0);
    });
  });

  test('Should handle small amounts correctly', async () => {
    const quotes = await fetchQuotes('SOL', 'USDC', 0.01);
    expect(quotes.length).toBe(2);
  });
});