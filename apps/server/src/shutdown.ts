import type { Server } from 'node:http';

export interface ShutdownOptions {
  server: Server;
  /** Releases what the requests use (the database connection) once HTTP has stopped. */
  closeResources: () => Promise<void>;
  /** Upper bound, so a stuck request or connection cannot keep the process alive. */
  timeoutMs: number;
  exit: (code: number) => void;
}

/**
 * Builds a shutdown handler that runs once however many signals arrive: it stops
 * accepting connections, lets in-flight requests finish (idle keep-alive sockets
 * are closed), then releases resources and exits 0. Anything still running after
 * timeoutMs, or any failure, exits 1 instead.
 */
export function createShutdown({ server, closeResources, timeoutMs, exit }: ShutdownOptions) {
  let started = false;

  return async function shutdown(signal: string): Promise<void> {
    if (started) return;
    started = true;
    console.log(`${signal} received: closing the HTTP server, then the database connection`);

    const deadline = setTimeout(() => {
      console.error(`Shutdown did not finish within ${timeoutMs} ms; forcing exit`);
      exit(1);
    }, timeoutMs);
    deadline.unref();

    try {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await closeResources();
      clearTimeout(deadline);
      exit(0);
    } catch (error) {
      clearTimeout(deadline);
      console.error(`Shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
      exit(1);
    }
  };
}
