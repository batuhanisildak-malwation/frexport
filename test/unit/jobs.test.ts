import { describe, it, expect } from 'vitest';
import { JobRegistry } from '../../src/server/jobs.js';

describe('JobRegistry', () => {
  it('creates a job and buffers events for replay', () => {
    const reg = new JobRegistry();
    const id = reg.create();
    reg.push(id, { phase: 'detect', message: 'x' });
    const job = reg.get(id);
    expect(job?.events).toHaveLength(1);
  });

  it('notifies subscribers of new events', () => {
    const reg = new JobRegistry();
    const id = reg.create();
    const seen: string[] = [];
    reg.subscribe(id, (e) => seen.push(e.phase));
    reg.push(id, { phase: 'discover', found: 2, message: 'y' });
    expect(seen).toEqual(['discover']);
  });

  it('records completion with a zip path', () => {
    const reg = new JobRegistry();
    const id = reg.create();
    reg.complete(id, '/tmp/site.zip');
    expect(reg.get(id)?.zipPath).toBe('/tmp/site.zip');
    expect(reg.get(id)?.status).toBe('done');
  });
});
