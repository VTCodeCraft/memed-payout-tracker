import type { AuthUser } from '../lib/jwt';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth; read it through getAuthUser(req). */
      user?: AuthUser;
    }
  }
}

export {};
