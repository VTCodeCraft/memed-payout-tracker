// Run before the browser tests build the frontend. The .next folder outlives builds: Turbo
// restores a cached build on top of it without removing anything, and `next start` writes
// rendered pages into it at runtime, so pages from an earlier build could be served instead
// of the current source's. Everything except next dev's folder and Next's build cache goes.
import { existsSync, readdirSync, rmSync } from "node:fs";

const buildFolder = new URL("../frontend/.next/", import.meta.url);
const KEEP = new Set(["dev", "cache"]);

if (existsSync(buildFolder)) {
  for (const entry of readdirSync(buildFolder)) {
    // Retries cover Windows briefly locking files (EBUSY/EPERM), e.g. while OneDrive syncs.
    if (!KEEP.has(entry)) rmSync(new URL(entry, buildFolder), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
