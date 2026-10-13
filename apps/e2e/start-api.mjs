// Starts the real API (the server's production entrypoint) for browser tests, against a
// fresh in-memory MongoDB replica set. PORT and CORS_ORIGINS come from playwright.config.ts;
// everything else is set here, so no .env file or real database can be picked up. The
// database's mongod is stopped by mongodb-memory-server when this process ends.
import { randomBytes } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";

if (!process.env.PORT || !process.env.CORS_ORIGINS) throw new Error("Start this through playwright.config.ts");

// A replica set, like Atlas: payouts run in transactions, which need one.
const database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const uri = database.getUri("memed_e2e");
if (new URL(uri).hostname !== "127.0.0.1") throw new Error("Refusing to run browser tests against a non-local database");

Object.assign(process.env, {
  NODE_ENV: "production",
  MONGODB_URI: uri,
  JWT_SECRET: randomBytes(32).toString("hex"),
});

await import("../server/dist/index.js");
