export interface Config {
  port: number;
  host: string;
  production: boolean;
  rateMax: number;
  rateWindow: string;
  maxConcurrent: number;
  maxQueue: number;
  maxPages: number;
  exportTimeoutMs: number;
  maxZipBytes: number;
  jobTtlMs: number;
}

type Env = Record<string, string | undefined>;

function int(env: Env, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function str(env: Env, key: string, fallback: string): string {
  const raw = env[key];
  return raw === undefined || raw.trim() === '' ? fallback : raw;
}

export function loadConfig(env: Env = process.env): Config {
  const production = env.NODE_ENV === 'production';
  return {
    port: int(env, 'PORT', 3000),
    host: str(env, 'HOST', production ? '0.0.0.0' : '127.0.0.1'),
    production,
    rateMax: int(env, 'RATE_MAX', 5),
    rateWindow: str(env, 'RATE_WINDOW', '10m'),
    maxConcurrent: int(env, 'MAX_CONCURRENT', 2),
    maxQueue: int(env, 'MAX_QUEUE', 20),
    maxPages: int(env, 'MAX_PAGES', 25),
    exportTimeoutMs: int(env, 'EXPORT_TIMEOUT_MS', 90000),
    maxZipBytes: int(env, 'MAX_ZIP_MB', 150) * 1024 * 1024,
    jobTtlMs: int(env, 'JOB_TTL_MS', 900000),
  };
}

export function describeConfig(c: Config): string {
  return [
    `host=${c.host}:${c.port}`,
    `prod=${c.production}`,
    `rate=${c.rateMax}/${c.rateWindow}`,
    `concurrency=${c.maxConcurrent} queue=${c.maxQueue}`,
    `maxPages=${c.maxPages} timeout=${c.exportTimeoutMs}ms`,
    `maxZip=${Math.round(c.maxZipBytes / 1024 / 1024)}MB ttl=${c.jobTtlMs}ms`,
  ].join(' ');
}
