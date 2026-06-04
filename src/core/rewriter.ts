import type { AssetStore } from './asset-store.js';
import { relativeFromRoute } from './url-utils.js';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const URL_CONT = `A-Za-z0-9._~:/?#\\[\\]@!$&*+,;=%-`;
const URL_TAIL = `(?![${URL_CONT}])`;
const URL_HEAD = `(?<![${URL_CONT}])`;

function rootRelativeForm(url: string, siteOrigin: string): string | null {
  try {
    const u = new URL(url);
    if (u.origin !== siteOrigin) return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}

function siblingPath(localPath: string): string {
  return './' + localPath.slice(localPath.lastIndexOf('/') + 1);
}

function urlDir(url: string): string | null {
  try {
    return new URL('.', url).toString();
  } catch {
    return null;
  }
}

const MODULE_EXTS = new Set(['js', 'mjs']);

function extOf(localPath: string): string {
  return localPath.slice(localPath.lastIndexOf('.') + 1);
}

export function rewriteAsset(
  text: string,
  store: AssetStore,
  assetUrl: string,
  assetLocalPath: string,
): string {
  const assetExt = extOf(assetLocalPath);
  const isCss = assetExt === 'css';
  const isModule = MODULE_EXTS.has(assetExt);
  if (!isCss && !isModule) return text;

  const assetDir = urlDir(assetUrl);
  let out = text;

  for (const entry of store.entries()) {
    const targetExt = extOf(entry.localPath);
    if (isModule && !MODULE_EXTS.has(targetExt)) continue;
    if (isModule && entry.localPath.endsWith('.html')) continue;

    const sibling = siblingPath(entry.localPath);
    const url = entry.originalUrl;

    out = out.replace(new RegExp(escapeRegExp(url) + URL_TAIL, 'g'), sibling);

    const protoRel = url.replace(/^https?:/, '');
    out = out.replace(new RegExp(URL_HEAD + escapeRegExp(protoRel) + URL_TAIL, 'g'), sibling);

    if (assetDir && urlDir(url) === assetDir) {
      const base = url.slice(url.lastIndexOf('/') + 1);
      out = out.replace(new RegExp(URL_HEAD + escapeRegExp('./' + base) + URL_TAIL, 'g'), sibling);
    }
  }
  return out;
}

export function rewriteText(
  text: string,
  store: AssetStore,
  route: string,
  siteOrigin?: string,
): string {
  let out = text;
  for (const entry of store.entries()) {
    if (entry.localPath.endsWith('.html')) continue;

    const local = relativeFromRoute(route, entry.localPath);
    const url = entry.originalUrl;

    const absPattern = new RegExp(escapeRegExp(url) + URL_TAIL, 'g');
    out = out.replace(absPattern, local);

    const protoRel = url.replace(/^https?:/, '');
    const relPattern = new RegExp(URL_HEAD + escapeRegExp(protoRel) + URL_TAIL, 'g');
    out = out.replace(relPattern, local);

    if (siteOrigin) {
      const rootRel = rootRelativeForm(url, siteOrigin);
      if (rootRel) {
        const rootPattern = new RegExp(URL_HEAD + escapeRegExp(rootRel) + URL_TAIL, 'g');
        out = out.replace(rootPattern, local);
      }
    }
  }
  return out;
}
