import { randomUUID } from 'node:crypto';
import type { ProgressEvent } from '../types.js';

type Subscriber = (e: ProgressEvent) => void;

export interface Job {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  events: ProgressEvent[];
  subscribers: Set<Subscriber>;
  zipPath?: string;
  createdAt: number;
  finishedAt?: number;
}

export class JobRegistry {
  private jobs = new Map<string, Job>();

  constructor(private now: () => number = () => Date.now()) {}

  create(): string {
    const id = randomUUID();
    this.jobs.set(id, {
      id, status: 'queued', events: [], subscribers: new Set(), createdAt: this.now(),
    });
    return id;
  }

  get(id: string): Job | undefined { return this.jobs.get(id); }
  list(): Job[] { return [...this.jobs.values()]; }
  remove(id: string): Job | undefined {
    const job = this.jobs.get(id);
    if (job) this.jobs.delete(id);
    return job;
  }

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

  markRunning(id: string): void {
    const job = this.jobs.get(id);
    if (job) job.status = 'running';
  }

  complete(id: string, zipPath: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'done';
    job.zipPath = zipPath;
    job.finishedAt = this.now();
  }

  fail(id: string): void {
    const job = this.jobs.get(id);
    if (job) { job.status = 'error'; job.finishedAt = this.now(); }
  }
}
