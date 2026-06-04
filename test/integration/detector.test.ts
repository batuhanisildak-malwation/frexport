import { describe, it, expect } from 'vitest';
import { startFixture } from '../fixtures/server.js';
import { detectFramer } from '../../src/core/detector.js';

describe('detectFramer', () => {
  it('accepts a Framer-signed page', async () => {
    const fx = await startFixture();
    const result = await detectFramer(fx.base + '/');
    expect(result.ok).toBe(true);
    await fx.close();
  });

  it('rejects a non-Framer page', async () => {
    const fx = await startFixture();
    // serve a page with no framer signature by pointing at a bare 404-ish path that returns 'not found'
    // instead, test the explicit negative: a data: style minimal server. Simpler: use example.com.
    const result = await detectFramer('https://example.com');
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
    await fx.close();
  });

  it('rejects an unreachable url', async () => {
    const result = await detectFramer('http://127.0.0.1:1/');
    expect(result.ok).toBe(false);
  });
});
