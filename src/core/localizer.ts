import type { LocalizeDecision } from '../types.js';
import { isSameOrigin } from './url-utils.js';

const LOCALIZE_HOSTS = [
  'framerusercontent.com',
  'framerstatic.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

export function decideLocalization(url: string, siteUrl: string): LocalizeDecision {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { kind: 'external', reason: 'unparseable url' };
  }
  if (isSameOrigin(url, siteUrl)) return { kind: 'localize' };
  if (LOCALIZE_HOSTS.some((h) => host === h || host.endsWith('.' + h))) {
    return { kind: 'localize' };
  }
  return { kind: 'external', reason: 'live third-party' };
}
