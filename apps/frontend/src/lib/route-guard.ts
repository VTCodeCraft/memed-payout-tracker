import { homePath } from "./auth.ts";
import type { Role, Session, Verification } from "./session.ts";

/** The latest /auth/me result and the token it was for. */
export interface SessionCheck {
  token: string;
  result: Verification;
}

export type Access =
  | { view: "loading" }
  | { view: "redirect"; to: string }
  | { view: "error"; message: string }
  | { view: "ready"; session: Session };

export const EXPIRED_LOGIN_PATH = "/login?session=expired";

/**
 * Decides what a signed-in area shows. Nothing protected renders until /auth/me has
 * confirmed the current token, and the role it checks is the API's, not the stored copy.
 * This only decides what to show; the API authorizes every request itself.
 */
export function decideAccess(stored: Session | null | undefined, check: SessionCheck | null, required: Role): Access {
  // Server render and hydration: the browser's storage has not been read yet.
  if (stored === undefined) return { view: "loading" };
  if (stored === null) {
    return { view: "redirect", to: check?.result.status === "invalid" ? EXPIRED_LOGIN_PATH : "/login" };
  }
  // Not checked yet, or the check was for a token that has since been replaced.
  if (!check || check.token !== stored.token) return { view: "loading" };

  const { result } = check;
  if (result.status === "unreachable") return { view: "error", message: result.error.message };
  if (result.status === "invalid") return { view: "redirect", to: EXPIRED_LOGIN_PATH };
  const { role } = result.session.user;
  if (role !== required) return { view: "redirect", to: homePath(role) };
  return { view: "ready", session: result.session };
}
