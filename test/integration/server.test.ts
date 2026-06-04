import { describe, it, expect } from 'vitest';
import { buildServer } from '../../src/server/server.js';

describe('server', () => {
  it('accepts a url and returns a job id', async () => {
    const app = buildServer({ workRoot: '/tmp' });
    const res = await app.inject({ method: 'POST', url: '/export', payload: { url: 'https://example.com' } });
    expect(res.statusCode).toBe(200);
    const { jobId } = res.json();
    expect(typeof jobId).toBe('string');
    await app.close();
  });

  it('returns 400 when url is missing', async () => {
    const app = buildServer({ workRoot: '/tmp' });
    const res = await app.inject({ method: 'POST', url: '/export', payload: {} });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
