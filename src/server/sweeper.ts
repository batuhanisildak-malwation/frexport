import { unlink } from 'node:fs/promises';
import type { JobRegistry } from './jobs.js';

type Unlinker = (path: string) => Promise<void>;

const safeUnlink: Unlinker = async (p) => { await unlink(p).catch(() => {}); };

export async function sweepOnce(
  registry: JobRegistry,
  ttlMs: number,
  now: number,
  unlinker: Unlinker = safeUnlink,
): Promise<number> {
  let removed = 0;
  for (const job of registry.list()) {
    const finished = job.status === 'done' || job.status === 'error';
    if (!finished || job.finishedAt === undefined) continue;
    if (now - job.finishedAt < ttlMs) continue;
    if (job.zipPath) await unlinker(job.zipPath);
    registry.remove(job.id);
    removed++;
  }
  return removed;
}

export function startSweeper(
  registry: JobRegistry,
  ttlMs: number,
  intervalMs = Math.max(30_000, Math.floor(ttlMs / 5)),
): () => void {
  const timer = setInterval(() => {
    void sweepOnce(registry, ttlMs, Date.now());
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
