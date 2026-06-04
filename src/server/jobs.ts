import { randomUUID } from 'node:crypto';
import type { ProgressEvent } from '../types.js';

type Subscriber = (e: ProgressEvent) => void;

interface Job {
  id: string;
  status: 'running' | 'done' | 'error';
  events: ProgressEvent[];
  subscribers: Set<Subscriber>;
  zipPath?: string;
}

export class JobRegistry {
  private jobs = new Map<string, Job>();

  create(): string {
    const id = randomUUID();
    this.jobs.set(id, { id, status: 'running', events: [], subscribers: new Set() });
    return id;
  }

  get(id: string): Job | undefined { return this.jobs.get(id); }

  push(id: string, event: ProgressEvent): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.events.push(event);
    for (const sub of job.subscribers) sub(event);
  }

  subscribe(id: string, sub: Subscriber): () => void {
    const job = this.jobs.get(id);
    if (!job) return () => {};
    job.subscribers.add(sub);
    return () => job.subscribers.delete(sub);
  }

  complete(id: string, zipPath: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'done';
    job.zipPath = zipPath;
  }

  fail(id: string): void {
    const job = this.jobs.get(id);
    if (job) job.status = 'error';
  }
}
