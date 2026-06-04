import { describe, it, expect } from 'vitest';
import { Gate } from '../../src/server/gate.js';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('Gate', () => {
  it('admits up to maxConcurrent immediately', async () => {
    const g = new Gate(2, 10);
    const a = await g.acquire();
    const b = await g.acquire();
    expect(a.position).toBe(0);
    expect(b.position).toBe(0);
    expect(g.active).toBe(2);
  });

  it('queues callers beyond capacity and releases in order', async () => {
    const g = new Gate(1, 10);
    const first = await g.acquire();
    let secondAcquired = false;
    const secondP = g.acquire().then((t) => { secondAcquired = true; return t; });
    await tick();
    expect(secondAcquired).toBe(false);
    expect(g.queued).toBe(1);
    first.release();
    const second = await secondP;
    expect(secondAcquired).toBe(true);
    second.release();
  });

  it('rejects when the queue is full', async () => {
    const g = new Gate(1, 1);
    const t = await g.acquire();      // active
    const queuedP = g.acquire();      // fills the 1 queue slot
    await tick();
    await expect(g.acquire()).rejects.toThrow(/busy|full/i); // overflow
    t.release();
    await queuedP.then((x) => x.release());
  });

  it('treats a double release as a no-op (idempotent)', async () => {
    const g = new Gate(1, 10);
    const a = await g.acquire();
    a.release();
    a.release(); // must not double-decrement or double-promote
    expect(g.active).toBe(0);
    expect(g.queued).toBe(0);
    const b = await g.acquire(); // a fresh slot is still cleanly available
    expect(b.position).toBe(0);
    expect(g.active).toBe(1);
    b.release();
  });
});
