import { Router } from 'express';
import type { JwtConfig } from '../../lib/jwt';
import { loginSchema, signupSchema } from './auth.schemas';
import { login, signup } from './auth.service';

export function createAuthRouter(jwtConfig: JwtConfig): Router {
  const router = Router();

  router.post('/signup', async (req, res) => {
    res.status(201).json(await signup(signupSchema.parse(req.body), jwtConfig));
  });

  router.post('/login', async (req, res) => {
    res.status(200).json(await login(loginSchema.parse(req.body), jwtConfig));
  });

  return router;
}
