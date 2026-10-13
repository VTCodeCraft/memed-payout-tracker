import { useSyncExternalStore } from "react";
import { ApiError, apiRequest } from "./api-client.ts";

export const ROLES = ["brand", "creator"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return ROLES.some((role) => role === value);
}

/** The user object the API returns from signup, login and /auth/me. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

/** What the browser keeps between visits: the token plus what routing and the header need. */
export interface Session {
  token: string;
  user: Pick<User, "id" | "name" | "role">;
}

/** Thrown when the browser refuses site storage, so a session cannot be kept. */
export class SessionStorageError extends Error {
  constructor() {
    super("This browser is blocking site storage, so you can't stay signed in. Allow site data for this site and try again.");
    this.name = "SessionStorageError";
  }
}

const SESSION_KEY = "memed.session";
const listeners = new Set<() => void>();

// Accessing localStorage throws when the browser blocks storage, and it does not exist
// during server rendering; both mean "no storage".
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  try {
    return storage()?.getItem(SESSION_KEY) ?? null;
  } catch {
    return null;
  }
}

/** A stored value that is not a well-formed session (edited, corrupted, old format) counts as signed out. */
export function parseSession(raw: string | null): Session | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || !("token" in value) || !("user" in value)) return null;
  const { token, user } = value;
  if (typeof token !== "string" || token === "" || typeof user !== "object" || user === null) return null;
  if (!("id" in user) || !("name" in user) || !("role" in user)) return null;
  const { id, name, role } = user;
  if (typeof id !== "string" || typeof name !== "string" || !isRole(role)) return null;
  return { token, user: { id, name, role } };
}

// useSyncExternalStore needs the same object back while nothing has changed, so the
// parsed session is cached against the raw string it came from.
let cachedRaw: string | null = null;
let cachedSession: Session | null = null;

/** The session stored in this browser, or null when signed out or storage is unavailable. */
export function getSession(): Session | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = parseSession(raw);
  }
  return cachedSession;
}

function toSession(token: string, user: Session["user"]): Session {
  return { token, user: { id: user.id, name: user.name, role: user.role } };
}

/** Stores a session from the API's token and user, keeping only the fields in Session. */
export function saveSession(token: string, user: Session["user"]): Session {
  const session = toSession(token, user);
  const store = storage();
  if (!store) throw new SessionStorageError();
  try {
    store.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new SessionStorageError();
  }
  notify();
  return session;
}

/** Signs out in this browser. Never throws, so logging out cannot fail. */
export function clearSession(): void {
  try {
    storage()?.removeItem(SESSION_KEY);
  } catch {
    // Storage is unavailable, so there is nothing stored to remove.
  }
  notify();
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Calls `listener` when the session changes in this tab or, via the storage event, in another tab. */
export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY || event.key === null) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

const getServerSession = () => undefined;

/**
 * The stored session for components. `undefined` means not known yet: the server and
 * the hydrating first render cannot read localStorage, so both render the same output,
 * then React re-renders with the session or null.
 */
export function useStoredSession(): Session | null | undefined {
  return useSyncExternalStore(subscribeToSession, getSession, getServerSession);
}

export type Verification =
  | { status: "valid"; session: Session }
  | { status: "invalid" }
  | { status: "unreachable"; error: ApiError };

/**
 * Checks a stored token with GET /auth/me. The stored user is only a cache, so on success
 * the API's user replaces it. A 401 (expired, tampered, or the account is gone) clears
 * the session. Any other failure keeps it: a network blip or a sleeping server must not
 * sign anyone out. If another tab has replaced the token meanwhile, its session is left alone.
 */
export async function verifySession(token: string, signal?: AbortSignal): Promise<Verification> {
  try {
    const { user } = await apiRequest<{ user: User }>("auth/me", { token, signal });
    const session = getSession()?.token === token ? saveSession(token, user) : toSession(token, user);
    return { status: "valid", session };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status !== 401) return { status: "unreachable", error };
    if (getSession()?.token === token) clearSession();
    return { status: "invalid" };
  }
}
