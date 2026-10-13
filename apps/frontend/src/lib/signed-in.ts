import { createContext, use } from "react";
import type { Session } from "./session.ts";

/** What pages inside a role's area get: the verified session and a way to end it. */
export interface SignedIn extends Session {
  /** For a 401 from any request: clears the session and sends the user to log in again. */
  expire: () => void;
}

/** Provided by SignedInLayout once /auth/me has accepted the token. */
export const SignedInContext = createContext<SignedIn | null>(null);

export function useSignedInSession(): SignedIn {
  const signedIn = use(SignedInContext);
  if (!signedIn) throw new Error("useSignedInSession must be used inside SignedInLayout");
  return signedIn;
}
