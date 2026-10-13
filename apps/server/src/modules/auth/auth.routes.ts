import { Router } from 'express';
import type { JwtConfig } from '../../lib/jwt';
import { getAuthUser, requireAuth } from '../../middleware/auth';
import { loginSchema, signupSchema } from './auth.schemas';
import { getCurrentUser, login, signup } from './auth.service';

export function createAuthRouter(jwtConfig: JwtConfig): Router {
  const router = Router();

  router.post('/signup', async (req, res) => {
    res.status(201).json(await signup(signupSchema.parse(req.body), jwtConfig));
  });

  router.post('/login', async (req, res) => {
    res.status(200).json(await login(loginSchema.parse(req.body), jwtConfig));
  });

  router.get('/me', requireAuth(jwtConfig.secret), async (req, res) => {
    res.status(200).json({ user: await getCurrentUser(getAuthUser(req).id) });
  });

  return router;
}
