// Imported first by component tests, before React DOM loads: gives React a document
// (happy-dom). happy-dom also replaces fetch and AbortController with its own, so Node's
// are put back; the app's API client must be tested against the real ones.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const { fetch, Request, Response, Headers, AbortController, AbortSignal } = globalThis;
GlobalRegistrator.register({ url: "http://localhost:3001/" });

const restored = { fetch, Request, Response, Headers, AbortController, AbortSignal };
for (const [name, value] of Object.entries(restored)) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

// Tells React this is a test environment, so act() applies updates before returning.
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true, writable: true });
