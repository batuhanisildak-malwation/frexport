import { describe, it, expect } from 'vitest';
import { JobRegistry } from '../../src/server/jobs.js';
import { sweepOnce } from '../../src/server/sweeper.js';

describe('sweepOnce', () => {
  it('removes finished jobs older than ttl and unlinks their zips', async () => {
    let clock = 1000;
    const reg = new JobRegistry(() => clock);
    const id = reg.create();
    reg.complete(id, '/tmp/does-not-matter.zip'); // finishedAt = 1000
    clock = 1000 + 901_000; // ttl is 900_000

    const unlinked: string[] = [];
    const removed = await sweepOnce(reg, 900_000, clock, async (p) => { unlinked.push(p); });

    expect(removed).toBe(1);
    expect(reg.get(id)).toBeUndefined();
    expect(unlinked).toEqual(['/tmp/does-not-matter.zip']);
  });

  it('leaves running and fresh jobs alone', async () => {
    let clock = 5000;
    const reg = new JobRegistry(() => clock);
    const running = reg.create(); reg.markRunning(running);
    const fresh = reg.create(); reg.complete(fresh, '/tmp/fresh.zip'); // finishedAt = 5000
    clock = 5000 + 10_000; // well under ttl

    const removed = await sweepOnce(reg, 900_000, clock, async () => {});
    expect(removed).toBe(0);
    expect(reg.get(running)).toBeDefined();
    expect(reg.get(fresh)).toBeDefined();
  });

  it('keeps a job just under the ttl, removes it at the ttl boundary', async () => {
    const reg = new JobRegistry(() => 2000);
    const job = reg.create();
    reg.complete(job, '/tmp/a.zip'); // finishedAt = 2000

    // elapsed = ttl - 1 (< ttl) → kept
    expect(await sweepOnce(reg, 900_000, 2000 + 899_999, async () => {})).toBe(0);
    expect(reg.get(job)).toBeDefined();

    // elapsed = ttl exactly (>= ttl) → removed (half-open boundary)
    expect(await sweepOnce(reg, 900_000, 2000 + 900_000, async () => {})).toBe(1);
    expect(reg.get(job)).toBeUndefined();
  });
});
