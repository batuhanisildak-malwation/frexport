import { describe, it, expect } from 'vitest';
import { startFixture } from '../fixtures/server.js';
import { detectFramer } from '../../src/core/detector.js';

// Test seam: an injected resolver makes the guard treat the loopback fixture as
// public (production never injects `resolve`, so real loopback stays blocked).
const allowLoopback = { resolve: async (): Promise<string[]> => ['8.8.8.8'] };

describe('detectFramer', () => {
  it('blocks a loopback url by default (SSRF guard)', async () => {
    const fx = await startFixture();
    const result = await detectFramer(fx.base + '/');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/blocked|private|unreachable/i);
    await fx.close();
  });

  it('accepts a Framer-signed page when the guard permits the host', async () => {
    const fx = await startFixture();
    const result = await detectFramer(fx.base + '/', allowLoopback);
    expect(result.ok).toBe(true);
    await fx.close();
  });

  it('rejects a non-Framer page', async () => {
    const result = await detectFramer('https://example.com');
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('rejects an unreachable url', async () => {
    const result = await detectFramer('http://127.0.0.1:1/', allowLoopback);
    expect(result.ok).toBe(false);
  });
});
