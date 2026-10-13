const DEV_DEFAULT_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

/**
 * Parses the comma-separated CORS_ORIGINS value into normalised browser origins
 * (scheme://host[:port]). Throws on invalid entries so misconfiguration fails at
 * startup instead of surfacing later as opaque browser CORS errors.
 */
export function parseCorsOrigins(raw: string | undefined, nodeEnv: string | undefined): string[] {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    if (nodeEnv === 'production') {
      throw new Error('CORS_ORIGINS must list at least one origin in production');
    }
    return DEV_DEFAULT_ORIGINS;
  }

  return [...new Set(entries.map(toOrigin))];
}

function toOrigin(entry: string): string {
  if (!URL.canParse(entry)) {
    throw new Error(`Invalid CORS origin "${entry}": not an absolute URL`);
  }

  const url = new URL(entry);
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  const isBareOrigin = url.pathname === '/' && url.search === '' && url.hash === '';

  if (!isHttp || !isBareOrigin) {
    throw new Error(`Invalid CORS origin "${entry}": expected scheme://host[:port] with no path`);
  }

  return url.origin;
}
