import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  it('applies locked defaults when env is empty', () => {
    const c = loadConfig({});
    expect(c.port).toBe(3000);
    expect(c.host).toBe('127.0.0.1'); // non-production default
    expect(c.rateMax).toBe(5);
    expect(c.rateWindow).toBe('10m');
    expect(c.maxConcurrent).toBe(2);
    expect(c.maxQueue).toBe(20);
    expect(c.maxPages).toBe(25);
    expect(c.exportTimeoutMs).toBe(90000);
    expect(c.maxZipBytes).toBe(150 * 1024 * 1024);
    expect(c.jobTtlMs).toBe(900000);
    expect(c.production).toBe(false);
  });

  it('binds 0.0.0.0 by default in production', () => {
    const c = loadConfig({ NODE_ENV: 'production' });
    expect(c.host).toBe('0.0.0.0');
    expect(c.production).toBe(true);
  });

  it('honors explicit overrides', () => {
    const c = loadConfig({ PORT: '8080', MAX_PAGES: '40', HOST: '0.0.0.0' });
    expect(c.port).toBe(8080);
    expect(c.maxPages).toBe(40);
    expect(c.host).toBe('0.0.0.0');
  });

  it('falls back to defaults on non-numeric input', () => {
    const c = loadConfig({ MAX_PAGES: 'banana', EXPORT_TIMEOUT_MS: '' });
    expect(c.maxPages).toBe(25);
    expect(c.exportTimeoutMs).toBe(90000);
  });

  it('falls back to defaults on zero or negative input', () => {
    const c = loadConfig({ PORT: '-1', MAX_CONCURRENT: '0' });
    expect(c.port).toBe(3000);
    expect(c.maxConcurrent).toBe(2);
  });

  it('floors fractional numeric input', () => {
    const c = loadConfig({ MAX_PAGES: '25.9' });
    expect(c.maxPages).toBe(25);
  });
});
