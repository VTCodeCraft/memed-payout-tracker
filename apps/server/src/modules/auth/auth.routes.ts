import { type RequestHandler, Router } from 'express';
import type { JwtConfig } from '../../lib/jwt';
import { getAuthUser, requireAuth } from '../../middleware/auth';
import { loginSchema, signupSchema } from './auth.schemas';
import { getCurrentUser, login, signup } from './auth.service';

export function createAuthRouter(jwtConfig: JwtConfig, rateLimiter: RequestHandler): Router {
  const router = Router();

  // One limiter instance, so signup and login draw on the same per-client budget.
  router.post('/signup', rateLimiter, async (req, res) => {
    res.status(201).json(await signup(signupSchema.parse(req.body), jwtConfig));
  });

  router.post('/login', rateLimiter, async (req, res) => {
    res.status(200).json(await login(loginSchema.parse(req.body), jwtConfig));
  });

  router.get('/me', requireAuth(jwtConfig.secret), async (req, res) => {
    res.status(200).json({ user: await getCurrentUser(getAuthUser(req).id) });
  });

  return router;
}
