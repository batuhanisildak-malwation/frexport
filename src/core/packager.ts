import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import archiver from 'archiver';
import type { AssetStore } from './asset-store.js';
import type { ExportReport } from '../types.js';

const README = `This is a static export of a Framer site, produced by frexport.

To deploy: upload the entire contents of this folder to any static host
(Netlify, Vercel, S3, GitHub Pages, Cloudflare Pages) or serve it locally:

    npx serve .
    # or
    python3 -m http.server

Every page is a real index.html, so deep links work with no extra config.
`;

export function routeToFilePath(route: string): string {
  const path = new URL(route, 'https://placeholder.invalid').pathname;
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? 'index.html' : `${trimmed}/index.html`;
}

export interface RouteHtml {
  route: string;
  html: string;
}

export async function writeSiteTree(
  workDir: string,
  routes: RouteHtml[],
  store: AssetStore,
  report: ExportReport,
): Promise<void> {
  for (const { route, html } of routes) {
    const rel = routeToFilePath(route);
    const full = join(workDir, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, html, 'utf8');
  }

  const assetsDir = join(workDir, 'assets');
  await mkdir(assetsDir, { recursive: true });
  for (const { localPath, body } of store.uniqueFiles()) {
    await writeFile(join(workDir, localPath), body);
  }

  await writeFile(join(workDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(join(workDir, 'README.txt'), README, 'utf8');
}

export async function zipDir(workDir: string, zipPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve());
    output.on('error', (err) => reject(err));
    archive.on('error', (err) => reject(err));
    archive.pipe(output);
    archive.directory(workDir, false);
    void archive.finalize();
  });
}
