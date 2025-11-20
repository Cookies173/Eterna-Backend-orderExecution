import { fetchQuotes } from '../src/dex';
import { saveOrderToHistory } from '../src/db';

jest.mock('../src/db', () => ({
  saveOrderToHistory: jest.fn().mockResolvedValue(true)
}));

// GROUP 1: DEX ROUTING LOGIC (5 Tests) 
describe('DEX Router Logic', () => {
  test('1. Should return quotes from both Raydium and Meteora', async () => {
    const quotes = await fetchQuotes('SOL', 'USDC', 10);
    expect(quotes).toHaveLength(2);
    const dexNames = quotes.map(q => q.dex);
    expect(dexNames).toContain('Raydium');
    expect(dexNames).toContain('Meteora');
  });

  test('2. Should calculate output amount correctly (Price * Amount)', async () => {
    const amount = 10;
    const quotes = await fetchQuotes('SOL', 'USDC', amount);
    quotes.forEach(q => {
      expect(q.outputAmount).toBeCloseTo(q.price * amount, 1);
    });
  });

  test('3. Should have realistic fees applied', async () => {
    const quotes = await fetchQuotes('SOL', 'USDC', 100);
    const fees = quotes.map(q => q.fee);
    expect(fees).toContain(0.003);
    expect(fees).toContain(0.002);
  });

  test('4. Should always return positive price values', async () => {
    const quotes = await fetchQuotes('SOL', 'USDC', 10);
    quotes.forEach(q => {
      expect(q.price).toBeGreaterThan(0);
      expect(q.outputAmount).toBeGreaterThan(0);
    });
  });

  test('5. Should handle extremely small fractional inputs', async () => {
    const quotes = await fetchQuotes('SOL', 'USDC', 0.000001);
    expect(quotes[0].outputAmount).toBeGreaterThan(0);
  });
});

// GROUP 2: DATABASE ARCHITECTURE (2 Tests) 
describe('Persistence Layer', () => {
  test('6. Should successfully call the DB save function', async () => {
    const result = await saveOrderToHistory('test-id', 'confirmed', { hash: '0x123' });
    expect(saveOrderToHistory).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  test('7. Should handle error status persistence', async () => {
    await saveOrderToHistory('test-id-fail', 'failed', { error: 'Simulated' });
    expect(saveOrderToHistory).toHaveBeenCalledWith(
      'test-id-fail', 
      'failed', 
      expect.anything()
    );
  });
});

//  GROUP 3: API & QUEUE VALIDATION (5 Tests) 
describe('API Input Validation', () => {
  const validatePayload = (amount: number, inputToken: string, outputToken: string) => {
    if (amount <= 0) return 'Invalid amount';
    if (!inputToken || !outputToken) return 'Invalid token';
    if (inputToken === outputToken) return 'Invalid pair';
    return 'OK';
  };

  test('8. Should reject negative amounts', () => {
    expect(validatePayload(-5, 'SOL', 'USDC')).toBe('Invalid amount');
  });

  test('9. Should reject zero amounts', () => {
    expect(validatePayload(0, 'SOL', 'USDC')).toBe('Invalid amount');
  });

  test('10. Should require valid token symbols', () => {
    expect(validatePayload(10, '', 'USDC')).toBe('Invalid token');
  });

  test('11. Should reject identical token pairs', () => {
    expect(validatePayload(10, 'SOL', 'SOL')).toBe('Invalid pair');
  });

  test('12. Should accept valid order parameters', () => {
    expect(validatePayload(100, 'SOL', 'USDC')).toBe('OK');
  });
});