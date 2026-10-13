import http, { type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { connectToDatabase } from '../../src/db/connection';
import { createShutdown } from '../../src/shutdown';
import { startTestDatabase, type TestDatabase } from '../helpers/database';

/** A server with a request that takes 200 ms and one that never answers. */
function startServer(): Promise<Server> {
  const server = http.createServer((req, res) => {
    if (req.url === '/slow') setTimeout(() => res.end('done'), 200);
    else if (req.url !== '/hang') res.end('ok');
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const portOf = (server: Server) => (server.address() as AddressInfo).port;

/** GET on a fresh connection (no keep-alive pool), resolving to status and body. */
function get(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path, agent: false }, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      })
      .on('error', reject);
  });
}

/** An exit() stand-in that records calls and lets the test await the first one. */
function fakeExit() {
  let resolveExited: (code: number) => void = () => {};
  const exited = new Promise<number>((resolve) => (resolveExited = resolve));
  const exit = jest.fn((code: number) => resolveExited(code));
  return { exit, exited };
}

describe('graceful shutdown', () => {
  let db: TestDatabase;
  let server: Server;

  beforeAll(async () => {
    db = await startTestDatabase();
  }, 120_000);

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    server = await startServer();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    server.closeAllConnections();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  });

  afterAll(async () => {
    await db.stop();
  });

  it('stops the HTTP server, then disconnects MongoDB, then exits 0', async () => {
    await connectToDatabase(db.uri);
    const order: string[] = [];
    server.on('close', () => order.push('http closed'));
    const { exit, exited } = fakeExit();
    const shutdown = createShutdown({
      server,
      closeResources: async () => {
        order.push('database closing');
        await mongoose.disconnect();
      },
      timeoutMs: 5_000,
      exit,
    });

    await shutdown('SIGTERM');

    expect(await exited).toBe(0);
    expect(order).toEqual(['http closed', 'database closing']);
    expect(server.listening).toBe(false);
    expect(mongoose.connection.readyState).toBe(mongoose.ConnectionStates.disconnected);
  });

  it('lets an in-flight request finish but refuses new connections', async () => {
    const { exit, exited } = fakeExit();
    const shutdown = createShutdown({ server, closeResources: async () => {}, timeoutMs: 5_000, exit });
    const port = portOf(server); // read before close: a closed server has no address
    const inFlight = get(port, '/slow');
    await new Promise((resolve) => setTimeout(resolve, 50)); // request is now being handled

    const stopping = shutdown('SIGTERM');

    await expect(get(port, '/')).rejects.toThrow(/ECONNREFUSED/);
    expect(await inFlight).toEqual({ status: 200, body: 'done' });
    await stopping;
    expect(await exited).toBe(0);
  });

  it('does the work once when SIGTERM and SIGINT both arrive', async () => {
    const closeResources = jest.fn(async () => {});
    const { exit } = fakeExit();
    const shutdown = createShutdown({ server, closeResources, timeoutMs: 5_000, exit });

    await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')]);

    expect(closeResources).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('forces exit 1 when a request never finishes within the timeout', async () => {
    const closeResources = jest.fn(async () => {});
    const { exit, exited } = fakeExit();
    const shutdown = createShutdown({ server, closeResources, timeoutMs: 150, exit });
    const hanging = get(portOf(server), '/hang').catch(() => 'socket closed by cleanup');
    await new Promise((resolve) => setTimeout(resolve, 50));

    void shutdown('SIGTERM');

    expect(await exited).toBe(1);
    expect(closeResources).not.toHaveBeenCalled();
    server.closeAllConnections();
    await hanging;
  });

  it('exits 1 when releasing resources fails', async () => {
    const { exit, exited } = fakeExit();
    const shutdown = createShutdown({
      server,
      closeResources: async () => {
        throw new Error('disconnect failed');
      },
      timeoutMs: 5_000,
      exit,
    });

    await shutdown('SIGTERM');

    expect(await exited).toBe(1);
  });
});
