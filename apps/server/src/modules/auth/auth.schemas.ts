import { z } from 'zod';
import { requiredString } from '../../lib/validation';
import { ROLES } from '../../models/user.model';

// bcrypt only reads the first 72 bytes of a password, so longer ones are rejected
// rather than silently truncated.
const BCRYPT_MAX_PASSWORD_BYTES = 72;

const email = requiredString()
  .trim()
  .toLowerCase()
  .pipe(z.email('must be a valid email address').max(254));

export const signupSchema = z.object({
  name: requiredString().trim().min(2, 'must be at least 2 characters').max(60, 'must be at most 60 characters'),
  email,
  // Never trimmed: leading or trailing spaces can be part of a password.
  password: requiredString()
    .min(8, 'must be at least 8 characters')
    .refine(
      (password) => Buffer.byteLength(password, 'utf8') <= BCRYPT_MAX_PASSWORD_BYTES,
      `must be at most ${BCRYPT_MAX_PASSWORD_BYTES} bytes`,
    ),
  role: z.enum(ROLES, { error: 'must be "brand" or "creator"' }),
});

// Login only checks presence; password rules belong to signup and would leak policy here.
export const loginSchema = z.object({
  email,
  password: requiredString().min(1, 'is required'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
