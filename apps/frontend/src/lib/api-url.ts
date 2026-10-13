const LOCAL_API_URL = "http://localhost:4000";

/**
 * Builds `<API origin>/api/<endpoint>` for requests to the Express API.
 *
 * Trailing slashes or a trailing `/api` on the base, and a leading slash or
 * `api/` prefix on the endpoint, are tolerated so the result always contains
 * exactly one `/api` segment. The base defaults to NEXT_PUBLIC_API_URL, which
 * Next.js inlines at build time; an unset or empty value means local dev.
 */
export function apiUrl(
  endpoint: string,
  apiBase: string = process.env.NEXT_PUBLIC_API_URL || LOCAL_API_URL,
): string {
  const origin = apiBase.trim().replace(/\/+$/, "").replace(/\/api$/i, "");
  const path = endpoint.trim().replace(/^\/+/, "").replace(/^api(\/|$)/i, "");
  return `${origin}/api/${path}`;
}
