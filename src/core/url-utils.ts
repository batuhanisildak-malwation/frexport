export function normalizeRoute(url: string, base?: string): string {
  const u = new URL(url, base);
  u.search = '';
  u.hash = '';
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

export function isSameOrigin(url: string, base: string): boolean {
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

export function routeToOutputDir(route: string): string {
  const path = new URL(route, 'https://placeholder.invalid').pathname;
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed;
}

export function relativeFromRoute(route: string, assetPathFromRoot: string): string {
  const dir = routeToOutputDir(route);
  const depth = dir === '' ? 0 : dir.split('/').length;
  const prefix = depth === 0 ? '' : '../'.repeat(depth);
  return prefix + assetPathFromRoot;
}
