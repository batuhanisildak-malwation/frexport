import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import { JobRegistry } from './jobs.js';
import { Gate, type Ticket } from './gate.js';
import { startSweeper } from './sweeper.js';
import { assertPublicUrl } from './url-guard.js';
import { runExport as realRunExport } from '../core/pipeline.js';
import type { ExportOptions, ExportResult } from '../core/pipeline.js';
import type { Config } from '../config.js';
import { loadConfig } from '../config.js';
import type { ProgressEvent } from '../types.js';

export interface ServerOptions {
  config?: Config;
  runExport?: (opts: ExportOptions) => Promise<ExportResult>;
}

export function buildServer(opts: ServerOptions = {}): FastifyInstance {
  const config = opts.config ?? loadConfig();
  const runExport = opts.runExport ?? realRunExport;

  const app = Fastify({ logger: config.production, trustProxy: true });
  const jobs = new JobRegistry();
  const gate = new Gate(config.maxConcurrent, config.maxQueue);

  const stopSweeper = startSweeper(jobs, config.jobTtlMs);
  app.addHook('onClose', async () => { stopSweeper(); });

  const webDir = fileURLToPath(new URL('../../web', import.meta.url));
  void app.register(fastifyStatic, { root: webDir, prefix: '/' });

  app.get('/healthz', async (_req, reply) => reply.send({ ok: true }));

  void app.register(async (instance) => {
    await instance.register(rateLimit, {
      global: false,
      max: config.rateMax,
      timeWindow: config.rateWindow,
    });

    instance.post<{ Body: { url?: string } }>(
      '/export',
      { config: { rateLimit: { max: config.rateMax, timeWindow: config.rateWindow } } },
      async (req, reply) => {
      const url = req.body?.url;
      if (!url || typeof url !== 'string') {
        return reply.code(400).send({ error: 'url is required' });
      }
      try {
        await assertPublicUrl(url);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }

      let ticket: Ticket;
      try {
        ticket = await gate.acquire();
      } catch {
        return reply.code(503).send({ error: 'server busy, try again shortly' });
      }

      const jobId = jobs.create();
      if (ticket.position > 0) {
        jobs.push(jobId, { phase: 'queued', position: ticket.position, message: 'Waiting for a free slot…' });
      }

      void (async () => {
        try {
          jobs.markRunning(jobId);
          const work = await mkdtemp(join(tmpdir(), `frexport-${jobId}-`));
          const onProgress = (e: ProgressEvent): void => jobs.push(jobId, e);
          const { zipPath, report } = await runExport({
            url, workDir: work,
            concurrency: config.maxConcurrent,
            maxPages: config.maxPages,
            timeoutMs: config.exportTimeoutMs,
            maxZipBytes: config.maxZipBytes,
            onProgress,
          });
          jobs.complete(jobId, zipPath);
          jobs.push(jobId, { phase: 'done', downloadUrl: `/export/${jobId}/download`, report });
        } catch (err) {
          jobs.fail(jobId);
          jobs.push(jobId, { phase: 'error', message: (err as Error).message });
        } finally {
          ticket.release();
        }
      })();

      return reply.send({ jobId });
    },
    );
  });

  app.get<{ Params: { id: string } }>('/export/:id/events', (req, reply) => {
    const { id } = req.params;
    const job = jobs.get(id);
    if (!job) return reply.code(404).send({ error: 'no such job' });

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });

    const send = (e: ProgressEvent): void => { reply.raw.write(`data: ${JSON.stringify(e)}\n\n`); };
    for (const e of job.events) send(e);
    const unsubscribe = jobs.subscribe(id, send);
    req.raw.on('close', () => unsubscribe());
  });

  app.get<{ Params: { id: string } }>('/export/:id/download', (req, reply) => {
    const job = jobs.get(req.params.id);
    if (!job?.zipPath) return reply.code(404).send({ error: 'not ready' });
    reply.header('content-type', 'application/zip');
    reply.header('content-disposition', 'attachment; filename="site.zip"');
    return reply.send(createReadStream(job.zipPath));
  });

  return app;
}
