import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { JobRegistry } from './jobs.js';
import { runExport } from '../core/pipeline.js';
import type { ProgressEvent } from '../types.js';

export interface ServerOptions {
  workRoot?: string;
}

export function buildServer(_opts: ServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const jobs = new JobRegistry();

  const webDir = fileURLToPath(new URL('../../web', import.meta.url));
  app.register(fastifyStatic, { root: webDir, prefix: '/' });

  app.post<{ Body: { url?: string } }>('/export', async (req, reply) => {
    const url = req.body?.url;
    if (!url || typeof url !== 'string') {
      return reply.code(400).send({ error: 'url is required' });
    }
    const jobId = jobs.create();

    void (async () => {
      try {
        const work = await mkdtemp(join(tmpdir(), `frexport-${jobId}-`));
        const onProgress = (e: ProgressEvent) => jobs.push(jobId, e);
        const { zipPath, report } = await runExport({
          url, workDir: work, concurrency: 3, maxPages: 200, onProgress,
        });
        jobs.complete(jobId, zipPath);
        jobs.push(jobId, { phase: 'done', downloadUrl: `/export/${jobId}/download`, report });
      } catch (err) {
        jobs.fail(jobId);
        jobs.push(jobId, { phase: 'error', message: (err as Error).message });
      }
    })();

    return reply.send({ jobId });
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

    const send = (e: ProgressEvent) => reply.raw.write(`data: ${JSON.stringify(e)}\n\n`);
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
